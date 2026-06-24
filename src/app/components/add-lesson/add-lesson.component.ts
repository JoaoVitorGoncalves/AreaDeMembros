import { Component, EventEmitter, Output, Input, ChangeDetectionStrategy, ChangeDetectorRef, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, Validators, ReactiveFormsModule } from '@angular/forms';
import { HttpClient, HttpHeaders, HttpEvent, HttpRequest } from '@angular/common/http';
import { AuthService } from '../../services/auth.service';
import { AdminService } from '../../services/admin.service';
import { UploadService, UploadProgress, UploadResponse } from '../../services/upload.service';
import { of } from 'rxjs';
import { catchError, finalize, map, switchMap } from 'rxjs/operators';
import { environment } from '../../../environments/environment';


@Component({
    selector: 'app-add-lesson',
    standalone: true,
    imports: [CommonModule, ReactiveFormsModule],
    templateUrl: './add-lesson.component.html',
    styleUrls: ['./add-lesson.component.scss'],
    changeDetection: ChangeDetectionStrategy.OnPush
})
export class AddLessonComponent implements OnDestroy {
    @Input() moduleId: number | null = null;
    @Input() moduleName: string | null = null;
    @Input() lesson: any | null = null;
    @Output() close = new EventEmitter<void>();
    @Output() lessonCreated = new EventEmitter<any>();
    @Output() lessonUpdated = new EventEmitter<any>();

    get isEditing(): boolean {
        return this.lesson !== null;
    }

    lessonForm: FormGroup;
    isLoading = false;
    error: string | null = null;
    successMessage: string | null = null;
    private formSubmittedSuccessfully = false;

    selectedImage: File | null = null;
    imagePreviewUrl: string | null = null;
    imageUploadError: string | null = null;
    isUploadingImage = false;
    uploadedImageUrl: string | null = null;
    private uploadAbortController: AbortController | null = null;

    selectedVideo: File | null = null;
    videoPreviewUrl: string | null = null;
    videoUploadError: string | null = null;
    isUploadingVideo = false;
    uploadedVideoUrl: string | null = null;
    uploadProgress = 0;
    imageUploadProgress = 0;
    private videoUploadAbortController: AbortController | null = null;

    // Propriedades para upload multipart
    private currentMultipartUpload: { uploadId: string; filename: string } | null = null;
    private isMultipartUpload = false;

    // Listener para mudanças de seleção
    private selectionChangeListener = () => {
        this.forceButtonUpdate();
    };

    // Propriedade para controlar o foco do editor
    private isEditorFocused = false;

    private get tenantHash(): string {
        return this.adminService.getTenantHash() || '';
    }

    constructor(
        private fb: FormBuilder,
        private cdr: ChangeDetectorRef,
        private http: HttpClient,
        private authService: AuthService,
        private uploadService: UploadService,
        private adminService: AdminService
    ) {
        this.lessonForm = this.fb.group({
            name: ['', [Validators.required, Validators.maxLength(150)]],
            description: ['', [Validators.maxLength(500)]],
            thumbnail_url: [null],
            video_url: [null],
            module_id: [null]
        });
    }

    // Getter para verificar se o botão deve estar habilitado
    get isFormValid(): boolean {
        const nameValid = this.lessonForm.get('name')?.valid &&
            this.lessonForm.get('name')?.value?.trim()?.length > 0;

        const imageValid = this.isEditing || !!(
            this.uploadedImageUrl &&
            !this.isUploadingImage &&
            !this.imageUploadError);

        const videoValid = this.isEditing || !!(
            this.uploadedVideoUrl &&
            !this.isUploadingVideo &&
            !this.videoUploadError);

        return !!(nameValid && imageValid && videoValid && !this.isLoading);
    }

