import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterModule } from '@angular/router';
import { AdminService, AdminUser } from '../../services/admin.service';
import { RolesService } from '../../services/roles.service';
import { Role } from '../../models/role.model';

@Component({
    selector: 'app-admin-dashboard',
    standalone: true,
    imports: [CommonModule, RouterModule],
    template: `
        <div class="admin-tenant-layout">
            <header class="admin-tenant-header">
                <div class="header-left">
                    <h1>Dashboard</h1>
                    <span class="tenant-badge">{{ admin?.tenant_hash?.slice(0, 8) }}...</span>
                </div>
                <div class="header-right">
                    <span class="admin-name">{{ admin?.name }}</span>
                    <button class="btn-logout" (click)="logout()">Sair</button>
                </div>
            </header>

            <main class="admin-tenant-content">
                <div *ngIf="loading" class="loading">Carregando...</div>

                <div *ngIf="!loading" class="stats-grid">
                    <div class="stat-card">
                        <div class="stat-value">{{ stats.roles_count }}</div>
                        <div class="stat-label">Cursos</div>
                    </div>
                    <div class="stat-card">
                        <div class="stat-value">{{ stats.modules_count }}</div>
                        <div class="stat-label">Módulos</div>
                    </div>
                    <div class="stat-card">
                        <div class="stat-value">{{ stats.users_count }}</div>
                        <div class="stat-label">Usuários</div>
                    </div>
                    <div class="stat-card">
                        <div class="stat-value">{{ stats.tools_count }}</div>
                        <div class="stat-label">Ferramentas</div>
                    </div>
                </div>

                <section class="cursos-section" *ngIf="!loading">
                    <h2>Seus Cursos</h2>
                    <div *ngIf="roles.length === 0" class="empty-state">
                        Nenhum curso cadastrado ainda.
                    </div>
                    <div class="cursos-grid">
                        <div class="curso-card" *ngFor="let role of roles">
                            <div class="curso-info">
                                <h3>{{ role.name }}</h3>
                                <span class="curso-users">{{ role.users_count || 0 }} usuários</span>
                            </div>
                            <span class="curso-status" [class.active]="role.active">
                                {{ role.active ? 'Ativo' : 'Inativo' }}
                            </span>
                        </div>
                    </div>
                </section>
            </main>
        </div>
    `,
    styles: [`
        .admin-tenant-layout {
            min-height: 100vh;
            background: #0f0f13;
            color: #fff;
        }
        .admin-tenant-header {
            display: flex;
            align-items: center;
            justify-content: space-between;
            padding: 20px 32px;
            background: #1a1a23;
            border-bottom: 1px solid #2a2a35;
        }
        .header-left {
            display: flex;
            align-items: center;
            gap: 12px;
        }
        .header-left h1 {
            margin: 0;
            font-size: 20px;
        }
        .tenant-badge {
            background: #2a2a35;
            color: #888;
            padding: 4px 10px;
            border-radius: 6px;
            font-size: 12px;
            font-family: monospace;
        }
        .header-right {
            display: flex;
            align-items: center;
            gap: 16px;
        }
        .admin-name {
            color: #ccc;
            font-size: 14px;
        }
        .btn-logout {
            background: transparent;
            border: 1px solid #2a2a35;
            color: #888;
            padding: 8px 16px;
            border-radius: 8px;
            cursor: pointer;
            font-size: 13px;
        }
        .btn-logout:hover {
            border-color: #ff4757;
            color: #ff4757;
        }
        .admin-tenant-content {
            padding: 32px;
            max-width: 1200px;
            margin: 0 auto;
        }
        .loading {
            text-align: center;
            color: #888;
            padding: 60px;
        }
        .stats-grid {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
            gap: 16px;
            margin-bottom: 40px;
        }
        .stat-card {
            background: #1a1a23;
            border: 1px solid #2a2a35;
            border-radius: 12px;
            padding: 24px;
            text-align: center;
        }
        .stat-value {
            font-size: 32px;
            font-weight: 700;
            color: #6c5ce7;
        }
        .stat-label {
            color: #888;
            font-size: 13px;
            margin-top: 4px;
        }
        .cursos-section h2 {
            margin: 0 0 20px;
            font-size: 18px;
        }
        .empty-state {
            background: #1a1a23;
            border: 1px dashed #2a2a35;
            border-radius: 12px;
            padding: 40px;
            text-align: center;
            color: #888;
        }
        .cursos-grid {
            display: grid;
            grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
            gap: 16px;
        }
        .curso-card {
            background: #1a1a23;
            border: 1px solid #2a2a35;
            border-radius: 12px;
            padding: 20px;
            display: flex;
            align-items: center;
            justify-content: space-between;
            transition: border-color .2s;
        }
        .curso-card:hover {
            border-color: #6c5ce7;
        }
        .curso-info h3 {
            margin: 0 0 4px;
            font-size: 15px;
        }
        .curso-users {
            color: #888;
            font-size: 13px;
        }
        .curso-status {
            background: #2a2a35;
            padding: 4px 10px;
            border-radius: 6px;
            font-size: 12px;
            color: #888;
        }
        .curso-status.active {
            background: rgba(46, 213, 115, .15);
            color: #2ed573;
        }
    `]
})
export class AdminDashboardComponent implements OnInit {
    admin: AdminUser | null = null;
    roles: Role[] = [];
    loading = true;
    stats = { roles_count: 0, modules_count: 0, users_count: 0, tools_count: 0 };

    constructor(
        private adminService: AdminService,
        private rolesService: RolesService,
        private router: Router
    ) { }

    ngOnInit(): void {
        this.admin = this.adminService.getAdmin();

        this.adminService.getProfile().subscribe({
            next: (res) => {
                if (res.success && res.data) {
                    this.stats = res.data.stats || this.stats;
                }
            }
        });

        this.rolesService.getRoles().subscribe({
            next: (result) => {
                this.roles = result.roles;
                this.loading = false;
            },
            error: () => {
                this.loading = false;
            }
        });
    }

    logout(): void {
        this.adminService.logout();
        this.router.navigate(['/admin/login']);
    }
}
