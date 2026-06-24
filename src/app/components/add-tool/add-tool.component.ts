import { Component, OnInit, Output, EventEmitter, ChangeDetectionStrategy, ChangeDetectorRef, Input } from '@angular/core';
import { FormBuilder, FormGroup, Validators, ReactiveFormsModule } from '@angular/forms';
import { CommonModule } from '@angular/common';
import { of } from 'rxjs';
import { catchError, finalize } from 'rxjs/operators';
import { ToolsService } from '../../services/tools.service';
import { Tool } from '../../models/tool.model';
import { HttpClient } from '@angular/common/http';
import { Role } from '../../models/role.model';
import { AuthService } from '../../services/auth.service';
import { AdminService } from '../../services/admin.service';

@Component({
    selector: 'app-add-tool',
    standalone: true,
    imports: [CommonModule, ReactiveFormsModule],
    templateUrl: './add-tool.component.html',
    styleUrls: ['./add-tool.component.scss'],
    changeDetection: ChangeDetectionStrategy.OnPush
})
export class AddToolComponent implements OnInit {
    @Output() close = new EventEmitter<void>();
    @Output() toolCreated = new EventEmitter<Tool>();
    @Output() toolUpdated = new EventEmitter<Tool>();
    @Input() cargo: Role | null = null;
    @Input() tool: Tool | null = null;

    get isEditing(): boolean {
        return this.tool !== null;
    }

    toolForm!: FormGroup;
    isLoading = false;
    error: string | null = null;

    // Image upload properties
    selectedImage: File | null = null;
    imagePreviewUrl: string | null = null;
    isUploadingImage = false;
    imageUploadError: string | null = null;
    uploadedImageUrl: string | null = null;
    private uploadAbortController: AbortController | null = null;

    private get tenantHash(): string {
        return this.adminService.getTenantHash() || '';
    }

    constructor(
        private fb: FormBuilder,
        private toolsService: ToolsService,
        private http: HttpClient,
        private cdr: ChangeDetectorRef,
        private authService: AuthService,
        private adminService: AdminService
    ) { }

    ngOnInit(): void {
        this.toolForm = this.fb.group({
            name: ['', [Validators.required, Validators.maxLength(150)]],
            description: [''],
            image_url: ['', [Validators.maxLength(255)]],
            link: ['', [Validators.required, Validators.maxLength(255), this.urlValidator()]]
        });

        if (this.isEditing && this.tool) {
            this.loadToolData(this.tool);
        }
    }

    private loadToolData(tool: Tool): void {
        this.toolForm.patchValue({
            name: tool.name,
            description: tool.description,
            image_url: tool.image_url,
            link: tool.link,
        });

        if (tool.image_url) {
            this.uploadedImageUrl = tool.image_url;
            this.imagePreviewUrl = tool.image_url;
        }
    }

    // Validador customizado para URL
    private urlValidator() {
        return (control: any): { [key: string]: any } | null => {
            if (!control.value) {
                return { required: true };
            }

            const url = control.value.trim();
            if (!url) {
                return { required: true };
            }

            // Verifica se a URL tem um formato básico válido
            const urlPattern = /^https?:\/\/.+/;
            if (!urlPattern.test(url)) {
                return { invalidUrl: true };
            }

            return null;
        };
    }

    // Getter para verificar se o botão deve estar habilitado
    get isFormValid(): boolean {
        const nameValid = this.toolForm.get('name')?.valid &&
            this.toolForm.get('name')?.value?.trim()?.length > 0;

        const linkValid = this.toolForm.get('link')?.valid &&
            this.toolForm.get('link')?.value?.trim()?.length > 0;

        const imageValid = this.isEditing || !!(
            this.uploadedImageUrl &&
            !this.isUploadingImage &&
            !this.imageUploadError);

        return !!(nameValid && linkValid && imageValid && !this.isLoading);
    }