    // Método para gerar tooltip do botão
    getButtonTooltip(): string {
        if (this.isLoading) {
            return this.isEditing ? 'Salvando...' : 'Publicando aula...';
        }

        const nameValid = this.lessonForm.get('name')?.valid &&
            this.lessonForm.get('name')?.value?.trim()?.length > 0;

        const imageValid = this.isEditing || !!(
            this.uploadedImageUrl &&
            !this.isUploadingImage &&
            !this.imageUploadError);

        const videoValid = this.isEditing || !!(
            this.uploadedVideoUrl &&
            !this.isUploadingVideo &&
            !this.videoUploadError);

        if (!nameValid) {
            return 'Preencha o nome da aula';
        }
        if (!imageValid) {
            if (this.isUploadingImage) {
                return 'Aguarde o upload da imagem';
            }
            if (this.imageUploadError) {
                return 'Corrija o erro na imagem';
            }
            return 'Adicione uma imagem';
        }
        if (!videoValid) {
            if (this.isUploadingVideo) {
                return 'Aguarde o upload do vídeo';
            }
            if (this.videoUploadError) {
                return 'Corrija o erro no vídeo';
            }
            return 'Adicione um vídeo';
        }

        return this.isEditing ? 'Salvar alterações' : 'Publicar Aula';
    }

    ngOnInit(): void {
        // Reset form state
        this.resetFormState();

        // Set module_id if provided
        if (this.moduleId) {
            this.lessonForm.patchValue({ module_id: this.moduleId });
        }

        // If editing, pre-fill the form with lesson data
        if (this.isEditing && this.lesson) {
            this.loadLessonData(this.lesson);
        }

        // Add global listener for selection changes
        document.addEventListener('selectionchange', this.selectionChangeListener);

        // Initialize the editor after view is ready
        setTimeout(() => {
            this.initializeEditor();
        }, 100);
    }

    private loadLessonData(lessonData: any): void {
        this.lessonForm.patchValue({
            name: lessonData.name,
            description: lessonData.description,
        });
        if (lessonData.thumbnail_url) {
            this.uploadedImageUrl = lessonData.thumbnail_url;
            this.imagePreviewUrl = lessonData.thumbnail_url;
        }
        if (lessonData.video_url) {
            this.uploadedVideoUrl = lessonData.video_url;
            this.videoPreviewUrl = lessonData.video_url;
        }
    }

    private resetFormState(): void {
        this.formSubmittedSuccessfully = false;
        this.isLoading = false;
        this.error = null;
        this.successMessage = null;
    }

    // Método para inicializar o editor com valor existente
    private initializeEditor(): void {
        const editorContent = document.querySelector('.editor-content') as HTMLElement;
        if (editorContent) {
            const currentValue = this.lessonForm.get('description')?.value;
            if (currentValue && currentValue.trim()) {
                // Se o valor contém tags HTML, usar innerHTML, senão usar innerText
                if (currentValue.includes('<') && currentValue.includes('>')) {
                    editorContent.innerHTML = currentValue;
                } else {
                    editorContent.innerText = currentValue;
                }
            }
        }
    }

    onClose(): void {
        // If image is currently uploading, cancel the upload
        if (this.isUploadingImage && this.uploadAbortController) {
            const subscription = (this.uploadAbortController as any).subscription;
            if (subscription) {
                subscription.unsubscribe();
            }
            this.uploadAbortController = null;
        }

        // If video is currently uploading, cancel the upload
        if (this.isUploadingVideo) {
            if (this.isMultipartUpload && this.currentMultipartUpload) {
                // Cancelar upload multipart via POST
                this.uploadService.abortMultipartUpload(
                    this.currentMultipartUpload.filename,
                    this.currentMultipartUpload.uploadId
                ).subscribe({
                    error: (error) => {
                    }
                });
            } else if (this.videoUploadAbortController) {
                // Cancelar upload normal via AbortController
                const subscription = (this.videoUploadAbortController as any).subscription;
                if (subscription) {
                    subscription.unsubscribe();
                }
            }
            this.videoUploadAbortController = null;
            this.currentMultipartUpload = null;
            this.isMultipartUpload = false;
        }

        // If there's an uploaded image and the form hasn't been submitted, delete the image
        if (this.uploadedImageUrl && !this.isLoading && !this.formSubmittedSuccessfully) {
            this.deleteImageFromServer();
        }

        // If there's an uploaded video and the form hasn't been submitted, delete the video
        if (this.uploadedVideoUrl && !this.isLoading && !this.formSubmittedSuccessfully) {
            this.deleteVideoFromServer();
        }

        this.close.emit();
    }

