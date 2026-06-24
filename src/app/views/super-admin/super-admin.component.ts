import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, RouterModule } from '@angular/router';
import { AdminService, AdminUser } from '../../services/admin.service';

@Component({
    selector: 'app-super-admin',
    standalone: true,
    imports: [CommonModule, FormsModule, RouterModule],
    template: `
        <div class="super-admin-layout">
            <header class="sa-header">
                <div class="sa-header-left">
                    <h1>Super Admin</h1>
                    <span class="sa-badge">Administrador Principal</span>
                </div>
                <div class="sa-header-right">
                    <span class="sa-name">{{ admin?.name }}</span>
                    <button class="btn-logout" (click)="logout()">Sair</button>
                </div>
            </header>

            <main class="sa-content">
                <!-- Criar novo admin -->
                <section class="sa-section">
                    <h2>Criar Novo Admin</h2>
                    <form (ngSubmit)="createAdmin()" class="create-admin-form">
                        <div class="form-row">
                            <input type="text" [(ngModel)]="newAdmin.name" name="name" placeholder="Nome" required />
                            <input type="email" [(ngModel)]="newAdmin.email" name="email" placeholder="Email" required />
                            <input type="password" [(ngModel)]="newAdmin.password" name="password" placeholder="Senha" required />
                            <button type="submit" class="btn-create" [disabled]="creating">
                                {{ creating ? 'Criando...' : 'Criar Admin' }}
                            </button>
                        </div>
                        <div *ngIf="createError" class="error-msg">{{ createError }}</div>
                        <div *ngIf="createSuccess" class="success-msg">{{ createSuccess }}</div>
                    </form>
                </section>

                <!-- Lista de admins -->
                <section class="sa-section">
                    <h2>Admins Cadastrados</h2>
                    <div *ngIf="loading" class="loading">Carregando...</div>

                    <div *ngIf="!loading && admins.length === 0" class="empty">
                        Nenhum admin cadastrado.
                    </div>

                    <div class="admins-table" *ngIf="!loading && admins.length > 0">
                        <div class="admin-row header">
                            <span>Nome</span>
                            <span>Email</span>
                            <span>Tenant Hash</span>
                            <span>Cadastro</span>
                            <span>Ações</span>
                        </div>
                        <div class="admin-row" *ngFor="let a of admins">
                            <span>{{ a.name }}</span>
                            <span>{{ a.email }}</span>
                            <code>{{ a.tenant_hash?.slice(0, 12) }}...</code>
                            <span>{{ a.created_at | date:'dd/MM/yyyy' }}</span>
                            <span>
                                <a class="btn-link" (click)="openDashboard(a)">Abrir Dashboard</a>
                            </span>
                        </div>
                    </div>
                </section>
            </main>
        </div>
    `,
    styles: [`
        .super-admin-layout {
            min-height: 100vh;
            background: #0f0f13;
            color: #fff;
        }
        .sa-header {
            display: flex;
            align-items: center;
            justify-content: space-between;
            padding: 20px 32px;
            background: #1a1a23;
            border-bottom: 1px solid #2a2a35;
        }
        .sa-header-left {
            display: flex;
            align-items: center;
            gap: 12px;
        }
        .sa-header-left h1 { margin: 0; font-size: 20px; }
        .sa-badge {
            background: #6c5ce7;
            color: #fff;
            padding: 4px 10px;
            border-radius: 6px;
            font-size: 11px;
            font-weight: 600;
        }
        .sa-header-right {
            display: flex;
            align-items: center;
            gap: 16px;
        }
        .sa-name { color: #ccc; font-size: 14px; }
        .btn-logout {
            background: transparent;
            border: 1px solid #2a2a35;
            color: #888;
            padding: 8px 16px;
            border-radius: 8px;
            cursor: pointer;
            font-size: 13px;
        }
        .btn-logout:hover { border-color: #ff4757; color: #ff4757; }
        .sa-content { padding: 32px; max-width: 1100px; margin: 0 auto; }
        .sa-section {
            background: #1a1a23;
            border: 1px solid #2a2a35;
            border-radius: 12px;
            padding: 24px;
            margin-bottom: 24px;
        }
        .sa-section h2 { margin: 0 0 20px; font-size: 16px; }
        .create-admin-form .form-row {
            display: flex;
            gap: 12px;
            align-items: flex-end;
        }
        .create-admin-form input {
            flex: 1;
            background: #12121a;
            border: 1px solid #2a2a35;
            border-radius: 8px;
            padding: 10px 14px;
            color: #fff;
            font-size: 13px;
            outline: none;
        }
        .create-admin-form input:focus { border-color: #6c5ce7; }
        .btn-create {
            background: #6c5ce7;
            color: #fff;
            border: none;
            border-radius: 8px;
            padding: 10px 20px;
            font-size: 13px;
            font-weight: 600;
            cursor: pointer;
            white-space: nowrap;
        }
        .btn-create:disabled { opacity: .6; cursor: not-allowed; }
        .error-msg {
            background: rgba(255, 71, 87, .12);
            color: #ff4757;
            padding: 8px 12px;
            border-radius: 6px;
            font-size: 13px;
            margin-top: 12px;
        }
        .success-msg {
            background: rgba(46, 213, 115, .12);
            color: #2ed573;
            padding: 8px 12px;
            border-radius: 6px;
            font-size: 13px;
            margin-top: 12px;
        }
        .loading, .empty {
            text-align: center;
            color: #888;
            padding: 40px;
        }
        .admins-table {
            display: flex;
            flex-direction: column;
        }
        .admin-row {
            display: grid;
            grid-template-columns: 1fr 1fr 1fr 100px 140px;
            gap: 12px;
            align-items: center;
            padding: 12px 0;
            border-bottom: 1px solid #2a2a35;
            font-size: 13px;
        }
        .admin-row.header {
            color: #888;
            font-weight: 600;
            font-size: 12px;
            text-transform: uppercase;
        }
        .admin-row code {
            background: #12121a;
            padding: 2px 6px;
            border-radius: 4px;
            font-size: 12px;
            color: #6c5ce7;
        }
        .btn-link {
            color: #6c5ce7;
            cursor: pointer;
            text-decoration: none;
            font-weight: 500;
        }
        .btn-link:hover { text-decoration: underline; }
    `]
})
export class SuperAdminComponent implements OnInit {
    admin: AdminUser | null = null;
    admins: AdminUser[] = [];
    loading = true;
    creating = false;
    createError = '';
    createSuccess = '';
    newAdmin = { name: '', email: '', password: '' };

