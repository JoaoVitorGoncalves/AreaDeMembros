import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { CollaboratorAuthService } from '../../services/collaborator-auth.service';

@Component({
    selector: 'app-collaborator-invite',
    standalone: true,
    imports: [CommonModule, FormsModule],
    template: `
        <div class="invite-wrapper">
            <div class="login-card">
                <div class="login-header">
                    <h1>Convite de Colaborador</h1>
                    <p class="subtitle">Você foi convidado a colaborar no projeto. Defina seus dados para começar.</p>
                </div>

                <form (ngSubmit)="onSubmit()">
                    <div *ngIf="error" class="error-message">{{ error }}</div>

                    <div class="form-field">
                        <label for="invite-password">Senha</label>
                        <input id="invite-password" type="password" [(ngModel)]="password" name="password" required
                            placeholder="Mínimo 8 caracteres" (input)="clearError()">
                    </div>

                    <div class="form-field">
                        <label for="invite-confirm">Confirmar Senha</label>
                        <input id="invite-confirm" type="password" [(ngModel)]="confirmPassword" name="confirmPassword"
                            required placeholder="Repita a senha" (input)="clearError()">
                    </div>

                    <button type="submit" class="btn-submit" [disabled]="isLoading">
                        <span *ngIf="!isLoading">Aceitar Convite</span>
                        <span *ngIf="isLoading" class="loading-content">
                            <span class="spinner"></span>
                            Aguarde...
                        </span>
                    </button>
                </form>
            </div>
        </div>
    `,
    styles: [`
        .invite-wrapper {
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
export class CollaboratorInviteComponent {
    password = '';
    confirmPassword = '';
    error = '';
    isLoading = false;

    constructor(
        private route: ActivatedRoute,
        private router: Router,
        private collaboratorAuth: CollaboratorAuthService
    ) { }

    clearError(): void {
        if (this.error) {
            this.error = '';
        }
    }

    onSubmit(): void {
        if (!this.password || !this.confirmPassword) {
            this.error = 'Preencha todos os campos';
            return;
        }

        if (this.password.length < 8) {
            this.error = 'A senha deve ter no mínimo 8 caracteres';
            return;
        }

        if (this.password !== this.confirmPassword) {
            this.error = 'As senhas não conferem';
            return;
        }

        const token = this.route.snapshot.paramMap.get('token');
        if (!token) {
            this.error = 'Link de convite inválido';
            return;
        }

        this.isLoading = true;
        this.error = '';

        // Only send password - name/email are already stored on the backend
        this.collaboratorAuth.acceptInviteAsCollaborator(
            token,
            this.password
        ).subscribe({
            next: (response) => {
                const hash = response.data.collaborator.tenant_hash;
                if (hash) {
                    this.router.navigate([`/admin/${hash}/dashboard`]);
                } else {
                    this.router.navigate(['/dashboard']);
                }
            },
            error: (err) => {
                this.error = err.message || 'Erro ao aceitar convite';
                this.isLoading = false;
            }
        });
    }
}