    onInputChange(): void {
        this.error = null;
        this.successMessage = null;
        this.cdr.markForCheck();
    }

    // Métodos para o editor de texto rico
    onEditorInput(event: Event): void {
        const target = event.target as HTMLElement;

        // Capturar o HTML formatado
        const htmlContent = target.innerHTML;

        // Verificar se o conteúdo é apenas o placeholder
        const textContent = target.innerText || target.textContent || '';
        const isPlaceholder = textContent === 'Coloque a descrição aqui...' || textContent.trim() === '';

        // Se for placeholder ou vazio, salvar string vazia, senão salvar o HTML
        const contentToSave = isPlaceholder ? '' : htmlContent;

        // Atualizar o valor do formulário
        this.lessonForm.patchValue({ description: contentToSave });

        // Limpar mensagens de erro/sucesso
        this.error = null;
        this.successMessage = null;

        this.cdr.markForCheck();
    }

    onEditorBlur(): void {
        // Marcar o campo como tocado para validação
        this.lessonForm.get('description')?.markAsTouched();

        // Atualizar estado de foco
        this.isEditorFocused = false;
        this.forceButtonUpdate();
        this.cdr.markForCheck();
    }

    onEditorFocus(): void {
        // Atualizar estado de foco
        this.isEditorFocused = true;
        this.forceButtonUpdate();
    }

    // Métodos para formatação de texto
    formatText(command: string): void {
        const editorContent = document.querySelector('.editor-content') as HTMLElement;
        if (editorContent) {
            // Focar no editor antes de executar o comando
            editorContent.focus();

            // Executar o comando de formatação
            document.execCommand(command, false);

            // Atualizar o valor do formulário após formatação
            this.updateFormValue();

            // Forçar detecção de mudanças para atualizar os botões
            setTimeout(() => {
                this.forceButtonUpdate();
            }, 10);
        }
    }

    insertLink(): void {
        const editorContent = document.querySelector('.editor-content') as HTMLElement;
        if (editorContent) {
            editorContent.focus();

            // Verificar se há texto selecionado
            const selection = window.getSelection();
            if (selection && selection.rangeCount > 0) {
                const range = selection.getRangeAt(0);
                if (!range.collapsed) {
                    // Se há texto selecionado, usar o texto como URL ou um URL padrão
                    const selectedText = range.toString();
                    const url = selectedText.startsWith('http') ? selectedText : `https://${selectedText}`;

                    document.execCommand('createLink', false, url);
                    this.updateFormValue();
                    this.forceButtonUpdate();
                }
            }
        }
    }

    private updateFormValue(): void {
        const editorContent = document.querySelector('.editor-content') as HTMLElement;
        if (editorContent) {
            // Capturar o HTML formatado
            const htmlContent = editorContent.innerHTML;

            // Verificar se o conteúdo é apenas o placeholder
            const textContent = editorContent.innerText || editorContent.textContent || '';
            const isPlaceholder = textContent === 'Coloque a descrição aqui...' || textContent.trim() === '';

            // Se for placeholder ou vazio, salvar string vazia, senão salvar o HTML
            const contentToSave = isPlaceholder ? '' : htmlContent;

            this.lessonForm.patchValue({ description: contentToSave });
            this.cdr.markForCheck();
        }
    }

    // Método para verificar o estado dos botões de formatação
    updateButtonStates(): void {
        const editorContent = document.querySelector('.editor-content') as HTMLElement;
        if (!editorContent) return;

        // Verificar estado dos botões
        const buttons = document.querySelectorAll('.toolbar-btn');
        buttons.forEach((button, index) => {
            const isActive = this.isFormatActive(index);
            button.classList.toggle('active', isActive);
        });
    }

