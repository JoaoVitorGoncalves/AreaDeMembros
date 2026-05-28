import { Component, EventEmitter, Output, Input, ChangeDetectionStrategy, ChangeDetectorRef } from '@angular/core';
import { FormBuilder, FormGroup, Validators, ReactiveFormsModule } from '@angular/forms';
import { CommonModule } from '@angular/common';
import { of } from 'rxjs';
import { catchError, finalize } from 'rxjs/operators';
import { UsersService } from '../../services/users.service';
import { AuthService } from '../../services/auth.service';
import { Role } from '../../models/role.model';



@Component({
    selector: 'app-add-user',
    standalone: true,
    imports: [CommonModule, ReactiveFormsModule],
    templateUrl: './add-user.component.html',
    styleUrls: ['./add-user.component.scss'],
    changeDetection: ChangeDetectionStrategy.OnPush
})
export class AddUserComponent {
    @Input() cargo: Role | null = null;
    @Output() close = new EventEmitter<void>();
    @Output() userCreated = new EventEmitter<any>();

    userForm: FormGroup;
    isLoading = false;
    error: string | null = null;
    successMessage: string | null = null;

    constructor(
        private fb: FormBuilder,
        private cdr: ChangeDetectorRef,
        private usersService: UsersService,
        private authService: AuthService
    ) {
        this.userForm = this.fb.group({
            name: ['', [Validators.required, Validators.maxLength(100)]],
            document: ['', [Validators.required, Validators.maxLength(20)]],
            phone: ['', [Validators.required, Validators.maxLength(20)]],
            email: ['', [Validators.required, Validators.email]],
            password: ['', [Validators.required, Validators.minLength(6)]]
        });
    }

    onSubmit() {
        if (this.userForm.invalid || !this.cargo) {
            this.userForm.markAllAsTouched();
            return;
        }

        this.isLoading = true;
        this.error = null;
        this.successMessage = null;
        this.cdr.markForCheck();

        // Prepara os dados para envio
        const formData = {
            ...this.userForm.value,
            role_id: this.cargo.id
        };

        // Validação de admin
        if (!this.authService.isAdmin()) {
            this.error = 'Acesso negado: apenas administradores podem criar usuários.';
            this.isLoading = false;
            this.cdr.markForCheck();
            return;
        }

        // Validação de token
        const token = this.authService.getToken();
        if (!token) {
            this.error = 'Token de autenticação não encontrado. Faça login novamente.';
            this.isLoading = false;
            this.cdr.markForCheck();
            return;
        }

        this.usersService.createUser(formData).pipe(
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
                this.successMessage = 'Usuário criado com sucesso!';
                this.userForm.reset();
                this.userCreated.emit(result);

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