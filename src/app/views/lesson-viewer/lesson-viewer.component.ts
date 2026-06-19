import { Component, Input, Output, EventEmitter, OnInit, ViewChild, ElementRef, AfterViewInit, OnDestroy, HostListener } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { LessonService } from '../../services/lesson.service';
import { Module, Lesson } from '../../services/module.service';
import { HeaderComponent } from '../../layouts/header/header.component';
import Hls from 'hls.js';

@Component({
    selector: 'app-lesson-viewer',
    standalone: true,
    imports: [CommonModule, FormsModule, HeaderComponent],
    templateUrl: './lesson-viewer.component.html',
    styleUrls: ['./lesson-viewer.component.scss']
})
export class LessonViewerComponent implements OnInit, AfterViewInit, OnDestroy {
    @Input() lesson: any = null;
    @Input() module: any = null;
    @Output() close = new EventEmitter<void>();
    @Output() lessonCompleted = new EventEmitter<any>();

    @ViewChild('videoPlayer', { static: false }) videoPlayer!: ElementRef<HTMLVideoElement>;

    private hls: Hls | null = null;

    // Parâmetros da rota
    moduleId: string | null = null;
    lessonId: string | null = null;

    // Dados do curso
    courseName: string = '';
    totalProgress: number = 0;

    // Estado do vídeo
    currentTime: number = 0;
    totalTime: number = 0;
    isPlaying: boolean = false;

    isFullscreen: boolean = false;
    volume: number = 1;
    previousVolume: number = 1;
    isMuted: boolean = false;

    // Controle de visibilidade dos controles
    controlsVisible: boolean = true;
    private hideControlsTimer: any = null;
    mouseInsideVideo: boolean = false;

    // Dados da aula atual
    currentLesson: Lesson | null = null;

    // Breadcrumb
    breadcrumb: string[] = [];

    // Lista de aulas do módulo
    moduleLessons: Lesson[] = [];

    // Descrição da aula
    lessonDescription: string = '';

    // Estado de loading
    isLoading: boolean = true;

    // Estado de loading do vídeo
    isVideoLoading: boolean = false;

    private progressRestored: boolean = false;

    // Controle de salvamento do progresso
    private lastSaveTime: number = 0;
    private readonly SAVE_INTERVAL: number = 5000; // 5 segundos

    isProgressLoading: boolean = false;

    private lastModuleProgress: number = 0;

    isDraggingProgress = false;
    previewTime = 0;

    constructor(
        private route: ActivatedRoute,
        private router: Router,
        private lessonService: LessonService
    ) { }

    ngOnInit(): void {
        // Obter parâmetros da rota
        this.route.params.subscribe(params => {
            this.moduleId = params['moduleId'];
            this.lessonId = params['lessonId'];

            // Carregar dados baseado nos parâmetros da rota
            this.loadLessonData();
        });

        // Se recebeu dados via Input (para compatibilidade)
        if (this.lesson) {
            this.currentLesson = { ...this.lesson };
        }
        if (this.module) {
            this.courseName = this.module.name;
        }
    }

    ngAfterViewInit(): void {
        // initPlayer será chamado após carregar os dados (em loadLessonData / selectLesson)
    }

