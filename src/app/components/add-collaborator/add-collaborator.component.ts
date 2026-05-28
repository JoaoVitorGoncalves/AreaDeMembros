import { Component, EventEmitter, Output, ChangeDetectionStrategy, ChangeDetectorRef } from '@angular/core';
import { FormBuilder, FormGroup, Validators, ReactiveFormsModule } from '@angular/forms';
import { CommonModule } from '@angular/common';
import { of } from 'rxjs';
import { catchError, finalize } from 'rxjs/operators';
import { CollaboratorsService, CreateCollaboratorRequest } from '../../services/collaborators.service';

@Component({
    selector: 'app-add-collaborator',
    standalone: true,
    imports: [CommonModule, ReactiveFormsModule],
    templateUrl: './add-collaborator.component.html',
    styleUrls: ['./add-collaborator.component.scss'],
    changeDetection: ChangeDetectionStrategy.OnPush
})
export class AddCollaboratorComponent {
    @Output() close = new EventEmitter<void>();
    @Output() collaboratorCreated = new EventEmitter<any>();

    collaboratorForm: FormGroup;
    isLoading = false;
    error: string | null = null;
    successMessage: string | null = null;

    constructor(
        private fb: FormBuilder,
        private cdr: ChangeDetectorRef,
        private collaboratorsService: CollaboratorsService
    ) {
        this.collaboratorForm = this.fb.group({
            name: ['', [Validators.required, Validators.maxLength(100)]],
            document: ['', [Validators.required, Validators.maxLength(20)]],
            phone: ['', [Validators.required, Validators.maxLength(20)]],
            email: ['', [Validators.required, Validators.email]],
            password: ['', [Validators.required, Validators.minLength(6)]]
        });
    }

    onSubmit() {
        if (this.collaboratorForm.invalid) {
            this.collaboratorForm.markAllAsTouched();
            return;
        }

        this.isLoading = true;
        this.error = null;
        this.successMessage = null;
        this.cdr.markForCheck();

        // Prepara os dados para envio
        const formData: CreateCollaboratorRequest = {
            ...this.collaboratorForm.value,
            role: 'Adm',
            permissions: ['all']
        };

        this.collaboratorsService.createCollaborator(formData).pipe(
            catchError((error: Error) => {
                this.error = error.message;
                this.cdr.markForCheck();
                return of(null);
            }),
            finalize(() => {
                this.isLoading = false;
                this.cdr.markForCheck();
            })
        ).subscribe((result) => {
            if (result) {
                this.successMessage = 'Colaborador criado com sucesso!';
                this.collaboratorForm.reset();
                this.collaboratorCreated.emit(result);

                // Limpa a mensagem de sucesso após 3 segundos
                setTimeout(() => {
                    this.successMessage = null;
                    this.cdr.markForCheck();
                }, 3000);
            }
        });
    }

    onClose() {
        this.close.emit();
    }

    // Método para limpar mensagens de erro/sucesso quando o usuário começa a digitar
    onInputChange() {
        if (this.error || this.successMessage) {
            this.error = null;
            this.successMessage = null;
            this.cdr.markForCheck();
        }
    }
} 