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
                <div class="login-header">
                    <h1>Acesso do Colaborador</h1>
                    <p class="subtitle">Entre com suas credenciais</p>
                </div>

                <form (ngSubmit)="onSubmit()">
                    <div *ngIf="error" class="error-message">{{ error }}</div>

                    <div class="form-field">
                        <label for="email">Email</label>
                        <input id="email" type="email" [(ngModel)]="email" name="email" required
                            placeholder="seu@email.com" (input)="clearError()">
                    </div>

                    <div class="form-field">
                        <label for="password">Senha</label>
                        <input id="password" type="password" [(ngModel)]="password" name="password" required
                            placeholder="Sua senha" (input)="clearError()">
                    </div>

                    <button type="submit" class="btn-submit" [disabled]="isLoading">
                        <span *ngIf="!isLoading">Entrar</span>
                        <span *ngIf="isLoading" class="loading-content">
                            <span class="spinner"></span>
                            Entrando...
                        </span>
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
            padding: 20px;
        }
        .login-card {
            background: #30303099;
            border: 1px solid #FFFFFF1F;
            border-radius: 12px;
            padding: 3rem 2.5rem;
            width: 100%;
            max-width: 400px;
        }
        .login-header {
            text-align: center;
            margin-bottom: 2rem;
        }
        h1 {
            color: #ffffff;
            font-size: 1.1rem;
            font-weight: 400;
            margin: 0;
            opacity: 0.9;
        }
        .subtitle {
            color: #aaaaaa;
            font-size: 0.875rem;
            margin: 8px 0 0;
        }
        .form-field {
            margin-bottom: 1.5rem;
        }
        label {
            display: block;
            color: #aaaaaa;
            font-size: 0.875rem;
            margin-bottom: 8px;
        }
        input {
            width: 100%;
            padding: 1rem;
            background: #30303099;
            border: 1px solid #FFFFFF1F;
            border-radius: 6px;
            color: #EFEFEF;
            font-size: 0.95rem;
            transition: all 0.3s ease;
            box-sizing: border-box;
        }
        input::placeholder {
            color: #EFEFEF59;
            font-weight: 300;
        }
        input:focus {
            outline: none;
            border-color: #5b73e8;
            background: #4a4a4a;
            box-shadow: 0 0 0 3px rgba(91, 115, 232, 0.1);
        }
        input:hover:not(:disabled) {
            border-color: #666666;
        }
        .error-message {
            background: linear-gradient(135deg, #FF6B6B20, #FF545420);
            border: 1px solid #FF6B6B40;
            border-radius: 8px;
            padding: 0.875rem 1rem;
            margin-bottom: 1.5rem;
            color: #FF8A8A;
            font-size: 0.875rem;
            display: flex;
            align-items: center;
            gap: 0.5rem;
            animation: slideInDown 0.3s ease-out;
        }
        .btn-submit {
            width: 100%;
            padding: 1rem;
            background: #5E87FF;
            color: #0F0F0F;
            border: none;
            border-radius: 6px;
            font-size: 1rem;
            font-weight: 500;
            cursor: pointer;
            transition: all 0.3s ease;
            position: relative;
            overflow: hidden;
        }
        .btn-submit:hover:not(:disabled) {
            background: #4c63d2;
            transform: translateY(-1px);
            box-shadow: 0 4px 12px rgba(91, 115, 232, 0.3);
            color: #0F0F0F;
        }
        .btn-submit:active:not(:disabled) {
            transform: translateY(0);
        }
        .btn-submit:disabled {
            background: #555555;
            cursor: not-allowed;
            opacity: 0.6;
            color: #ffffff;
            transform: none;
        }
        .loading-content {
            display: flex;
            align-items: center;
            justify-content: center;
            gap: 0.5rem;
        }
        .spinner {
            display: inline-block;
            width: 16px;
            height: 16px;
            border: 2px solid #0F0F0F40;
            border-top: 2px solid #0F0F0F;
            border-radius: 50%;
            animation: spin 1s linear infinite;
        }
        @keyframes spin {
            0% { transform: rotate(0deg); }
            100% { transform: rotate(360deg); }
        }
        @keyframes slideInDown {
            from { opacity: 0; transform: translateY(-10px); }
            to { opacity: 1; transform: translateY(0); }
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

    clearError(): void {
        if (this.error) {
            this.error = '';
        }
    }

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
