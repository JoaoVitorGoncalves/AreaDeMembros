import { Component, EventEmitter, Output, Input, ChangeDetectionStrategy, ChangeDetectorRef } from '@angular/core';
import { FormBuilder, FormGroup, Validators, ReactiveFormsModule } from '@angular/forms';
import { CommonModule } from '@angular/common';
import { of } from 'rxjs';
import { catchError, finalize } from 'rxjs/operators';
import { Role } from '../../models/role.model';
import { ModuleService } from '../../services/module.service';
import { HttpClient } from '@angular/common/http';
import { AuthService } from '../../services/auth.service';
import { environment } from '../../../environments/environment';

@Component({
    selector: 'app-add-module',
    standalone: true,
    imports: [CommonModule, ReactiveFormsModule],
    templateUrl: './add-module.component.html',
    styleUrls: ['./add-module.component.scss'],
    changeDetection: ChangeDetectionStrategy.OnPush
})
export class AddModuleComponent {
    @Input() cargo: Role | null = null;
    @Input() module: any | null = null;
    @Output() close = new EventEmitter<void>();
    @Output() moduleCreated = new EventEmitter<any>();
    @Output() moduleUpdated = new EventEmitter<any>();

    get isEditing(): boolean {
        return this.module !== null;
    }

    moduleForm: FormGroup;
    isLoading = false;
    error: string | null = null;
    successMessage: string | null = null;

    // Image upload properties
    selectedImage: File | null = null;
    imagePreviewUrl: string | null = null;
    isUploadingImage = false;
    imageUploadError: string | null = null;
    uploadedImageUrl: string | null = null;
    private uploadAbortController: AbortController | null = null;

    constructor(
        private fb: FormBuilder,
        private cdr: ChangeDetectorRef,
        private moduleService: ModuleService,
        private http: HttpClient,
        private authService: AuthService
    ) {
        this.moduleForm = this.fb.group({
            name: ['', [Validators.required, Validators.maxLength(100)]],
            cover: [null]
        });
    }

    ngOnInit(): void {
        if (this.isEditing && this.module) {
            this.loadModuleData(this.module);
        }
    }

    private loadModuleData(moduleData: any): void {
        const imageUrl = moduleData.thumbnail_url || moduleData.image_path || '';
        this.moduleForm.patchValue({ name: moduleData.name });
        if (imageUrl) {
            this.uploadedImageUrl = imageUrl;
            this.imagePreviewUrl = imageUrl;
        }
    }

    // Getter para verificar se o botão deve estar habilitado
    get isFormValid(): boolean {
        const nameValid = this.moduleForm.get('name')?.valid &&
            this.moduleForm.get('name')?.value?.trim()?.length > 0;

        const imageValid = this.isEditing || !!(
            this.uploadedImageUrl &&
            !this.isUploadingImage &&
            !this.imageUploadError);

        return !!(nameValid && imageValid && !this.isLoading);
    }