    private loadLessonData(): void {

        if (this.moduleId && this.lessonId) {
            const moduleIdNum = parseInt(this.moduleId);
            const lessonIdNum = parseInt(this.lessonId);

            // Carregar módulo (que já inclui todas as aulas)
            this.lessonService.getModuleById(moduleIdNum).subscribe(module => {

                if (module) {
                    this.courseName = module.name;
                    this.totalProgress = 0; // Progresso será calculado baseado nas aulas
                    this.moduleLessons = module.lessons || [];
                    this.breadcrumb = ['Início', module.name, 'Aula - ' + lessonIdNum];

                    // Buscar progresso do backend se não houver nenhum salvo localmente
                    const user = this.lessonService.authService.getUser();
                    if (user && this.moduleLessons.length > 0) {
                        const lessonsWithoutProgress = this.moduleLessons.filter(lesson => {
                            const moduleId = lesson.pivot?.module_id || module.id;
                            return !this.lessonService.getVideoProgress(moduleId, lesson.id);
                        });
                        if (lessonsWithoutProgress.length === this.moduleLessons.length) {
                            this.isProgressLoading = true;
                            // Nenhum progresso salvo localmente, buscar do backend
                            const lessonIds = this.moduleLessons.map(lesson => lesson.id);
                            this.lessonService.fetchLessonsProgressFromBackend(user.id, lessonIds).subscribe((progressResult: any) => {
                                const lessonsProgress = progressResult?.data?.lessons_progress;
                                if (Array.isArray(lessonsProgress)) {
                                    lessonsProgress.forEach((progress: any) => {
                                        const moduleId = module.id;
                                        const key = `lesson_progress_${moduleId}_${progress.lesson_id}`;
                                        localStorage.setItem(key, JSON.stringify({
                                            currentTime: progress.time || 0,
                                            totalTime: 0, // Não temos totalTime do backend
                                            progress: progress.progress || 0,
                                            lastUpdated: progress.updated_at || new Date().toISOString()
                                        }));
                                    });
                                }
                                this.isProgressLoading = false;
                            }, () => {
                                this.isProgressLoading = false;
                            });
                        }
                    }

                    // Encontrar a aula atual dentro do módulo carregado
                    const currentLesson = module.lessons?.find(l => l.id === lessonIdNum);

                    if (currentLesson) {
                        this.currentLesson = currentLesson;
                        this.lessonDescription = currentLesson.description;
                        this.isVideoLoading = true; // Ativar loading para nova aula

                        // Usar duração estimada do serviço
                        const estimatedDuration = this.lessonService.getEstimatedDuration(currentLesson);
                        const durationParts = estimatedDuration.split(':');
                        this.totalTime = parseInt(durationParts[0]) * 60 + parseInt(durationParts[1]);
                    } else {
                        console.error('❌ Aula não encontrada no módulo');
                    }
                    this.isLoading = false;
                    setTimeout(() => this.refreshAndInitPlayer(), 100);
                } else {
                    // Tentar restaurar do localStorage e tentar novamente
                    this.lessonService.restoreModulesFromLocalStorage();
                    this.lessonService.getModuleById(moduleIdNum).subscribe(module2 => {
                        if (module2) {
                            this.courseName = module2.name;
                            this.totalProgress = 0;
                            this.moduleLessons = module2.lessons || [];
                            this.breadcrumb = ['Início', module2.name, 'Aula - ' + lessonIdNum];
                            const currentLesson = module2.lessons?.find(l => l.id === lessonIdNum);
                            if (currentLesson) {
                                this.currentLesson = currentLesson;
                                this.lessonDescription = currentLesson.description;
                                this.isVideoLoading = true; // Ativar loading para nova aula
                                const estimatedDuration = this.lessonService.getEstimatedDuration(currentLesson);
                                const durationParts = estimatedDuration.split(':');
                                this.totalTime = parseInt(durationParts[0]) * 60 + parseInt(durationParts[1]);
                            } else {
                                console.error('❌ Aula não encontrada no módulo (mesmo após restaurar do localStorage)');
                            }
                        } else {
                            console.error('❌ Módulo não encontrado (mesmo após restaurar do localStorage)');
                        }
                        this.isLoading = false;
                        setTimeout(() => this.refreshAndInitPlayer(), 100);
                    });
                }
            });
        } else {
            console.error('❌ ModuleId ou LessonId não fornecidos');
            this.isLoading = false;
        }
    }

    // Restaurar progresso do vídeo
    private restoreVideoProgress(): void {
        if (this.progressRestored || !this.moduleId || !this.lessonId || !this.videoPlayer?.nativeElement) {
            return;
        }

        const video = this.videoPlayer.nativeElement;
        const savedProgress = this.lessonService.getVideoProgress(parseInt(this.moduleId), parseInt(this.lessonId));

        if (!savedProgress || savedProgress.currentTime <= 0) {
            this.progressRestored = true;
            return;
        }

        if (savedProgress.currentTime > 0) {
            video.currentTime = savedProgress.currentTime;
            this.currentTime = savedProgress.currentTime;
        }

        this.progressRestored = true;
    }

    @HostListener('document:fullscreenchange')
    @HostListener('document:webkitfullscreenchange')
    @HostListener('document:mozfullscreenchange')
    @HostListener('document:MSFullscreenChange')
    onFullscreenChange(): void {
        this.isFullscreen = !!document.fullscreenElement;
    }