    constructor(
        private adminService: AdminService,
        private router: Router
    ) { }

    ngOnInit(): void {
        this.admin = this.adminService.getAdmin();
        this.loadAdmins();
    }

    loadAdmins(): void {
        this.loading = true;
        this.adminService.listAdmins().subscribe({
            next: (res) => {
                this.admins = res.data.admins.filter(a => !a.is_super_admin);
                this.loading = false;
            },
            error: () => this.loading = false
        });
    }

    createAdmin(): void {
        if (!this.newAdmin.name || !this.newAdmin.email || !this.newAdmin.password) {
            this.createError = 'Preencha todos os campos';
            return;
        }

        this.creating = true;
        this.createError = '';
        this.createSuccess = '';

        this.adminService.register(this.newAdmin.name, this.newAdmin.email, this.newAdmin.password).subscribe({
            next: () => {
                this.createSuccess = 'Admin criado com sucesso!';
                this.newAdmin = { name: '', email: '', password: '' };
                this.creating = false;
                this.loadAdmins();
            },
            error: (err) => {
                this.createError = err.message || 'Erro ao criar admin';
                this.creating = false;
            }
        });
    }

    openDashboard(admin: AdminUser): void {
        window.open(`/admin/${admin.tenant_hash}/dashboard`, '_blank');
    }

    logout(): void {
        this.adminService.logout();
        this.router.navigate(['/admin/login']);
    }
}
