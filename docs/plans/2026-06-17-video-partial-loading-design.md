# Video Partial Loading — Design Document

## Problem

Currently, videos are served as a single MP4 file from Cloudflare R2 via a Worker at
`https://assets.userfounded.workers.dev/file/<filename>`. The native HTML5 `<video>` element loads the
file from byte 0, even if the user has already watched the first half. This causes:

- **Wasted bandwidth**: re-downloading already-watched portions on every visit
- **Slow seek/pulação**: when skipping ahead, the browser must fetch bytes sequentially until
  the target position (even with Range requests, seeking in a single MP4 is inefficient)
- **Slow initial load**: if the video is large, the user waits for the first bytes even when
  resuming from the middle

## Goal

Implement partial video loading so that:
1. If user resumes at 50%, only bytes from ~50% onward are fetched
2. When skipping forward, skipped segments are **not** fetched
3. Each segment is small (~2–10s) for instant playback from any seek point
4. Watched segments are never re-requested (browser cache + Cache API)

## Brainstorm Findings

| Branch | User Choice | Rationale |
|--------|------------|-----------|
| **HLS Adaptive Streaming** | `ffmpeg_post` — FFmpeg pós-upload | Converter o MP4 em segmentos .ts + playlist .m3u8 após o upload inicial. Job assíncrono na API. |
| **Media Source Extensions** | `both` — Híbrido tempo+bytes | Usar tempo para decidir o que baixar e bytes para buscar eficientemente. O hls.js já faz isso internamente. |
| **Segmentação prévia** | `adaptive` — 2s perto do playhead, 10s longe | Segmentos menores perto do ponto de reprodução, maiores nas áreas distantes. |
| **Prefetch inteligente** | `fetch_cache` — fetch() + Cache API | Baixar janela futura via fetch() com Range e armazenar no Cache API como camada extra. |

## Recommended Architecture

```
Upload Flow:
┌──────────┐    MP4    ┌──────────────────┐
│  Admin   │──────────▶│  Cloudflare R2   │
│  UI      │  upload   │  (original.mp4)  │
└──────────┘           └────────┬─────────┘
                                │ webhook / job
                                ▼
                        ┌──────────────────┐
                        │  Backend Job     │
                        │  (FFmpeg)        │
                        │  mp4 → .m3u8     │
                        │      + .ts files │
                        └────────┬─────────┘
                                 │ upload segments
                                 ▼
                        ┌──────────────────┐
                        │  Cloudflare R2   │
                        │  /hls/{id}/      │
                        │    index.m3u8    │
                        │    seg-1.ts      │
                        │    seg-2.ts      │
                        │    ...           │
                        └──────────────────┘

Playback Flow:
┌──────────┐  fetch .m3u8  ┌──────────────────┐
│  Browser │──────────────▶│  Cloudflare      │
│  hls.js  │◀──────────────│  Worker          │
│  player  │  .ts segments │  (serves files)  │
└────┬─────┘  on demand    └──────────────────┘
     │
     ├── Cache API: stores fetched .ts segments
     ├── localStorage: progress tracking (existing)
     └── Buffered segments auto-evicted by browser
```

### Layer 1 — HLS Conversion (Backend)

**Where**: Laravel backend (`ModuleController` or dedicated `VideoController`)
**When**: After upload completes (async job)

```php
// Pseudocode for the conversion job
class ConvertVideoToHlsJob implements ShouldQueue
{
    public function handle(): void
    {
        $inputPath = storage_path("temp/{$this->filename}");
        $outputDir = storage_path("temp/hls/{$this->videoId}");

        // Download from R2
        Storage::disk('r2')->download($this->filename, $inputPath);

        // FFmpeg: segment into ~6s .ts chunks
        // Adaptive: 2s keyframe interval near playhead isn't possible offline
        // Instead use fixed 6s segments (standard HLS)
        $cmd = "ffmpeg -i {$inputPath} "
             . "-codec: copy "                    // Avoid re-encode if possible
             . "-start_number 0 "
             . "-hls_time 6 "                      // 6-second segments
             . "-hls_list_size 0 "
             . "-f hls "
             . "{$outputDir}/index.m3u8";

        exec($cmd, $output, $exitCode);

        if ($exitCode !== 0) {
            throw new \Exception("FFmpeg conversion failed");
        }

        // Upload all .ts + .m3u8 to R2 under /hls/{videoId}/
        foreach (glob("{$outputDir}/*") as $file) {
            $key = "hls/{$this->videoId}/" . basename($file);
            Storage::disk('r2')->put($key, file_get_contents($file));
        }

        // Update lesson.video_url to point to the m3u8
        $this->lesson->update([
            'video_url' => "https://assets.userfounded.workers.dev/hls/{$this->videoId}/index.m3u8"
        ]);

        // Cleanup temp files
        Storage::disk('local')->deleteDirectory("temp/hls/{$this->videoId}");
        unlink($inputPath);
    }
}
```

**Key considerations**:
- `-codec: copy` avoids re-encoding if the MP4 is already h.264/AAC (most common)
- If re-encode is needed, use `-c:v libx264 -preset fast -crf 23`
- For existing videos, a migration script can batch-convert them
- Add a `conversion_status` column to lessons: `pending | processing | completed | failed`

### Layer 2 — Cloudflare Worker Updates