    @HostListener('document:keydown', ['$event'])
    handleKeyboardEvent(event: KeyboardEvent): void {
        const video = this.videoPlayer?.nativeElement;
        if (!video || this.isLoading || this.isProgressLoading) return;

        const target = event.target as HTMLElement;
        const isInput = target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable;
        if (isInput) return;

        switch (event.code) {
            case 'Space':
                event.preventDefault();
                this.togglePlay();
                break;

            case 'ArrowLeft':
                event.preventDefault();
                this.seekBy(-5);
                break;

            case 'ArrowRight':
                event.preventDefault();
                this.seekBy(5);
                break;

            case 'ArrowUp':
                event.preventDefault();
                this.adjustVolume(0.1);
                break;

            case 'ArrowDown':
                event.preventDefault();
                this.adjustVolume(-0.1);
                break;

            case 'KeyF':
                event.preventDefault();
                this.toggleFullscreen();
                break;
        }
    }

    // Controles do vídeo
    togglePlay(): void {
        if (this.videoPlayer?.nativeElement) {
            if (this.isPlaying) {
                this.videoPlayer.nativeElement.pause();
            } else {
                this.videoPlayer.nativeElement.play();
            }
        }
    }

    // ── Auto-hide controls ──

    startControlsTimer(): void {
        this.clearControlsTimer();
        this.controlsVisible = true;
        if (this.isPlaying) {
            this.hideControlsTimer = setTimeout(() => {
                this.controlsVisible = false;
            }, 5000);
        }
    }

    clearControlsTimer(): void {
        if (this.hideControlsTimer) {
            clearTimeout(this.hideControlsTimer);
            this.hideControlsTimer = null;
        }
    }

    toggleFullscreen(): void {
        const videoFrame = this.videoPlayer?.nativeElement?.parentElement;

        if (document.fullscreenElement) {
            document.exitFullscreen().catch(() => { });
        } else if (videoFrame) {
            videoFrame.requestFullscreen().catch(() => { });
        }
    }

    seekBy(seconds: number): void {
        const video = this.videoPlayer?.nativeElement;
        if (!video) return;
        video.currentTime = Math.max(0, Math.min(video.currentTime + seconds, video.duration || 0));
    }

    toggleMute(): void {
        const video = this.videoPlayer?.nativeElement;
        if (!video) return;

        if (this.isMuted) {
            video.muted = false;
            this.isMuted = false;
            this.volume = this.previousVolume || 1;
            video.volume = this.volume;
        } else {
            this.previousVolume = this.volume;
            video.muted = true;
            this.isMuted = true;
            this.volume = 0;
        }
    }

    onVolumeSliderChange(event: Event): void {
        const input = event.target as HTMLInputElement;
        const value = parseFloat(input.value);
        this.volume = value;
        const video = this.videoPlayer?.nativeElement;
        if (video) {
            video.volume = value;
            if (value === 0) {
                video.muted = true;
                this.isMuted = true;
            } else {
                video.muted = false;
                this.isMuted = false;
                this.previousVolume = value;
            }
        }
    }

    adjustVolume(delta: number): void {
        const video = this.videoPlayer?.nativeElement;
        if (!video) return;
        this.volume = Math.max(0, Math.min(1, Math.round((this.volume + delta) * 10) / 10));
        video.volume = this.volume;
        if (this.volume > 0) {
            video.muted = false;
            this.isMuted = false;
        } else {
            video.muted = true;
            this.isMuted = true;
        }
    }

    onVideoMouseEnter(): void {
        this.mouseInsideVideo = true;
        this.startControlsTimer();
    }

    onVideoMouseMove(): void {
        if (this.mouseInsideVideo) {
            this.startControlsTimer();
        }
    }

    onVideoMouseLeave(): void {
        this.mouseInsideVideo = false;
        this.clearControlsTimer();
        this.controlsVisible = false;
    }

    // ── HLS Player ──

    private initPlayer(): void {
        this.destroyHls();

        const video = this.videoPlayer?.nativeElement;
        if (!video || !this.currentLesson) return;

        const hlsUrl = this.currentLesson.hls_url;
        const mp4Url = this.currentLesson.video_url;
        const savedProgress = this.savedVideoProgress;

        if (hlsUrl && Hls.isSupported()) {
            this.hls = new Hls({
                enableWorker: true,
                lowLatencyMode: true,
                backBufferLength: 30,
                maxBufferLength: 60,
            });
            this.hls.loadSource(hlsUrl);
            this.hls.attachMedia(video);

            this.hls.on(Hls.Events.MANIFEST_PARSED, () => {
                this.isVideoLoading = false;
            });
        } else if (mp4Url) {
            video.src = mp4Url;
        }
    }