    private isFormatActive(buttonIndex: number): boolean {
        const editorContent = document.querySelector('.editor-content') as HTMLElement;
        if (!editorContent) return false;

        // Verificar se há seleção
        const selection = window.getSelection();
        if (!selection || selection.rangeCount === 0) return false;

        const range = selection.getRangeAt(0);
        if (range.collapsed) return false;

        // Verificar formatação baseada no índice do botão
        switch (buttonIndex) {
            case 0: // Bold
                return document.queryCommandState('bold');
            case 1: // Italic
                return document.queryCommandState('italic');
            case 2: // Left align
                return document.queryCommandState('justifyLeft');
            case 3: // Center align
                return document.queryCommandState('justifyCenter');
            case 4: // Right align
                return document.queryCommandState('justifyRight');
            default:
                return false;
        }
    }

    // Método para verificar se um comando específico está ativo
    isCommandActive(command: string): boolean {
        // Só retorna true se o editor estiver focado
        return this.isEditorFocused && document.queryCommandState(command);
    }

    // Método para forçar detecção de mudanças nos botões
    forceButtonUpdate(): void {
        this.cdr.detectChanges();
    }

    // --- IMAGE DRAG AND DROP ---
    onImageSelect(event: any): void {
        const file = event.target.files[0];
        if (file) {
            // Validate file type
            if (!file.type.startsWith('image/')) {
                this.imageUploadError = 'Por favor, selecione apenas arquivos de imagem.';
                this.cdr.markForCheck();
                return;
            }
            // Validate file size (max 5MB)
            if (file.size > 5 * 1024 * 1024) {
                this.imageUploadError = 'A imagem deve ter no máximo 5MB.';
                this.cdr.markForCheck();
                return;
            }
            this.selectedImage = file;
            this.imageUploadError = null;
            this.formSubmittedSuccessfully = false; // Reset flag when new file is selected

            // Create preview
            const reader = new FileReader();
            reader.onload = (e: any) => {
                this.imagePreviewUrl = e.target.result;
                this.cdr.markForCheck();
            };
            reader.readAsDataURL(file);

            // Upload image if user is admin
            if (this.authService.isAdmin() || this.adminService.isAuthenticated()) {
                this.uploadImage(file);
            }
        }
    }

    onDragOver(event: DragEvent): void {
        event.preventDefault();
        event.stopPropagation();
    }

    onDrop(event: DragEvent): void {
        event.preventDefault();
        event.stopPropagation();
        const files = event.dataTransfer?.files;
        if (files && files.length > 0) {
            const file = files[0];
            if (!file.type.startsWith('image/')) {
                this.imageUploadError = 'Por favor, selecione apenas arquivos de imagem.';
                this.cdr.markForCheck();
                return;
            }
            if (file.size > 5 * 1024 * 1024) {
                this.imageUploadError = 'A imagem deve ter no máximo 5MB.';
                this.cdr.markForCheck();
                return;
            }
            this.selectedImage = file;
            this.imageUploadError = null;

            const reader = new FileReader();
            reader.onload = (e: any) => {
                this.imagePreviewUrl = e.target.result;
                this.cdr.markForCheck();
            };
            reader.readAsDataURL(file);

            // Upload image if user is admin
            if (this.authService.isAdmin() || this.adminService.isAuthenticated()) {
                this.uploadImage(file);
            }
        }
    }

    removeImage(): void {
        // If image is currently uploading, cancel the upload
        if (this.isUploadingImage && this.uploadAbortController) {
            // Cancel the subscription
            const subscription = (this.uploadAbortController as any).subscription;
            if (subscription) {
                subscription.unsubscribe();
            }
            this.uploadAbortController = null;
            this.isUploadingImage = false;
            this.imageUploadError = null;
        }

        // If there's an uploaded image, delete it from the server
        if (this.uploadedImageUrl) {
            this.deleteImageFromServer();
        }

        this.selectedImage = null;
        this.imagePreviewUrl = null;
        this.uploadedImageUrl = null;
        this.imageUploadError = null;
        this.imageUploadProgress = 0;
        this.lessonForm.patchValue({ thumbnail_url: null });
        const fileInput = document.getElementById('lessonFileInput') as HTMLInputElement;
        if (fileInput) {
            fileInput.value = '';
        }
        this.cdr.markForCheck();
    }

