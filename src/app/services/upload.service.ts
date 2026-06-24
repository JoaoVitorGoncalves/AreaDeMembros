import { Injectable } from '@angular/core';
import { HttpClient, HttpEventType, HttpRequest } from '@angular/common/http';
import { Observable, from, of, Subject } from 'rxjs';
import { map, catchError } from 'rxjs/operators';
import { AdminService } from './admin.service';

export interface UploadResponse {
    success: boolean;
    file: {
        filename: string;
        originalName: string;
        size: number;
        type: string;
        category: string;
        url: string;
        uploadedAt: string;
    };
}

export interface UploadProgress {
    progress: number;
    status: 'uploading' | 'completed' | 'error';
    response?: UploadResponse;
    error?: string;
    currentPart?: number;
    totalParts?: number;
    uploadId?: string;
    filename?: string;
}

// Classe para upload multipart
class MultipartUploader {
    private apiUrl: string;
    private chunkSize: number;
    private currentUpload: { uploadId: string; filename: string } | null = null;
    private adminService: AdminService;

    private get tenantHash(): string {
        return this.adminService?.getTenantHash() || '';
    }

    private multipartUrl(subPath: string): string {
        const hash = this.tenantHash;
        return hash ? `${this.apiUrl}/upload/multipart/${hash}${subPath}` : `${this.apiUrl}/upload/multipart${subPath}`;
    }

    constructor(apiUrl: string, adminService?: AdminService) {
        this.apiUrl = apiUrl;
        this.adminService = adminService as AdminService;
        this.chunkSize = 50 * 1024 * 1024; // 50MB por parte (limite máximo do Worker)
    }

    async uploadFile(file: File, onProgress?: (progress: number, currentPart: number, totalParts: number) => void, onInit?: (uploadId: string, filename: string) => void): Promise<UploadResponse> {
        try {
            // 1. Inicializar upload multipart
            const initResponse = await fetch(this.multipartUrl('/init'), {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    filename: file.name,
                    contentType: file.type,
                    size: file.size
                })
            });

            if (!initResponse.ok) {
                throw new Error(`Failed to initialize upload: ${initResponse.statusText}`);
            }

            const { uploadId, filename } = await initResponse.json();

            // Armazenar informações do upload atual
            this.currentUpload = { uploadId, filename };

            // Emitir callback inicial com informações do upload
            if (onInit) {
                onInit(uploadId, filename);
            }

            // 2. Dividir arquivo em partes e fazer upload
            const totalChunks = Math.ceil(file.size / this.chunkSize);
            const parts = [];

            for (let i = 0; i < totalChunks; i++) {
                const start = i * this.chunkSize;
                const end = Math.min(start + this.chunkSize, file.size);
                const chunk = file.slice(start, end);
                const partNumber = i + 1;

                const partResponse = await fetch(`${this.multipartUrl('/part')}?filename=${encodeURIComponent(filename)}&uploadId=${uploadId}&partNumber=${partNumber}`, {
                    method: 'POST',
                    body: chunk
                });

                if (!partResponse.ok) {
                    throw new Error(`Failed to upload part ${partNumber}: ${partResponse.statusText}`);
                }

                const { etag } = await partResponse.json();
                parts.push({
                    partNumber: partNumber,
                    etag: etag
                });

                // Callback de progresso
                if (onProgress) {
                    const progress = (i + 1) / totalChunks;
                    onProgress(progress, i + 1, totalChunks);
                }
            }