    private refreshAndInitPlayer(): void {
        if (!this.currentLesson || !this.moduleId) {
            this.initPlayer();
            return;
        }

        if (this.currentLesson.hls_url) {
            this.initPlayer();
            return;
        }

        this.lessonService.fetchFreshModuleFromApi(parseInt(this.moduleId))
            .subscribe(freshModule => {
                if (freshModule) {
                    const freshLesson = freshModule.lessons?.find(l => l.id === this.currentLesson!.id);
                    if (freshLesson?.hls_url) {
                        this.currentLesson = freshLesson;
                    }
                }
                this.initPlayer();
            });
    }

    private destroyHls(): void {
        if (this.hls) {
            this.hls.destroy();
            this.hls = null;
        }
    }

    private get savedVideoProgress(): { currentTime: number; totalTime: number; progress: number; lastUpdated: string } | null {
        if (!this.moduleId || !this.lessonId) return null;
        return this.lessonService.getVideoProgress(parseInt(this.moduleId), parseInt(this.lessonId));
    }

    // Pausar vídeo
    pauseVideo(): void {
        this.isPlaying = false;
        if (this.videoPlayer?.nativeElement) {
            this.videoPlayer.nativeElement.pause();
        }
    }

    onTimeUpdate(event: any): void {
        this.currentTime = event.target.currentTime;

        // Salvar progresso no localStorage a cada 5 segundos, somente se avançou
        if (this.currentLesson && this.moduleId && this.lessonId && this.totalTime > 0) {
            const currentTime = Date.now();
            const moduleIdNum = parseInt(this.moduleId);
            const lessonIdNum = parseInt(this.lessonId);
            const savedProgress = this.lessonService.getVideoProgress(moduleIdNum, lessonIdNum);
            const lastSavedTime = savedProgress ? savedProgress.currentTime : 0;

            // Só salva se passou o intervalo de tempo E avançou
            if (currentTime - this.lastSaveTime >= this.SAVE_INTERVAL && this.currentTime > lastSavedTime) {
                // Salvar progresso no localStorage
                this.lessonService.saveVideoProgress(moduleIdNum, lessonIdNum, this.currentTime, this.totalTime);

                // Atualizar progresso da aula baseado no tempo assistido
                const progress = Math.round((this.currentTime / this.totalTime) * 100);
                const currentProgress = this.lessonService.getLessonProgressWithModule(moduleIdNum, lessonIdNum);
                if (progress > currentProgress) {
                    this.lessonService.updateLessonProgress(moduleIdNum, lessonIdNum, progress);
                }

                this.lastSaveTime = currentTime;
            }
        }
        // Atualizar progresso total ao salvar progresso de uma lesson
        setTimeout(() => this.updateTotalProgress(), 100);
    }

    onLoadedMetadata(event: any): void {
        this.totalTime = event.target.duration;
        this.isVideoLoading = false; // Vídeo carregado
        // Restaurar progresso após carregar os metadados
        setTimeout(() => this.restoreVideoProgress(), 100);
    }

    // Método para detectar quando o vídeo começa a carregar
    onLoadStart(): void {
        this.isVideoLoading = true;
    }

    onPlay(): void {
        this.isPlaying = true;
        this.startControlsTimer();
    }

    onPause(): void {
        this.isPlaying = false;
        this.clearControlsTimer();
        this.controlsVisible = true;
    }
    onCanPlay(): void {
        this.isVideoLoading = false;
    }

    // Método para detectar quando o vídeo está carregando dados
    onWaiting(): void {
        this.isVideoLoading = true;
    }

    // Método para obter texto de loading dinâmico
    getLoadingText(): string {
        if (this.isLoading) {
            return 'Carregando aula...';
        } else if (this.isProgressLoading) {
            return 'Sincronizando progresso...';
        } else if (this.isVideoLoading) {
            return 'Carregando vídeo...';
        }
        return 'Carregando...';
    }

    // Formatação de tempo
    formatTime(seconds: number): string {
        const minutes = Math.floor(seconds / 60);
        const remainingSeconds = Math.floor(seconds % 60);
        return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;
    }

