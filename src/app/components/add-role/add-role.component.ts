import { Component, EventEmitter, Output, ChangeDetectionStrategy, ChangeDetectorRef } from '@angular/core';
import { FormBuilder, FormGroup, Validators, ReactiveFormsModule } from '@angular/forms';
import { CommonModule } from '@angular/common';
import { of } from 'rxjs';
import { catchError, finalize } from 'rxjs/operators';
import { RolesService } from '../../services/roles.service';
import { AuthService } from '../../services/auth.service';
import { Role } from '../../models/role.model';

@Component({
    selector: 'app-add-role',
    standalone: true,
    imports: [CommonModule, ReactiveFormsModule],
    templateUrl: './add-role.component.html',
    styleUrls: ['./add-role.component.scss'],
    changeDetection: ChangeDetectionStrategy.OnPush
})
export class AddRoleComponent {
    @Output() close = new EventEmitter<void>();
    @Output() roleCreated = new EventEmitter<Role>();

    roleForm: FormGroup;
    isLoading = false;
    error: string | null = null;
    successMessage: string | null = null;

    constructor(
        private fb: FormBuilder,
        private cdr: ChangeDetectorRef,
        private rolesService: RolesService,
        private authService: AuthService
    ) {
        this.roleForm = this.fb.group({
            name: ['', [Validators.required, Validators.maxLength(100)]],
            active: [true],
            email: ['', [Validators.email]],
            phone: ['', [Validators.pattern(/^\(?\d{2}\)?\s?9?\d{4}-?\d{4}$/)]]
        });
    }

    onSubmit() {
        if (this.roleForm.invalid) {
            this.roleForm.markAllAsTouched();
            return;
        }

        this.isLoading = true;
        this.error = null;
        this.successMessage = null;
        this.cdr.markForCheck();

        const payload = {
            name: this.roleForm.get('name')?.value,
            active: this.roleForm.get('active')?.value,
            email: this.roleForm.get('email')?.value,
            phone: this.roleForm.get('phone')?.value
        };

        this.rolesService.createRole(payload).pipe(
            catchError((error: Error) => {
                this.error = error.message;
                this.cdr.markForCheck();
                return of(null);
            }),
            finalize(() => {
                this.isLoading = false;
                this.cdr.markForCheck();
            })
        ).subscribe((newRole: Role | null) => {
            if (newRole) {
                this.successMessage = 'Cargo criado com sucesso!';
                this.roleForm.reset();
                this.roleCreated.emit(newRole);

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