            // 3. Completar upload multipart
            const completeResponse = await fetch(this.multipartUrl('/complete'), {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    filename: filename,
                    uploadId: uploadId,
                    parts: parts
                })
            });

            if (!completeResponse.ok) {
                throw new Error(`Failed to complete upload: ${completeResponse.statusText}`);
            }

            const result = await completeResponse.json();

            // Limpar informações do upload atual
            this.currentUpload = null;

            return result;

        } catch (error) {
            console.error('Erro no upload:', error);
            // Limpar informações do upload atual em caso de erro
            this.currentUpload = null;
            throw error;
        }
    }

    // Método para cancelar upload se necessário
    async abortUpload(filename: string, uploadId: string): Promise<void> {
        try {
            const response = await fetch(this.multipartUrl('/abort'), {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    filename: filename,
                    uploadId: uploadId
                })
            });

            if (!response.ok) {
                throw new Error(`Failed to abort upload: ${response.statusText}`);
            }

            // Limpar informações do upload atual
            this.currentUpload = null;
        } catch (error) {
            console.error('Erro ao cancelar upload:', error);
            throw error;
        }
    }

    // Método para obter informações do upload atual
    getCurrentUpload(): { uploadId: string; filename: string } | null {
        return this.currentUpload;
    }

    // Método para cancelar upload atual
    async abortCurrentUpload(): Promise<void> {
        if (this.currentUpload) {
            await this.abortUpload(this.currentUpload.filename, this.currentUpload.uploadId);
        }
    }
}

@Injectable({
    providedIn: 'root'
})
export class UploadService {
    // private readonly baseUrl = 'http://127.0.0.1:8787';
    private readonly baseUrl = 'https://assets.userfounded.workers.dev';
    private readonly multipartThreshold = 100 * 1024 * 1024; // 100MB
    private multipartUploader: MultipartUploader;

    private get tenantPath(): string {
        const hash = this.adminService.getTenantHash();
        return hash ? `${hash}` : '';
    }

    private get apiBase(): string {
        return this.tenantPath ? `${this.baseUrl}/${this.tenantPath}` : this.baseUrl;
    }

    constructor(private http: HttpClient, private adminService: AdminService) {
        this.multipartUploader = new MultipartUploader(this.baseUrl, this.adminService);
    }

    uploadVideo(file: File): Observable<UploadProgress> {
        // Verificar se o arquivo é maior que 100MB
        if (file.size > this.multipartThreshold) {
            return this.uploadVideoMultipart(file);
        }

        // Upload normal para arquivos menores
        const formData = new FormData();
        formData.append('file', file);

        const req = new HttpRequest('POST', `${this.apiBase}/upload`, formData, {
            reportProgress: true,
            responseType: 'json'
        });

        return this.http.request<UploadResponse>(req).pipe(
            map(event => {
                switch (event.type) {
                    case HttpEventType.UploadProgress:
                        const progress = event.total ? Math.round(100 * event.loaded / event.total) : 0;
                        return {
                            progress,
                            status: 'uploading' as const
                        };
                    case HttpEventType.Response:
                        return {
                            progress: 100,
                            status: 'completed' as const,
                            response: event.body!
                        };
                    default:
                        return {
                            progress: 0,
                            status: 'uploading' as const
                        };
                }
            }),
            catchError(error => {
                console.error('Upload error:', error);
                return of({
                    progress: 0,
                    status: 'error' as const,
                    error: error.message
                });
            })
        );
    }

    // Método para upload de imagem com progresso
    uploadImage(file: File): Observable<UploadProgress> {
        // Upload normal para imagens (geralmente são pequenas)
        const formData = new FormData();
        formData.append('file', file);

        const req = new HttpRequest('POST', `${this.apiBase}/upload`, formData, {
            reportProgress: true,
            responseType: 'json'
        });

        return this.http.request<UploadResponse>(req).pipe(
            map(event => {
                switch (event.type) {
                    case HttpEventType.UploadProgress:
                        const progress = event.total ? Math.round(100 * event.loaded / event.total) : 0;
                        return {
                            progress,
                            status: 'uploading' as const
                        };
                    case HttpEventType.Response:
                        return {
                            progress: 100,
                            status: 'completed' as const,
                            response: event.body!
                        };
                    default:
                        return {
                            progress: 0,
                            status: 'uploading' as const
                        };
                }
            }),
            catchError(error => {
                console.error('Image upload error:', error);
                return of({
                    progress: 0,
                    status: 'error' as const,
                    error: error.message
                });
            })
        );
    }