    // Cálculo do progresso
    getProgressPercentage(): number {
        if (this.isDraggingProgress && this.totalTime > 0) {
            return (this.previewTime / this.totalTime) * 100;
        }
        return this.totalTime > 0 ? (this.currentTime / this.totalTime) * 100 : 0;
    }

    // Navegação
    goBack(): void {
        // Se foi chamado via Input, emite o evento
        if (this.lesson && this.module) {
            this.close.emit();
        } else {
            // Se foi chamado via rota, navega de volta
            this.router.navigate(['/dashboard']);
        }
    }

    completeLesson(): void {
        if (this.currentLesson && this.moduleId && this.lessonId) {
            const moduleIdNum = parseInt(this.moduleId);
            const lessonIdNum = parseInt(this.lessonId);

            // Marcar aula como concluída (100%)
            this.lessonService.saveVideoProgress(moduleIdNum, lessonIdNum, this.totalTime, this.totalTime);
            this.lessonService.completeLesson(moduleIdNum, lessonIdNum);

            this.lessonCompleted.emit(this.currentLesson);

            // Atualizar progresso total imediatamente
            setTimeout(() => {
                this.updateTotalProgress();
                // Enviar progresso total atualizado do módulo para o backend
                const user = this.lessonService.authService.getUser();
                if (user) {
                    let sum = 0;
                    let totalTime = 0;
                    this.moduleLessons.forEach(lesson => {
                        sum += this.lessonService.getLessonProgressWithModule(moduleIdNum, lesson.id);
                        const progressObj = this.lessonService.getVideoProgress(moduleIdNum, lesson.id);
                        if (progressObj) {
                            totalTime += progressObj.currentTime || 0;
                        }
                    });
                    const newTotalProgress = Math.round(sum / this.moduleLessons.length);
                    this.lessonService.sendModuleProgressToBackend(user.id, moduleIdNum, newTotalProgress, totalTime);
                }
            }, 100);

            // Navegar para a próxima aula
            const currentIndex = this.moduleLessons.findIndex(l => l.id === this.currentLesson!.id);
            const nextLesson = this.moduleLessons[currentIndex + 1];

            if (nextLesson) {
                this.router.navigate(['/lesson', this.moduleId, nextLesson.id]);
            } else {
                // Se não há próxima aula, volta para o dashboard
                this.router.navigate(['/dashboard']);
            }
        }
    }

    // Navegação entre aulas
    selectLesson(lesson: Lesson): void {
        // Pausar e destruir player atual
        this.pauseVideo();
        this.destroyHls();

        this.currentLesson = lesson;
        this.lessonId = lesson.id.toString();
        this.currentTime = 0;
        this.isPlaying = false;
        this.isVideoLoading = true; // Ativar loading para nova aula
        this.lessonDescription = lesson.description;
        this.progressRestored = false; // Reset flag para nova aula

        // Usar duração estimada do serviço
        const estimatedDuration = this.lessonService.getEstimatedDuration(lesson);
        const durationParts = estimatedDuration.split(':');
        this.totalTime = parseInt(durationParts[0]) * 60 + parseInt(durationParts[1]);

        // Se foi chamado via rota, atualiza a URL
        if (this.moduleId) {
            this.router.navigate(['/lesson', this.moduleId, lesson.id]);
        }
        setTimeout(() => this.refreshAndInitPlayer(), 100);
        setTimeout(() => this.updateTotalProgress(), 100);
    }

    // Verificar se é a aula atual
    isCurrentLesson(lesson: Lesson): boolean {
        return this.currentLesson ? lesson.id === this.currentLesson.id : false;
    }

    // Gerar cor para thumbnail baseado no ID
    getThumbnailColor(lessonId: number): string {
        const colors = [
            '#3A4AFF', '#4A90E2', '#6A6AFF', '#FF6B6B', '#4ECDC4',
            '#45B7D1', '#FFA726', '#66BB6A', '#AB47BC', '#26A69A'
        ];
        return colors[lessonId % colors.length];
    }

    // Obter progresso da aula
    getLessonProgress(lessonId: number): number {
        if (this.moduleId) {
            return this.lessonService.getLessonProgressWithModule(parseInt(this.moduleId), lessonId);
        }
        return this.lessonService.getLessonProgress(lessonId);
    }

    // Obter duração estimada da aula
    getEstimatedDuration(lesson: Lesson): string {
        return this.lessonService.getEstimatedDuration(lesson);
    }