    // Método para gerar tooltip do botão
    getButtonTooltip(): string {
        if (this.isLoading) {
            return this.isEditing ? 'Salvando...' : 'Criando módulo...';
        }

        const nameValid = this.moduleForm.get('name')?.valid &&
            this.moduleForm.get('name')?.value?.trim()?.length > 0;

        const imageValid = this.isEditing || !!(
            this.uploadedImageUrl &&
            !this.isUploadingImage &&
            !this.imageUploadError);

        if (!nameValid) {
            return 'Preencha o nome do módulo';
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

        return this.isEditing ? 'Salvar alterações' : 'Criar módulo';
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

        // If there's an uploaded image and the form hasn't been submitted successfully, delete the image
        if (this.uploadedImageUrl && !this.isLoading && !this.successMessage) {
            this.deleteImageFromServer();
        }

        this.close.emit();
    }

    onInputChange(): void {
        this.error = null;
        this.successMessage = null;
        this.cdr.markForCheck();
    }

    onImageSelect(event: any): void {
        const file = event.target.files[0];
        if (file) {
            // Validate file type
            if (!file.type.startsWith('image/')) {
                this.imageUploadError = 'Por favor, selecione apenas arquivos de imagem.';
                this.cdr.markForCheck();
                return;
            }

            // Validate file size (5MB)
            if (file.size > 5 * 1024 * 1024) {
                this.imageUploadError = 'A imagem deve ter no máximo 5MB.';
                this.cdr.markForCheck();
                return;
            }

            this.selectedImage = file;
            this.imageUploadError = null;

            // Create preview
            const reader = new FileReader();
            reader.onload = (e: any) => {
                this.imagePreviewUrl = e.target.result;
                this.cdr.markForCheck();
            };
            reader.readAsDataURL(file);

            // Update form
            this.moduleForm.patchValue({ cover: file });

            // Upload image if user is admin
            if (this.authService.isAdmin()) {
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
            if (file.type.startsWith('image/')) {
                if (file.size <= 5 * 1024 * 1024) {
                    this.selectedImage = file;
                    this.imageUploadError = null;

                    // Create preview
                    const reader = new FileReader();
                    reader.onload = (e: any) => {
                        this.imagePreviewUrl = e.target.result;
                        this.cdr.markForCheck();
                    };
                    reader.readAsDataURL(file);

                    // Update form
                    this.moduleForm.patchValue({ cover: file });

                    // Upload image if user is admin
                    if (this.authService.isAdmin()) {
                        this.uploadImage(file);
                    }
                } else {
                    this.imageUploadError = 'A imagem deve ter no máximo 5MB.';
                }
            } else {
                this.imageUploadError = 'Por favor, selecione apenas arquivos de imagem.';
            }
            this.cdr.markForCheck();
        }
    }

    onSubmit(): void {
        if (!this.isFormValid) {
            this.markFormGroupTouched();
            return;
        }

        this.isLoading = true;
        this.error = null;
        this.successMessage = null;
        this.cdr.markForCheck();

        const formData = this.moduleForm.value;
        const token = this.authService.getToken();

        if (!token) {
            this.error = 'Token de autenticação não encontrado.';
            this.isLoading = false;
            this.cdr.markForCheck();
            return;
        }

        // Prepare payload for module creation
        const payload = {
            name: formData.name,
            image_path: `https://assets.userfounded.workers.dev/module-assets/file/${this.uploadedImageUrl}` || `https://assets.userfounded.workers.dev/module-assets/file/${this.imagePreviewUrl}`,
            role_name: this.cargo?.name || '',
            role_id: this.cargo?.id
        };

        if (this.isEditing && this.module) {
            const updatePayload = {
                name: formData.name,
                image_path: payload.image_path,
            };
            this.moduleService.updateModule(this.module.id, updatePayload, token).pipe(
                catchError((error) => {
                    console.error('Erro ao atualizar módulo:', error);
                    this.error = error?.message || 'Erro ao atualizar módulo. Tente novamente.';
                    return of(null);
                }),
                finalize(() => {
                    this.isLoading = false;
                    this.cdr.markForCheck();
                })
            ).subscribe((response) => {
                if (response) {
                    const moduleData = {
                        id: this.module.id,
                        name: formData.name,
                        thumbnail_url: this.uploadedImageUrl || this.imagePreviewUrl || this.module.thumbnail_url,
                        contentCount: this.module.contentCount || 0,
                        cargoId: this.cargo?.id
                    };
                    this.successMessage = 'Módulo atualizado com sucesso!';
                    this.moduleUpdated.emit(moduleData);
                    this.cdr.markForCheck();
                    setTimeout(() => this.onClose(), 1500);
                }
            });
        } else {
            // Create module via ModuleService
            this.moduleService.createModule(payload).pipe(
                catchError((error) => {
                    console.error('Erro ao criar módulo:', error);
                    this.error = error?.message || 'Erro ao criar módulo. Tente novamente.';
                    return of(null);
                }),
                finalize(() => {
                    this.isLoading = false;
                    this.cdr.markForCheck();
                })
            ).subscribe((response) => {
                if (response) {
                    const moduleData = {
                        id: response.data?.id || Date.now(),
                        name: formData.name,
                        thumbnail_url: this.uploadedImageUrl || this.imagePreviewUrl || '/assets/images/default-module.jpg',
                        contentCount: 0,
                        cargoId: this.cargo?.id
                    };

                    this.successMessage = 'Módulo criado com sucesso!';
                    this.moduleCreated.emit(moduleData);
                    this.cdr.markForCheck();

                    // Close modal after success
                    setTimeout(() => {
                        this.onClose();
                    }, 1500);
                }
            });
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
        const fileName = `module_${timestamp}.${fileExtension}`;

        // Montar FormData
        const formData = new FormData();
        formData.append('file', file, fileName);

        const url = 'https://assets.userfounded.workers.dev/module-assets/upload';

        // Create a subscription that we can cancel
        const subscription = this.http.post<any>(url, formData).pipe(
            catchError((error) => {
                // Check if the error is due to cancellation
                if (error.name === 'AbortError' || error.status === 0) {
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
                this.moduleForm.patchValue({ cover: this.uploadedImageUrl });
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
        this.moduleForm.patchValue({ cover: '' });

        // Reset file input
        const fileInput = document.getElementById('fileInput') as HTMLInputElement;
        if (fileInput) {
            fileInput.value = '';
        }

        this.cdr.markForCheck();
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

        const deleteUrl = `https://assets.userfounded.workers.dev/module-assets/delete/${imageName}`;

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

    private markFormGroupTouched(): void {
        Object.keys(this.moduleForm.controls).forEach(key => {
            const control = this.moduleForm.get(key);
            control?.markAsTouched();
        });
    }
} 