import { Component, EventEmitter, Output, ChangeDetectionStrategy, ChangeDetectorRef, Input } from '@angular/core';
import { FormBuilder, FormGroup, Validators, ReactiveFormsModule } from '@angular/forms';
import { CommonModule } from '@angular/common';
import { of } from 'rxjs';
import { catchError, finalize } from 'rxjs/operators';
import { CollaboratorsService, CreateCollaboratorRequest } from '../../services/collaborators.service';
import { RolesService } from '../../services/roles.service';

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
    createdCollaborator: any = null;
    inviteUrl: string | null = null;

    roles: any[] = [];
    selectedRoleIds: number[] = [];

    constructor(
        private fb: FormBuilder,
        private cdr: ChangeDetectorRef,
        private collaboratorsService: CollaboratorsService,
        private rolesService: RolesService
    ) {
        this.collaboratorForm = this.fb.group({
            name: ['', [Validators.required, Validators.maxLength(100)]],
            email: ['', [Validators.required, Validators.email]],
            type: ['recruiter', Validators.required],
            creationMode: ['invite'],
            password: ['', [Validators.minLength(8)]],
        });

        this.loadRoles();
    }

    private loadRoles(): void {
        this.rolesService.getRoles().subscribe({
            next: (result) => {
                this.roles = result.roles || [];
                this.cdr.markForCheck();
            }
        });
    }

    get isInviteMode(): boolean {
        return this.collaboratorForm.get('creationMode')?.value === 'invite';
    }

    get isRecruiterSelected(): boolean {
        return this.collaboratorForm.get('type')?.value === 'recruiter';
    }

    toggleRole(roleId: number): void {
        const idx = this.selectedRoleIds.indexOf(roleId);
        if (idx >= 0) {
            this.selectedRoleIds.splice(idx, 1);
        } else {
            this.selectedRoleIds.push(roleId);
        }
    }

    onSubmit(): void {
        if (this.collaboratorForm.invalid) {
            this.collaboratorForm.markAllAsTouched();
            return;
        }

        if (!this.isInviteMode && !this.collaboratorForm.get('password')?.value) {
            this.error = 'Informe uma senha ou escolha "Link de convite".';
            this.cdr.markForCheck();
            return;
        }

        this.isLoading = true;
        this.error = null;
        this.successMessage = null;
        this.createdCollaborator = null;
        this.inviteUrl = null;
        this.cdr.markForCheck();

        const formValue = this.collaboratorForm.value;
        const data: CreateCollaboratorRequest = {
            name: formValue.name,
            email: formValue.email,
            type: formValue.type,
        };

        if (formValue.creationMode === 'invite') {
            data.generate_invite = true;
        } else {
            data.password = formValue.password;
        }

        this.collaboratorsService.createCollaborator(data).pipe(
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
                this.createdCollaborator = result;
                if (result.has_invite && result.invite_url) {
                    this.inviteUrl = result.invite_url;
                }

                if (this.isRecruiterSelected && this.selectedRoleIds.length > 0) {
                    this.collaboratorsService.assignRoles(result.id, this.selectedRoleIds).subscribe();
                }

                this.successMessage = 'Colaborador criado com sucesso!';
                this.collaboratorForm.reset({ type: 'recruiter', creationMode: 'invite' });
                this.selectedRoleIds = [];
                this.collaboratorCreated.emit(result);
                this.cdr.markForCheck();
            }
        });
    }

    copyInviteUrl(): void {
        if (this.inviteUrl) {
            navigator.clipboard.writeText(this.inviteUrl);
            this.successMessage = 'Link copiado!';
            this.cdr.markForCheck();
        }
    }

    onClose(): void {
        this.close.emit();
    }

    onInputChange(): void {
        if (this.error || this.successMessage) {
            this.error = null;
            this.successMessage = null;
            this.cdr.markForCheck();
        }
    }
}