    onProgressBarMouseDown(event: MouseEvent): void {
        this.isDraggingProgress = true;
        this.updatePreviewTime(event);
        window.addEventListener('mousemove', this.onProgressBarMouseMove);
        window.addEventListener('mouseup', this.onProgressBarMouseUp);
    }

    onProgressBarMouseMove = (event: MouseEvent) => {
        if (this.isDraggingProgress) {
            this.updatePreviewTime(event);
        }
    };

    onProgressBarMouseUp = (event: MouseEvent) => {
        if (this.isDraggingProgress) {
            this.isDraggingProgress = false;
            this.updatePreviewTime(event, true);
            window.removeEventListener('mousemove', this.onProgressBarMouseMove);
            window.removeEventListener('mouseup', this.onProgressBarMouseUp);
        }
    };

    updatePreviewTime(event: MouseEvent, setCurrentTime: boolean = false): void {
        if (this.videoPlayer?.nativeElement && this.totalTime > 0) {
            const bar = (event.currentTarget as HTMLElement).classList.contains('progress-bar-bg')
                ? (event.currentTarget as HTMLElement)
                : (document.querySelector('.progress-bar-bg') as HTMLElement);
            if (!bar) return;
            const rect = bar.getBoundingClientRect();
            const clickX = event.clientX - rect.left;
            const percent = Math.max(0, Math.min(1, clickX / rect.width));
            const newTime = percent * this.totalTime;
            this.previewTime = newTime;
            if (setCurrentTime) {
                this.videoPlayer.nativeElement.currentTime = newTime;
                this.currentTime = newTime;
            }
        }
    }

    // Salvar progresso quando sair da página
    @HostListener('window:beforeunload')
    onBeforeUnload(): void {
        this.saveCurrentProgress();
    }

    ngOnDestroy(): void {
        this.saveCurrentProgress();
        this.destroyHls();
    }

    private saveCurrentProgress(): void {
        if (this.currentLesson && this.moduleId && this.lessonId && this.totalTime > 0) {
            const moduleIdNum = parseInt(this.moduleId);
            const lessonIdNum = parseInt(this.lessonId);
            const savedProgress = this.lessonService.getVideoProgress(moduleIdNum, lessonIdNum);
            const lastSavedTime = savedProgress ? savedProgress.currentTime : 0;
            // Só salva se avançou
            if (this.currentTime > lastSavedTime) {
                this.lessonService.saveVideoProgress(moduleIdNum, lessonIdNum, this.currentTime, this.totalTime);
            }
        }
    }

    // Método temporário para limpar todos os progressos (remover em produção)
    clearAllProgress(): void {
        this.lessonService.clearAllProgress();
        // Recarregar a página para atualizar os indicadores visuais
        window.location.reload();
    }

    private updateTotalProgress(): void {
        if (!this.moduleLessons || this.moduleLessons.length === 0 || !this.moduleId) {
            this.totalProgress = 0;
            return;
        }
        const moduleIdNum = parseInt(this.moduleId);
        let sum = 0;
        let totalTime = 0;
        this.moduleLessons.forEach(lesson => {
            sum += this.lessonService.getLessonProgressWithModule(moduleIdNum, lesson.id);
            const progressObj = this.lessonService.getVideoProgress(moduleIdNum, lesson.id);
            if (progressObj) {
                totalTime += progressObj.currentTime || 0;
            }
        });
        const newTotalProgress = Math.round(sum / this.moduleLessons.length);
        // Se o progresso total aumentou, envia para o backend
        if (newTotalProgress > this.lastModuleProgress) {
            const user = this.lessonService.authService.getUser();
            if (user) {
                this.lessonService.sendModuleProgressToBackend(user.id, moduleIdNum, newTotalProgress, totalTime);
            }
        }
        this.lastModuleProgress = newTotalProgress;
        this.totalProgress = newTotalProgress;
    }

    seek(event: MouseEvent): void {
        if (this.videoPlayer?.nativeElement && this.totalTime > 0) {
            const bar = (event.currentTarget as HTMLElement).querySelector('.progress-bar-bg') as HTMLElement;
            if (!bar) return;
            const rect = bar.getBoundingClientRect();
            const clickX = event.clientX - rect.left;
            const percent = Math.max(0, Math.min(1, clickX / rect.width));
            const newTime = percent * this.totalTime;
            this.videoPlayer.nativeElement.currentTime = newTime;
            this.currentTime = newTime;
        }
    }
} 