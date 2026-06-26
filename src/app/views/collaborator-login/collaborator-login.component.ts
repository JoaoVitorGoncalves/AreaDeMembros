import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { CollaboratorAuthService } from '../../services/collaborator-auth.service';
import { AdminService } from '../../services/admin.service';

@Component({
    selector: 'app-collaborator-login',
    standalone: true,
    imports: [CommonModule, FormsModule],
    template: `
        <div class="login-wrapper">
            <div class="login-card">
                <h1>Acesso do Colaborador</h1>
                <p class="subtitle">Entre com suas credenciais</p>

                <form (ngSubmit)="onSubmit()">
                    <div class="form-field">
                        <label for="email">Email</label>
                        <input id="email" type="email" [(ngModel)]="email" name="email" required
                            placeholder="seu@email.com">
                    </div>

                    <div class="form-field">
                        <label for="password">Senha</label>
                        <input id="password" type="password" [(ngModel)]="password" name="password" required
                            placeholder="Sua senha">
                    </div>

                    <div *ngIf="error" class="error-message">{{ error }}</div>

                    <button type="submit" class="btn-submit" [disabled]="isLoading">
                        <span *ngIf="!isLoading">Entrar</span>
                        <span *ngIf="isLoading" class="spinner"></span>
                    </button>
                </form>
            </div>
        </div>
    `,
    styles: [`
        .login-wrapper {
            display: flex;
            justify-content: center;
            align-items: center;
            min-height: 100vh;
            background: #0f0f0f;
        }
        .login-card {
            background: #18181B;
            border: 1px solid #27272A;
            border-radius: 16px;
            padding: 40px;
            width: 100%;
            max-width: 420px;
        }
        h1 {
            color: #FAFAFA;
            font-size: 24px;
            font-weight: 600;
            margin: 0 0 4px;
        }
        .subtitle {
            color: #A1A1AA;
            font-size: 14px;
            margin: 0 0 32px;
        }
        .form-field {
            margin-bottom: 20px;
        }
        label {
            display: block;
            color: #A1A1AA;
            font-size: 14px;
            margin-bottom: 8px;
        }
        input {
            width: 100%;
            padding: 12px 16px;
            background: #27272A;
            border: 1px solid #3F3F46;
            border-radius: 8px;
            color: #FAFAFA;
            font-size: 14px;
            box-sizing: border-box;
        }
        .error-message {
            color: #f87171;
            font-size: 14px;
            margin-bottom: 16px;
        }
        .btn-submit {
            width: 100%;
            padding: 12px;
            background: #4f46e5;
            color: white;
            border: none;
            border-radius: 8px;
            font-size: 16px;
            font-weight: 500;
            cursor: pointer;
        }
        .btn-submit:disabled {
            opacity: 0.5;
            cursor: not-allowed;
        }
        .spinner {
            display: inline-block;
            width: 16px;
            height: 16px;
            border: 2px solid rgba(255,255,255,0.3);
            border-top-color: white;
            border-radius: 50%;
            animation: spin 0.6s linear infinite;
        }
        @keyframes spin {
            to { transform: rotate(360deg); }
        }
    `]
})
export class CollaboratorLoginComponent {
    email = '';
    password = '';
    error = '';
    isLoading = false;

    constructor(
        private collaboratorAuth: CollaboratorAuthService,
        private adminService: AdminService,
        private router: Router
    ) { }

    onSubmit(): void {
        if (!this.email || !this.password) {
            this.error = 'Preencha todos os campos';
            return;
        }

        this.isLoading = true;
        this.error = '';

        this.collaboratorAuth.login(this.email, this.password).subscribe({
            next: (response) => {
                const hash = response.data.collaborator.tenant_hash;
                if (hash) {
                    this.router.navigate([`/admin/${hash}/dashboard`]);
                } else {
                    this.router.navigate(['/dashboard']);
                }
            },
            error: (err) => {
                this.error = err.message || 'Erro ao fazer login';
                this.isLoading = false;
            }
        });
    }
}
