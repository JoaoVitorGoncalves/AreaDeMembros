import { Component, EventEmitter, Input, Output, OnInit, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { AuthService } from '../../services/auth.service';
import { environment } from '../../../environments/environment';
import { UsersService } from '../../services/users.service';

export interface ExistingUser {
    id: number;
    name: string;
    email: string;
    phone?: string;
    document?: string;
    roles?: { id: number; name: string }[];
    // Adicionar campos de progresso para compatibilidade
    module_progress?: Array<{
        module_id: number;
        module_name: string;
        progress: number;
        time: number;
        created_at: string;
        updated_at: string;
    }>;
    lesson_progress?: Array<{
        lesson_id: number;
        lesson_name: string;
        progress: number;
        time: number;
        created_at: string;
        updated_at: string;
    }>;
    progress_summary?: {
        modules: {
            total: number;
            completed: number;
            average_progress: number;
            total_progress: number;
        };
        lessons: {
            total: number;
            completed: number;
            average_progress: number;
            total_progress: number;
        };
        overall: {
            total_items: number;
            completed_items: number;
            average_progress: number;
        };
    };
    last_login_at?: string;
}

@Component({
    selector: 'app-add-existing-user',
    standalone: true,
    imports: [CommonModule, FormsModule],
    templateUrl: './add-existing-user.component.html',
    styleUrls: ['./add-existing-user.component.scss']
})
export class AddExistingUserComponent implements OnInit {
    @Output() close = new EventEmitter<void>();
    @Output() add = new EventEmitter<ExistingUser[]>();

    @Input() moduleUserIds: number[] = [];
    searchTerm = '';
    selectedIds = new Set<number>();
    users: ExistingUser[] = [];
    loading = false;
    error: string | null = null;
    @Input() availableRoles: { id: number, name: string }[] = [];
    selectedRoleId: number | null = null;
    @Input() roleId!: number; // Adicione isso

    constructor(
        private http: HttpClient,
        private authService: AuthService,
        private cdr: ChangeDetectorRef,
        private usersService: UsersService // <-- injete o serviço
    ) { }

    ngOnInit(): void {
        this.loadUsers();
    }

    loadUsers(): void {
        this.users = [];
        this.loading = true;
        this.error = null;
        if (!this.authService.isAdmin()) {
            this.error = 'Apenas administradores podem adicionar usuários.';
            this.loading = false;
            return;
        }
        const token = this.authService.getToken();
        if (!token) {
            this.error = 'Token de autenticação não encontrado. Faça login novamente.';
            this.loading = false;
            return;
        }
        const headers = new HttpHeaders({
            'Authorization': `Bearer ${token}`
        });
        this.http.get<any>(`${environment.apiUrl}/api/v1/users`, { headers }).subscribe({
            next: (response) => {
                if (response.success && Array.isArray(response.data)) {
                    this.users = response.data
                        .filter((u: any) =>
                            !u.roles?.some((r: any) => (r.name || '').toLowerCase() === 'adm' &&
                                !this.moduleUserIds.includes(u.id)) &&
                            !this.moduleUserIds.includes(u.id)
                        )
                        .map((u: any) => this.mapUserWithProgress(u));
                } else if (response.success && Array.isArray(response.data.users)) {
                    this.users = response.data.users
                        .filter((u: any) =>
                            !u.roles?.some((r: any) => (r.name || '').toLowerCase() === 'adm' &&
                                !this.moduleUserIds.includes(u.id)) &&
                            !this.moduleUserIds.includes(u.id)
                        )
                        .map((u: any) => this.mapUserWithProgress(u));
                } else {
                    this.error = 'Resposta inesperada da API.';
                }
                this.loading = false;
                this.cdr.detectChanges();
            },
            error: (err) => {
                this.error = err.error?.message || 'Erro ao buscar usuários.';
                this.loading = false;
                this.cdr.detectChanges();
            }
        });
    }

    private mapUserWithProgress(user: any): ExistingUser {
        // Mapear dados de progresso da API para o formato esperado
        const mappedUser: ExistingUser = {
            id: user.id,
            name: user.name,
            email: user.email,
            phone: user.phone,
            document: user.document,
            roles: user.roles?.map((r: any) => ({ id: r.id, name: r.name })) || [],
            last_login_at: user.last_login_at
        };

        // Mapear module_progress se existir
        if (user.module_progress && Array.isArray(user.module_progress)) {
            mappedUser.module_progress = user.module_progress.map((mp: any) => ({
                module_id: mp.module_id,
                module_name: mp.module?.name || 'Módulo',
                progress: mp.progress || 0,
                time: mp.time || 0,
                created_at: mp.created_at,
                updated_at: mp.updated_at
            }));
        }

        // Mapear lesson_progress se existir
        if (user.lesson_progress && Array.isArray(user.lesson_progress)) {
            mappedUser.lesson_progress = user.lesson_progress.map((lp: any) => ({
                lesson_id: lp.lesson_id,
                lesson_name: lp.lesson?.name || 'Aula',
                progress: lp.progress || 0,
                time: lp.time || 0,
                created_at: lp.created_at,
                updated_at: lp.updated_at
            }));
        }

        // Mapear progress_summary se existir
        if (user.progress_summary) {
            mappedUser.progress_summary = {
                modules: {
                    total: user.progress_summary.modules?.total || 0,
                    completed: user.progress_summary.modules?.completed || 0,
                    average_progress: user.progress_summary.modules?.average_progress || 0,
                    total_progress: user.progress_summary.modules?.average_progress || 0
                },
                lessons: {
                    total: user.progress_summary.lessons?.total || 0,
                    completed: user.progress_summary.lessons?.completed || 0,
                    average_progress: user.progress_summary.lessons?.average_progress || 0,
                    total_progress: user.progress_summary.lessons?.average_progress || 0
                },
                overall: {
                    total_items: user.progress_summary.overall?.total_items || 0,
                    completed_items: user.progress_summary.overall?.completed_items || 0,
                    average_progress: user.progress_summary.overall?.average_progress || 0
                }
            };
        }

        return mappedUser;
    }

    get filteredUsers(): ExistingUser[] {
        if (!this.searchTerm) return this.users;
        return this.users.filter(u =>
            u.name.toLowerCase().includes(this.searchTerm.toLowerCase()) ||
            u.email.toLowerCase().includes(this.searchTerm.toLowerCase())
        );
    }

    isSelected(id: number): boolean {
        return this.selectedIds.has(id);
    }

    toggleSelect(id: number): void {
        if (this.selectedIds.has(id)) {
            this.selectedIds.delete(id);
        } else {
            this.selectedIds.add(id);
        }
    }

    selectAll(): void {
        if (this.allSelected) {
            this.selectedIds.clear();
        } else {
            this.filteredUsers.forEach(u => this.selectedIds.add(u.id));
        }
    }

    get allSelected(): boolean {
        return this.filteredUsers.length > 0 && this.filteredUsers.every(u => this.selectedIds.has(u.id));
    }

    onAdd(): void {
        if (!this.authService.isAdmin()) {
            this.error = 'Apenas administradores podem adicionar usuários.';
            return;
        }
        const token = this.authService.getToken();
        if (!token) {
            this.error = 'Token de autenticação não encontrado. Faça login novamente.';
            return;
        }
        const userIds = Array.from(this.selectedIds);
        if (userIds.length === 0) {
            this.error = 'Selecione pelo menos um usuário.';
            return;
        }
        this.error = null;
        this.usersService.assignRoleToUsers(this.roleId, userIds, token).subscribe({
            next: (response) => {
                this.add.emit(this.users.filter(u => this.selectedIds.has(u.id)));
                this.selectedIds.clear();
                this.cdr.detectChanges();
            },
            error: (err) => {
                this.error = err.error?.message || 'Erro ao adicionar usuários.';
                this.cdr.detectChanges();
            }
        });
    }

    onClose(): void {
        this.close.emit();
    }

    getInitials(name: string): string {
        return name
            .split(' ')
            .map(word => word.charAt(0))
            .join('')
            .toUpperCase()
            .slice(0, 2);
    }

    getAvatarColor(userId: number): string {
        const colors = ['#3A4AFF', '#4A90E2', '#6A6AFF', '#FF6B6B', '#4ECDC4', '#45B7D1'];
        return colors[userId % colors.length];
    }
} 