The Worker at `assets.userfounded.workers.dev` already serves files via `/file/<path>`.
Add HLS-specific routes or reuse the existing `/file/` path:

```
GET /file/hls/{videoId}/index.m3u8   → serves playlist
GET /file/hls/{videoId}/seg-0.ts      → serves segment
```

The Worker must set proper headers for HLS:
- `Content-Type: application/vnd.apple.mpegurl` for `.m3u8`
- `Content-Type: video/MP2T` for `.ts`
- `Cache-Control: public, max-age=31536000, immutable` for segments (they never change)
- `Access-Control-Allow-Origin: *` (CORS)

**No byte-range hack needed** — HLS segments are small enough that each is a complete fetch.
The browser + hls.js manage the buffer automatically.

### Layer 3 — Frontend: hls.js Player

**Replace** the native `<video src="...">` with hls.js:

```typescript
// lesson-viewer.component.ts
import Hls from 'hls.js';

export class LessonViewerComponent implements AfterViewInit {
  @ViewChild('videoPlayer') videoPlayer!: ElementRef<HTMLVideoElement>;
  private hls: Hls | null = null;

  ngAfterViewInit(): void {
    this.initPlayer();
  }

  private initPlayer(): void {
    const video = this.videoPlayer.nativeElement;
    const url = this.currentLesson?.video_url;

    if (!url) return;

    // Check if URL is already HLS (.m3u8)
    if (url.endsWith('.m3u8') && Hls.isSupported()) {
      this.hls = new Hls({
        // Adaptive quality
        enableWorker: true,
        lowLatencyMode: true,
        backbufferLength: 30,        // keep only 30s behind playhead
        maxBufferLength: 60,         // max 60s ahead
        maxMaxBufferLength: 120,     // absolute max
        // Start from saved progress
        startPosition: this.savedTime || 0,
      });
      this.hls.loadSource(url);
      this.hls.attachMedia(video);
    } else {
      // Fallback to native for non-HLS urls
      video.src = url;
      if (this.savedTime) {
        video.currentTime = this.savedTime;
      }
    }
  }

  private get savedTime(): number {
    const progress = this.lessonService.getVideoProgress(
      this.moduleId, this.lessonId
    );
    return progress?.currentTime || 0;
  }
}
```

### Layer 4 — Cache API Prefetch

Layer on top of hls.js to cache segments in the Cache API:

```typescript
// Prefetch next segments into Cache API
private prefetchNextSegments(): void {
  if (!this.hls) return;

  const nextSegments = this.hls.nextLoadPosition;  // upcoming segments
  const baseUrl = this.currentLesson!.video_url.replace('index.m3u8', '');

  for (let i = 0; i < 3; i++) {  // prefetch next 3 segments
    const segUrl = `${baseUrl}seg-${nextSegments + i}.ts`;
    caches.open('video-segments').then(cache => {
      cache.add(segUrl).catch(() => {}); // silent fail
    });
  }
}
```

**But** — hls.js already manages its own buffer efficiently. The Cache API layer is
optional and only adds value for offline support or if the user rewinds to a
previously-cached segment. **Recommendation**: implement Cache API prefetch only
if native hls.js buffering proves insufficient after testing.

### Progress Restoration with HLS

With HLS, seeking to a saved time is seamless:
- hls.js's `startPosition: savedTime` tells it to start loading from the segment
  containing that timecode
- Only the segment(s) needed for `savedTime` onward are fetched
- Previously watched segments are **never downloaded** (unless user rewinds)

## Implementation Plan

### Phase 1 — Foundation (Backend)
1. Add `conversion_status` column to `lessons` table
2. Create `ConvertVideoToHlsJob` (Laravel job)
3. Create `HlsController` or extend `ModuleController` to trigger conversion after upload
4. Ensure Worker serves correct Content-Type for HLS files
5. Migration command to batch-convert existing videos

### Phase 2 — Playback (Frontend)
1. Install `hls.js` (`npm install hls.js`)
2. Refactor `lesson-viewer.component.ts` to use hls.js when URL ends in `.m3u8`
3. Pass `startPosition` from saved progress
4. Test seeking, resume, and forward-skip behavior
5. Remove native `<video src>` in favor of hls.js managed source

### Phase 3 — Polish
1. Adaptive segment size optimization (if needed)
2. Cache API prefetch for offline/rewind
3. Fallback to native video if hls.js is not supported (very old browsers)
4. Analytics: track segment fetch time, buffer health

## Risk Assessment

| Risk | Impact | Mitigation |
|------|--------|------------|
| FFmpeg conversion is slow for large videos | High | Run as async queue job; show conversion status in admin UI |
| Existing videos need conversion | Medium | Write a migration command; convert during idle time |
| HLS adds ~5-10% storage overhead | Low | Segment overhead is marginal; segments never change |
| hls.js compatibility (very old browsers) | Low | Fallback to native `<video>` |
| Worker needs CORS for .m3u8 | Low | Already configured for existing file serving |

## Expected Benefits

| Metric | Before | After |
|--------|--------|-------|
| Initial load at resume (50%) | Full video download | Only segments from 50% onward (~50% of video) |
| Seek forward | Full sequential download | Jump directly to target segment |
| Seek backward | May re-download from cache | Segments in Cache API = instant |
| Bandwidth per play | Full video | Only actually-watched segments |