    // Método para gerar tooltip do botão
    getButtonTooltip(): string {
        if (this.isLoading) {
            return this.isEditing ? 'Salvando...' : 'Criando ferramenta...';
        }

        const nameValid = this.toolForm.get('name')?.valid &&
            this.toolForm.get('name')?.value?.trim()?.length > 0;
        const linkValid = this.toolForm.get('link')?.valid &&
            this.toolForm.get('link')?.value?.trim()?.length > 0;
        const imageValid = this.isEditing || !!(
            this.uploadedImageUrl &&
            !this.isUploadingImage &&
            !this.imageUploadError);

        if (!nameValid) {
            return 'Preencha o nome da ferramenta';
        }
        if (!linkValid) {
            return 'Preencha uma URL válida';
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

        return this.isEditing ? 'Salvar alterações' : 'Criar ferramenta';
    }

    onSubmit(): void {
        if (this.toolForm.invalid) {
            this.toolForm.markAllAsTouched();
            return;
        }

        // Check if image is still uploading
        if (this.isUploadingImage) {
            this.error = 'Aguarde o upload da imagem ser concluído.';
            this.cdr.markForCheck();
            return;
        }

        // Check if there's an image upload error
        if (this.imageUploadError) {
            this.error = 'Corrija o erro no upload da imagem antes de continuar.';
            this.cdr.markForCheck();
            return;
        }

        this.isLoading = true;
        this.error = null;
        this.cdr.markForCheck();

        // Monta o payload incluindo o cargo atual
        let imageUrl = this.toolForm.value.image_url;
        if (imageUrl && !imageUrl.startsWith('http')) {
            imageUrl = `https://assets.userfounded.workers.dev/tools-assets/${this.tenantHash}/file/${imageUrl}`;
        }
        const payload = {
            ...this.toolForm.value,
            image_url: imageUrl,
        };

        if (this.isEditing && this.tool) {
            const token = this.authService.getToken() || '';
            this.toolsService.updateTool(this.tool.id, payload, token).pipe(
                catchError((err: Error) => {
                    this.error = err.message;
                    return of(null);
                }),
                finalize(() => {
                    this.isLoading = false;
                    this.cdr.markForCheck();
                })
            ).subscribe((updatedTool: Tool | null) => {
                if (updatedTool) {
                    this.toolUpdated.emit(updatedTool);
                }
            });
        } else {
            const payloadWithRoles = {
                ...payload,
                roles: this.cargo ? [this.cargo.id] : []
            };
            this.toolsService.createTool(payloadWithRoles).pipe(
                catchError((err: Error) => {
                    this.error = err.message;
                    return of(null);
                }),
                finalize(() => {
                    this.isLoading = false;
                    this.cdr.markForCheck();
                })
            ).subscribe((newTool: Tool | null) => {
                if (newTool) {
                    this.toolsService.addToolsToCache([newTool]);
                    this.toolCreated.emit(newTool);
                }
            });
        }
    }

    onClose(): void {
        // If there's an uploaded image and the form hasn't been submitted, delete the image
        if (this.uploadedImageUrl && !this.isLoading && !this.isEditing) {
            this.deleteImageFromServer();
        }

        // If image is currently uploading, cancel the upload
        if (this.isUploadingImage && this.uploadAbortController) {
            const subscription = (this.uploadAbortController as any).subscription;
            if (subscription) {
                subscription.unsubscribe();
            }
            this.uploadAbortController = null;
        }

        this.close.emit();
    }

    triggerFileInput(): void {
        const fileInput = document.getElementById('image_file') as HTMLInputElement;
        if (fileInput) {
            fileInput.click();
        }
    }

    onImageSelected(event: Event): void {
        let file: File | null = null;
        if (event && 'target' in event && (event.target as HTMLInputElement).files) {
            file = (event.target as HTMLInputElement).files?.[0] || null;
        } else if (event && 'files' in event) {
            file = (event as any).files?.[0] || null;
        }
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
            // Create preview
            const reader = new FileReader();
            reader.onload = (e) => {
                this.imagePreviewUrl = e.target?.result as string;
                this.cdr.markForCheck();
            };
            reader.readAsDataURL(file);
            // Upload image
            this.uploadImage(file);
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
            // Reutilizar lógica do onImageSelected
            this.onImageSelected({ target: { files: [file] } } as any);
        }
    }

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
        this.cdr.markForCheck();

        // Gerar nome de arquivo único
        const timestamp = Date.now();
        const fileExtension = file.name.split('.').pop();
        const fileName = `tool_${timestamp}.${fileExtension}`;

        // Montar FormData
        const formData = new FormData();
        formData.append('file', file, fileName);

        const url = `https://assets.userfounded.workers.dev/tools-assets/${this.tenantHash}/upload`;

        // Create a subscription that we can cancel
        const subscription = this.http.post<any>(url, formData).pipe(
            catchError((error) => {
                // Check if the error is due to cancellation
                if (error.name === 'AbortError' || error.status === 0) {
                    console.log('Upload cancelado pelo usuário');
                    return of(null);
                }

                console.error('Erro no upload da imagem:', error);
                this.imageUploadError = 'Erro ao fazer upload da imagem. Tente novamente.';
                return of(null);
            }),
            finalize(() => {
                this.isUploadingImage = false;
                this.uploadAbortController = null;
                this.cdr.markForCheck();
            })
        ).subscribe((response) => {
            if (response && response.success && response.file && response.file.url) {
                this.uploadedImageUrl = response.file.url;
                this.toolForm.patchValue({ image_url: this.uploadedImageUrl });
                this.cdr.markForCheck();
            } else if (response && response.error) {
                this.imageUploadError = response.error;
                this.cdr.markForCheck();
            } else if (response !== null) {
                // Only show error if response is not null (not cancelled)
                this.imageUploadError = 'Erro ao fazer upload da imagem. Tente novamente.';
                this.cdr.markForCheck();
            }
        });

        // Store the subscription in the abort controller for cancellation
        (this.uploadAbortController as any).subscription = subscription;
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
        this.toolForm.patchValue({ image_url: '' });
        // Reset file input
        const fileInput = document.getElementById('image_file') as HTMLInputElement;
        if (fileInput) {
            fileInput.value = '';
        }
        this.cdr.detectChanges();
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

        const deleteUrl = `https://assets.userfounded.workers.dev/tools-assets/${this.tenantHash}/delete/${imageName}`;

        this.http.delete(deleteUrl, {
            headers: {
                'Authorization': `Bearer ${token}`
            }
        }).pipe(
            catchError((error) => {
                console.error('Erro ao deletar imagem do servidor:', error);
                return of(null);
            })
        ).subscribe((response) => {
            console.log('Imagem deletada com sucesso:', response);
        });
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
} 