    // --- VIDEO DRAG AND DROP ---
    onVideoSelect(event: any): void {
        const file = event.target.files[0];
        if (file) {
            // Validar tipo de arquivo usando UploadService
            if (!this.uploadService.isValidVideoType(file)) {
                this.videoUploadError = 'Tipo de arquivo não permitido. Selecione um vídeo válido (MP4, MPEG, MOV, AVI, WebM).';
                this.cdr.markForCheck();
                return;
            }

            // Validar tamanho usando UploadService (1GB max)
            if (!this.uploadService.isValidFileSize(file, 1024)) {
                this.videoUploadError = 'Arquivo muito grande. Tamanho máximo: 1GB';
                this.cdr.markForCheck();
                return;
            }

            this.selectedVideo = file;
            this.videoUploadError = null;
            this.formSubmittedSuccessfully = false; // Reset flag when new file is selected
            this.videoPreviewUrl = URL.createObjectURL(file);

            // Upload video if user is admin
            if (this.authService.isAdmin() || this.adminService.isAuthenticated()) {
                this.uploadVideo(file);
            }
        }

        // Limpar o input para permitir selecionar o mesmo arquivo novamente
        const fileInput = event.target as HTMLInputElement;
        if (fileInput) {
            fileInput.value = '';
        }
        this.cdr.markForCheck();
    }

    onVideoDragOver(event: DragEvent): void {
        event.preventDefault();
        event.stopPropagation();
    }

    onVideoDrop(event: DragEvent): void {
        event.preventDefault();
        event.stopPropagation();
        const files = event.dataTransfer?.files;
        if (files && files.length > 0) {
            const file = files[0];

            // Validar tipo de arquivo usando UploadService
            if (!this.uploadService.isValidVideoType(file)) {
                this.videoUploadError = 'Tipo de arquivo não permitido. Selecione um vídeo válido (MP4, MPEG, MOV, AVI, WebM).';
                this.cdr.markForCheck();
                return;
            }

            // Validar tamanho usando UploadService (1GB max)
            if (!this.uploadService.isValidFileSize(file, 1024)) {
                this.videoUploadError = 'Arquivo muito grande. Tamanho máximo: 1GB';
                this.cdr.markForCheck();
                return;
            }

            this.selectedVideo = file;
            this.videoUploadError = null;
            this.videoPreviewUrl = URL.createObjectURL(file);

            // Upload video if user is admin
            if (this.authService.isAdmin() || this.adminService.isAuthenticated()) {
                this.uploadVideo(file);
            }
        }
    }

    removeVideo(): void {
        // If video is currently uploading, cancel the upload
        if (this.isUploadingVideo) {
            if (this.isMultipartUpload && this.currentMultipartUpload) {
                // Cancelar upload multipart via POST
                this.uploadService.abortMultipartUpload(
                    this.currentMultipartUpload.filename,
                    this.currentMultipartUpload.uploadId
                ).subscribe({
                    next: () => {
                    },
                    error: (error) => {
                        console.error('Erro ao cancelar upload multipart:', error);
                    }
                });
            } else if (this.videoUploadAbortController) {
                // Cancelar upload normal via AbortController
                const subscription = (this.videoUploadAbortController as any).subscription;
                if (subscription) {
                    subscription.unsubscribe();
                }
            }
            this.videoUploadAbortController = null;
            this.currentMultipartUpload = null;
            this.isMultipartUpload = false;
            this.isUploadingVideo = false;
            this.videoUploadError = null;
        }

        // If there's an uploaded video, delete it from the server
        if (this.uploadedVideoUrl) {
            this.deleteVideoFromServer();
        }

        this.selectedVideo = null;
        this.videoPreviewUrl = null;
        this.uploadedVideoUrl = null;
        this.videoUploadError = null;
        this.isUploadingVideo = false;
        this.uploadProgress = 0;
        this.lessonForm.patchValue({ video_url: null });
        const fileInput = document.getElementById('lessonVideoInput') as HTMLInputElement;
        if (fileInput) {
            fileInput.value = '';
        }
        this.cdr.markForCheck();
    }