    // Método para upload multipart
    private uploadVideoMultipart(file: File): Observable<UploadProgress> {
        const progressSubject = new Subject<UploadProgress>();

        // Iniciar o upload em background
        this.multipartUploader.uploadFile(
            file,
            (progress, currentPart, totalParts) => {
                // Emitir progresso em tempo real
                const currentUpload = this.multipartUploader.getCurrentUpload();
                const progressEvent: UploadProgress = {
                    progress: Math.round(progress * 100),
                    status: 'uploading',
                    currentPart,
                    totalParts,
                    uploadId: currentUpload?.uploadId,
                    filename: currentUpload?.filename
                };
                progressSubject.next(progressEvent);
            },
            (uploadId, filename) => {
                // Emitir evento inicial com informações do upload
                const initEvent: UploadProgress = {
                    progress: 0,
                    status: 'uploading',
                    uploadId: uploadId,
                    filename: filename
                };
                progressSubject.next(initEvent);
            }
        ).then(response => {
            // Upload concluído com sucesso
            const completedEvent: UploadProgress = {
                progress: 100,
                status: 'completed',
                response: response
            };
            progressSubject.next(completedEvent);
            progressSubject.complete();
        }).catch(error => {
            // Erro no upload
            const errorEvent: UploadProgress = {
                progress: 0,
                status: 'error',
                error: error.message
            };
            progressSubject.next(errorEvent);
            progressSubject.complete();
        });

        return progressSubject.asObservable();
    }

    // Método simples sem progresso
    uploadVideoSimple(file: File): Observable<UploadResponse> {
        // Verificar se o arquivo é maior que 100MB
        if (file.size > this.multipartThreshold) {
            return from(this.multipartUploader.uploadFile(file, undefined, undefined));
        }

        const formData = new FormData();
        formData.append('file', file);

        return this.http.post<UploadResponse>(`${this.baseUrl}/upload`, formData);
    }

    // Método para cancelar upload multipart atual
    cancelCurrentMultipartUpload(): Observable<void> {
        return from(this.multipartUploader.abortCurrentUpload());
    }

    // Método para cancelar upload multipart específico
    abortMultipartUpload(filename: string, uploadId: string): Observable<void> {
        return from(this.multipartUploader.abortUpload(filename, uploadId));
    }

    // Listar arquivos
    listFiles(category?: 'image' | 'video', limit?: number): Observable<any> {
        let params = '';
        if (category) params += `category=${category}&`;
        if (limit) params += `limit=${limit}`;

        const url = `${this.baseUrl}/list${params ? '?' + params : ''}`;
        return this.http.get(url);
    }

    // Deletar arquivo
    deleteFile(filename: string): Observable<any> {
        return this.http.delete(`${this.baseUrl}/delete/${filename}`);
    }

    // Obter informações do arquivo
    getFileInfo(filename: string): Observable<any> {
        return this.http.get(`${this.baseUrl}/info?filename=${filename}`);
    }

    // Formatar tamanho do arquivo
    formatFileSize(bytes: number): string {
        if (bytes === 0) return '0 Bytes';

        const k = 1024;
        const sizes = ['Bytes', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));

        return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
    }

    // Validar tipo de arquivo de vídeo
    isValidVideoType(file: File): boolean {
        const allowedTypes = ['video/mp4', 'video/mpeg', 'video/quicktime', 'video/x-msvideo', 'video/webm'];
        return allowedTypes.includes(file.type);
    }

    // Validar tamanho do arquivo
    isValidFileSize(file: File, maxSizeMB: number = 100): boolean {
        const maxSize = maxSizeMB * 1024 * 1024;
        return file.size <= maxSize;
    }

    // Verificar se o arquivo precisa de upload multipart
    needsMultipartUpload(file: File): boolean {
        return file.size > this.multipartThreshold;
    }
} 