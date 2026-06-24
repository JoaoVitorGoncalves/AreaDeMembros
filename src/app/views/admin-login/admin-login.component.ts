import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, RouterModule, ActivatedRoute } from '@angular/router';
import { AdminService } from '../../services/admin.service';

@Component({
    selector: 'app-admin-login',
    standalone: true,
    imports: [CommonModule, FormsModule, RouterModule],
    template: `
        <div class="admin-login-container">
            <div class="admin-login-card">
                <h1>Painel Administrativo</h1>
                <p class="subtitle">Faça login para acessar seu dashboard</p>

                <form (ngSubmit)="onSubmit()" class="admin-login-form">
                    <div class="form-group">
                        <label for="email">Email</label>
                        <input
                            id="email"
                            type="email"
                            [(ngModel)]="email"
                            name="email"
                            placeholder="seu@email.com"
                            required
                            autocomplete="email"
                        />
                    </div>

                    <div class="form-group">
                        <label for="password">Senha</label>
                        <input
                            id="password"
                            type="password"
                            [(ngModel)]="password"
                            name="password"
                            placeholder="Sua senha"
                            required
                            autocomplete="current-password"
                        />
                    </div>

                    <div *ngIf="error" class="error-message">{{ error }}</div>

                    <button type="submit" class="btn-submit" [disabled]="loading">
                        {{ loading ? 'Entrando...' : 'Entrar' }}
                    </button>
                </form>
            </div>
        </div>
    `,
    styles: [`
        .admin-login-container {
            display: flex;
            align-items: center;
            justify-content: center;
            min-height: 100vh;
            background: #0f0f13;
            padding: 20px;
        }
        .admin-login-card {
            background: #1a1a23;
            border: 1px solid #2a2a35;
            border-radius: 16px;
            padding: 48px 40px;
            width: 100%;
            max-width: 420px;
        }
        .admin-login-card h1 {
            color: #fff;
            font-size: 24px;
            margin: 0 0 8px;
        }
        .subtitle {
            color: #888;
            font-size: 14px;
            margin: 0 0 32px;
        }
        .admin-login-form {
            display: flex;
            flex-direction: column;
            gap: 20px;
        }
        .form-group {
            display: flex;
            flex-direction: column;
            gap: 6px;
        }
        .form-group label {
            color: #ccc;
            font-size: 13px;
            font-weight: 500;
        }
        .form-group input {
            background: #12121a;
            border: 1px solid #2a2a35;
            border-radius: 10px;
            padding: 12px 16px;
            color: #fff;
            font-size: 14px;
            outline: none;
            transition: border-color .2s;
        }
        .form-group input:focus {
            border-color: #6c5ce7;
        }
        .error-message {
            background: rgba(255, 71, 87, .12);
            color: #ff4757;
            padding: 10px 14px;
            border-radius: 8px;
            font-size: 13px;
        }
        .btn-submit {
            background: #6c5ce7;
            color: #fff;
            border: none;
            border-radius: 10px;
            padding: 14px;
            font-size: 15px;
            font-weight: 600;
            cursor: pointer;
            transition: background .2s;
        }
        .btn-submit:disabled {
            opacity: .6;
            cursor: not-allowed;
        }
        .btn-submit:not(:disabled):hover {
            background: #5b4bd6;
        }
    `]
})
export class AdminLoginComponent implements OnInit {
    email = '';
    password = '';
    loading = false;
    error = '';
    private tenantHash: string | null = null;

    constructor(
        private adminService: AdminService,
        private router: Router,
        private route: ActivatedRoute
    ) { }

    ngOnInit(): void {
        this.tenantHash = this.route.snapshot.paramMap.get('tenant_hash');
    }

    onSubmit(): void {
        if (!this.email || !this.password) {
            this.error = 'Preencha todos os campos';
            return;
        }

        this.loading = true;
        this.error = '';

        this.adminService.login(this.email, this.password).subscribe({
            next: (response) => {
                const admin = response.data.admin;
                const hash = admin.tenant_hash;
                if (admin.is_super_admin) {
                    this.router.navigate(['/super-admin']);
                } else if (this.tenantHash) {
                    this.router.navigate([`/admin/${hash}/dashboard`]);
                } else {
                    this.error = 'Acesso restrito. Use o login de usuário padrão.';
                    this.loading = false;
                    this.adminService.logout();
                }
            },
            error: (err) => {
                this.error = err.message || 'Erro ao fazer login';
                this.loading = false;
            }
        });
    }
}