    // --- FORM SUBMISSION ---
    onSubmit(): void {

        if (!this.isFormValid) {
            this.markFormGroupTouched();
            return;
        }

        this.isLoading = true;
        this.error = null;
        this.successMessage = null;
        this.cdr.markForCheck();

        const token = this.authService.getToken();

        if (!token) {
            this.error = 'Token de autenticação não encontrado.';
            this.isLoading = false;
            this.cdr.markForCheck();
            return;
        }

        // Garantir que o module_id esteja preenchido
        if (!this.lessonForm.get('module_id')?.value && this.moduleId) {
            this.lessonForm.patchValue({ module_id: this.moduleId });
        }

        const formData = this.lessonForm.value;

        // Prepare payload for lesson creation – send full URL to backend
        const buildFullUrl = (url: string | null, prefix: string = ''): string | null => {
            if (!url) return null;
            if (url.startsWith('http')) return url;
            return `https://assets.userfounded.workers.dev/${prefix}${url}`;
        };
        const payload = {
            name: formData.name,
            description: formData.description || null,
            thumbnail_url: buildFullUrl(this.uploadedImageUrl || this.imagePreviewUrl),
            video_url: buildFullUrl(this.uploadedVideoUrl),
            module_id: this.moduleId || this.lessonForm.get('module_id')?.value
        };

        if (this.isEditing && this.lesson) {
            const updatePayload: any = {
                name: formData.name,
                description: formData.description || null,
            };
            if (this.uploadedImageUrl) {
                updatePayload.thumbnail_url = buildFullUrl(this.uploadedImageUrl);
            }
            if (this.uploadedVideoUrl) {
                updatePayload.video_url = buildFullUrl(this.uploadedVideoUrl);
            }

            this.http.put<any>(`${environment.apiUrl}/api/v1/lessons/${this.lesson.id}`, updatePayload, {
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                }
            }).pipe(
                catchError((error) => {
                    console.error('Erro ao atualizar aula:', error);
                    this.error = error.error?.message || 'Erro ao atualizar aula. Tente novamente.';
                    return of(null);
                }),
                finalize(() => {
                    this.isLoading = false;
                    this.cdr.markForCheck();
                })
            ).subscribe((response) => {
                if (response) {
                    const lessonData = {
                        ...this.lesson,
                        name: formData.name,
                        description: formData.description,
                        thumbnail_url: this.uploadedImageUrl || this.lesson.thumbnail_url,
                        video_url: this.uploadedVideoUrl || this.lesson.video_url,
                    };

                    this.successMessage = 'Aula atualizada com sucesso!';
                    this.lessonUpdated.emit(lessonData);
                    this.cdr.markForCheck();
                    this.formSubmittedSuccessfully = true;

                    setTimeout(() => {
                        this.onClose();
                    }, 1500);
                }
            });
        } else {
            // Create lesson via API
            this.http.post<any>(`${environment.apiUrl}/api/v1/lessons`, payload, {
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                }
            }).pipe(
                catchError((error) => {
                    console.error('Erro ao criar aula:', error);
                    this.error = error.error?.message || 'Erro ao criar aula. Tente novamente.';
                    return of(null);
                }),
                finalize(() => {
                    this.isLoading = false;
                    this.cdr.markForCheck();
                })
            ).subscribe((response) => {
                if (response) {
                    const lessonData = {
                        id: response.data?.id || Date.now(),
                        name: formData.name,
                        description: formData.description,
                        thumbnail_url: this.uploadedImageUrl ? `https://assets.userfounded.workers.dev/${this.uploadedImageUrl}` : (this.imagePreviewUrl || '/assets/images/default-lesson.jpg'),
                        video_url: this.uploadedVideoUrl ? `https://assets.userfounded.workers.dev/${this.uploadedVideoUrl}` : '',
                        module_id: this.moduleId
                    };

                    this.successMessage = 'Aula criada com sucesso!';
                    this.lessonCreated.emit(lessonData);
                    this.cdr.markForCheck();
                    this.formSubmittedSuccessfully = true; // Set flag to true on successful submission

                    // Close modal after success
                    setTimeout(() => {
                        this.onClose();
                    }, 1500);
                }
            });
        }
    }

    // --- UPLOAD METHODS ---
    private uploadImage(file: File): void {
        // Cancel any existing upload
        if (this.uploadAbortController) {
            const subscription = (this.uploadAbortController as any).subscription;
            if (subscription) {
                subscription.unsubscribe();
            }
            this.uploadAbortController = null;
        }

        // Create new abort controller for this upload
        this.uploadAbortController = new AbortController();

        this.isUploadingImage = true;
        this.imageUploadError = null;
        this.imageUploadProgress = 0;
        this.cdr.markForCheck();

        // Create a subscription that we can cancel
        const subscription = this.uploadService.uploadImage(file).subscribe({
            next: (progress: UploadProgress) => {
                this.imageUploadProgress = progress.progress;

                if (progress.status === 'completed' && progress.response) {
                    this.uploadedImageUrl = progress.response.file.url;
                    this.lessonForm.patchValue({ thumbnail_url: progress.response.file.url });
                    this.isUploadingImage = false;

                    // Mostrar sucesso
                    this.successMessage = `Imagem "${progress.response.file.originalName}" enviada com sucesso!`;

                    // Limpar mensagem de sucesso após 5 segundos
                    setTimeout(() => {
                        this.successMessage = null;
                        this.cdr.markForCheck();
                    }, 5000);
                } else if (progress.status === 'error') {
                    this.imageUploadError = `Erro no upload: ${progress.error || 'Erro desconhecido'}`;
                    this.isUploadingImage = false;
                    this.imageUploadProgress = 0;
                }

                this.cdr.markForCheck();
            },
            error: (error) => {
                // Check if the error is due to cancellation
                if (error.name === 'AbortError' || error.status === 0) {
                    return;
                }

                console.error('Image upload error in component:', error);
                this.imageUploadError = `Erro no upload: ${error.error?.message || error.message || 'Erro desconhecido'}`;
                this.isUploadingImage = false;
                this.imageUploadProgress = 0;
                this.cdr.markForCheck();
            },
            complete: () => {
                this.isUploadingImage = false;
                this.uploadAbortController = null;
                this.cdr.markForCheck();
            }
        });

        // Store the subscription in the abort controller for cancellation
        (this.uploadAbortController as any).subscription = subscription;
    }

    private uploadVideo(file: File): void {
        // Cancel any existing video upload
        if (this.videoUploadAbortController) {
            const subscription = (this.videoUploadAbortController as any).subscription;
            if (subscription) {
                subscription.unsubscribe();
            }
            this.videoUploadAbortController = null;
        }

        // Reset multipart upload info
        this.currentMultipartUpload = null;
        this.isMultipartUpload = false;

        // Create new abort controller for this video upload
        this.videoUploadAbortController = new AbortController();

        // Validar tipo de arquivo
        if (!this.uploadService.isValidVideoType(file)) {
            this.videoUploadError = 'Tipo de arquivo não permitido. Selecione um vídeo válido (MP4, MPEG, MOV, AVI, WebM).';
            this.cdr.markForCheck();
            return;
        }

        // Validar tamanho (1GB max)
        if (!this.uploadService.isValidFileSize(file, 1024)) {
            this.videoUploadError = 'Arquivo muito grande. Tamanho máximo: 1GB';
            this.cdr.markForCheck();
            return;
        }

        this.isUploadingVideo = true;
        this.videoUploadError = null;
        this.uploadProgress = 0;
        this.cdr.markForCheck();

        // Create a subscription that we can cancel
        const subscription = this.uploadService.uploadVideo(file).subscribe({
            next: (progress: UploadProgress) => {
                this.uploadProgress = progress.progress;

                // Armazenar informações do upload multipart se disponível
                if (progress.uploadId && progress.filename) {
                    this.currentMultipartUpload = {
                        uploadId: progress.uploadId,
                        filename: progress.filename
                    };
                    this.isMultipartUpload = true;
                }

                if (progress.status === 'completed' && progress.response) {
                    this.uploadedVideoUrl = progress.response.file.url;
                    this.lessonForm.patchValue({ video_url: progress.response.file.url });
                    this.isUploadingVideo = false;

                    // Limpar informações do upload multipart
                    this.currentMultipartUpload = null;
                    this.isMultipartUpload = false;

                    // Mostrar sucesso
                    this.successMessage = `Vídeo "${progress.response.file.originalName}" enviado com sucesso!`;

                    // Limpar mensagem de sucesso após 5 segundos
                    setTimeout(() => {
                        this.successMessage = null;
                        this.cdr.markForCheck();
                    }, 5000);
                } else if (progress.status === 'error') {
                    this.videoUploadError = `Erro no upload: ${progress.error || 'Erro desconhecido'}`;
                    this.isUploadingVideo = false;
                    this.uploadProgress = 0;

                    // Limpar informações do upload multipart
                    this.currentMultipartUpload = null;
                    this.isMultipartUpload = false;
                }

                this.cdr.markForCheck();
            },
            error: (error) => {
                // Check if the error is due to cancellation
                if (error.name === 'AbortError' || error.status === 0) {
                    return;
                }

                console.error('Upload error in component:', error);
                this.videoUploadError = `Erro no upload: ${error.error?.message || error.message || 'Erro desconhecido'}`;
                this.isUploadingVideo = false;
                this.uploadProgress = 0;

                // Limpar informações do upload multipart
                this.currentMultipartUpload = null;
                this.isMultipartUpload = false;

                this.cdr.markForCheck();
            },
            complete: () => {
                this.isUploadingVideo = false;
                this.videoUploadAbortController = null;
                this.cdr.markForCheck();
            }
        });

        // Store the subscription in the video abort controller for cancellation
        (this.videoUploadAbortController as any).subscription = subscription;
    }

    private deleteImageFromServer(): void {
        if (!this.uploadedImageUrl) return;

        // Extract image name from the URL
        const imageName = this.extractImageNameFromUrl(this.uploadedImageUrl);
        if (!imageName) return;

        const token = this.authService.getToken();
        if (!token) {
            console.error('Token não encontrado para deletar imagem');
            return;
        }

        const deleteUrl = `https://assets.userfounded.workers.dev/${this.tenantHash}/delete/${imageName}`;

        this.http.delete(deleteUrl, {
            headers: {
                'Authorization': `Bearer ${token}`
            }
        }).pipe(
            catchError((error) => {
                console.error('Erro ao deletar imagem do servidor:', error);
                return of(null);
            })
        ).subscribe();
    }

    private deleteVideoFromServer(): void {
        if (!this.uploadedVideoUrl) return;

        // Extract video name from the URL
        const videoName = this.extractVideoNameFromUrl(this.uploadedVideoUrl);
        if (!videoName) return;

        const token = this.authService.getToken();
        if (!token) {
            console.error('Token não encontrado para deletar vídeo');
            return;
        }

        const deleteUrl = `https://assets.userfounded.workers.dev/${this.tenantHash}/delete/${videoName}`;

        this.http.delete(deleteUrl, {
            headers: {
                'Authorization': `Bearer ${token}`
            }
        }).pipe(
            catchError((error) => {
                console.error('Erro ao deletar vídeo do servidor:', error);
                return of(null);
            })
        ).subscribe();
    }

    private extractImageNameFromUrl(url: string): string | null {
        try {
            // Extract the filename from the URL
            const urlParts = url.split('/');
            const fileName = urlParts[urlParts.length - 1];

            // Remove query parameters if any
            const cleanFileName = fileName.split('?')[0];

            return cleanFileName || null;
        } catch (error) {
            console.error('Erro ao extrair nome da imagem da URL:', error);
            return null;
        }
    }

    private extractVideoNameFromUrl(url: string): string | null {
        try {
            // Extract the filename from the URL
            const urlParts = url.split('/');
            const fileName = urlParts[urlParts.length - 1];

            // Remove query parameters if any
            const cleanFileName = fileName.split('?')[0];

            return cleanFileName || null;
        } catch (error) {
            console.error('Erro ao extrair nome do vídeo da URL:', error);
            return null;
        }
    }

    private markFormGroupTouched(): void {
        Object.keys(this.lessonForm.controls).forEach(key => {
            const control = this.lessonForm.get(key);
            control?.markAsTouched();
        });
    }

    ngOnDestroy(): void {
        document.removeEventListener('selectionchange', this.selectionChangeListener);
    }
} 