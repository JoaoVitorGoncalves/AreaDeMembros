import { Injectable } from '@angular/core';
import { HttpClient, HttpParams, HttpHeaders } from '@angular/common/http';
import { BehaviorSubject, Observable, of, throwError } from 'rxjs';
import { catchError, map, shareReplay, switchMap, tap } from 'rxjs/operators';
import { environment } from '../../environments/environment';

export interface User {
    id: number;
    name: string;
    email: string;
    document: string;
    phone: string;
    roles: Array<{
        id: number;
        name: string;
    }>;
    // Novos campos de progresso
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
    last_login_at?: string; // Novo campo para último acesso
}

export interface Role {
    id: number;
    name: string;
}

export interface UsersResponse {
    success: boolean;
    data: {
        users: User[];
        role: Role;
        total_users: number;
        // Novas estatísticas de progresso
        progress_statistics?: {
            total_users_with_progress: number;
            users_with_completed_items: number;
            average_progress_across_users: number;
            module_statistics: {
                total_users_with_module_progress: number;
                users_with_completed_modules: number;
                average_module_progress: number;
            };
            lesson_statistics: {
                total_users_with_lesson_progress: number;
                users_with_completed_lessons: number;
                average_lesson_progress: number;
            };
        };
    };
    pagination: {
        current_page: number;
        per_page: number;
        total: number;
        total_pages: number;
        has_more: boolean;
    };
    message: string;
    timestamp: string;
}

export interface UsersState {
    users: User[];
    loading: boolean;
    error: string | null;
    pagination: {
        current_page: number;
        per_page: number;
        total: number;
        total_pages: number;
        has_more: boolean;
    } | null;
    role: Role | null;
    // Novas estatísticas de progresso
    progress_statistics?: {
        total_users_with_progress: number;
        users_with_completed_items: number;
        average_progress_across_users: number;
        module_statistics: {
            total_users_with_module_progress: number;
            users_with_completed_modules: number;
            average_module_progress: number;
        };
        lesson_statistics: {
            total_users_with_lesson_progress: number;
            users_with_completed_lessons: number;
            average_lesson_progress: number;
        };
    };
}

@Injectable({
    providedIn: 'root'
})
export class UsersService {
    private readonly CACHE_DURATION = 5 * 60 * 1000; // 5 minutos
    private readonly cache = new Map<string, { data: UsersState; timestamp: number }>();

    private readonly usersStateSubject = new BehaviorSubject<UsersState>({
        users: [],
        loading: false,
        error: null,
        pagination: null,
        role: null
    });

    public readonly usersState$ = this.usersStateSubject.asObservable().pipe(
        shareReplay(1)
    );

    public readonly users$ = this.usersState$.pipe(
        map(state => state.users)
    );

    public readonly loading$ = this.usersState$.pipe(
        map(state => state.loading)
    );

    public readonly error$ = this.usersState$.pipe(
        map(state => state.error)
    );

    public readonly pagination$ = this.usersState$.pipe(
        map(state => state.pagination)
    );

    public readonly role$ = this.usersState$.pipe(
        map(state => state.role)
    );

    public readonly progressStatistics$ = this.usersState$.pipe(
        map(state => state.progress_statistics)
    );

    constructor(private http: HttpClient) { }

    /**
     * Busca usuários por cargo com cache inteligente
     */
    getUsersByRole(roleName: string, page: number = 1, limit: number = 10, forceRefresh: boolean = false): Observable<UsersState> {
        const cacheKey = `${roleName}_${page}_${limit}`;
        const cached = this.cache.get(cacheKey);
        const now = Date.now();

        // Verifica se há cache válido e não é refresh forçado
        if (!forceRefresh && cached && (now - cached.timestamp) < this.CACHE_DURATION) {
            this.usersStateSubject.next(cached.data);
            return of(cached.data);
        }

        // Atualiza estado para loading
        this.updateState({ loading: true, error: null });

        const params = new HttpParams()
            .set('page', page.toString())
            .set('limit', limit.toString());

        const url = `${environment.apiUrl}/api/v1/users/role/${roleName}`;

        return this.http.get<UsersResponse>(url, { params }).pipe(
            map(response => {
                const state: UsersState = {
                    users: response.data.users,
                    loading: false,
                    error: null,
                    pagination: response.pagination,
                    role: response.data.role,
                    progress_statistics: response.data.progress_statistics
                };

                // Atualiza cache
                this.cache.set(cacheKey, { data: state, timestamp: now });

                // Atualiza estado
                this.usersStateSubject.next(state);

                return state;
            }),
            catchError(error => {
                const errorMessage = error.error?.message || 'Erro ao carregar usuários';
                const state: UsersState = {
                    users: [],
                    loading: false,
                    error: errorMessage,
                    pagination: null,
                    role: null
                };

                this.usersStateSubject.next(state);
                return throwError(() => error);
            }),
            shareReplay(1)
        );
    }

    /**
     * Busca usuários com paginação
     */
    loadUsers(roleName: string, page: number = 1, limit: number = 10): Observable<UsersState> {
        return this.getUsersByRole(roleName, page, limit);
    }

    /**
     * Refresh dos dados
     */
    refreshUsers(roleName: string, page: number = 1, limit: number = 10): Observable<UsersState> {
        return this.getUsersByRole(roleName, page, limit, true);
    }

    /**
     * Limpa cache para um cargo específico
     */
    clearCache(roleName?: string): void {
        if (roleName) {
            // Remove apenas cache do cargo específico
            for (const key of this.cache.keys()) {
                if (key.startsWith(roleName)) {
                    this.cache.delete(key);
                }
            }
        } else {
            // Limpa todo o cache
            this.cache.clear();
        }
    }

    /**
     * Busca usuários por nome usando o endpoint /users/search-by-name
     */
    searchUsersByName(name: string): Observable<User[]> {
        const token = localStorage.getItem('access_token');
        const userStr = localStorage.getItem('user');
        const user = userStr ? JSON.parse(userStr) : null;
        const isAdmin = user && user.roles && user.roles.some((role: string) => ['admin', 'administrator', 'adm', 'Adm'].includes(role.toLowerCase()));

        if (!token) {
            return throwError(() => new Error('Token de autenticação não encontrado. Faça login novamente.'));
        }

        const headers = new HttpHeaders({
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
        });

        const url = `${environment.apiUrl}/api/v1/users/search-by-name`;
        const body = {
            name,
            is_admin: isAdmin
        };

        return this.http.post<any>(url, body, { headers }).pipe(
            map(response => {
                if (!response.success) {
                    throw new Error(response.message || 'Erro ao buscar usuários');
                }
                return response.data.users || [];
            }),
            catchError(error => {
                const errorMessage = error.error?.message || 'Erro ao buscar usuários';
                return throwError(() => new Error(errorMessage));
            })
        );
    }

    /**
     * Atualiza estado interno
     */
    private updateState(partial: Partial<UsersState>): void {
        const currentState = this.usersStateSubject.value;
        this.usersStateSubject.next({ ...currentState, ...partial });
    }

    /**
     * Calcula o engajamento individual de um usuário baseado na quantidade de aulas concluídas
     */
    calculateUserEngagement(user: User): string {
        // Obtém o número de aulas concluídas e total do progress_summary
        const completedLessons = user.progress_summary?.lessons?.completed || 0;
        const totalLessons = user.progress_summary?.lessons?.total || 0;

        // Se não há aulas disponíveis, retorna 'Nenhum'
        if (totalLessons === 0) {
            return 'Nenhum';
        }

        // Calcula a porcentagem de aulas concluídas
        const completionPercentage = (completedLessons / totalLessons) * 100;

        // Determina o engajamento baseado na porcentagem de aulas concluídas
        if (completionPercentage === 0) {
            return 'Nenhum';
        } else if (completionPercentage <= 25) {
            return 'Baixo';
        } else if (completionPercentage <= 50) {
            return 'Médio';
        } else if (completionPercentage <= 75) {
            return 'Alto';
        } else {
            return 'Altíssimo';
        }
    }

    /**
     * Calcula estatísticas dos usuários
     */
    calculateStats(users: User[]): {
        total: number;
        averageProgress: number;
        engagement: string;
    } {
        if (!users.length) {
            return { total: 0, averageProgress: 0, engagement: 'Baixo' };
        }

        // Usa os dados reais de progresso da API
        const totalProgress = users.reduce((sum, user) => {
            // Usa o progresso geral do usuário se disponível, senão usa 0
            const progress = user.progress_summary?.overall?.average_progress || 0;
            return sum + progress;
        }, 0);

        const averageProgress = Math.round(totalProgress / users.length);

        // Determina engajamento baseado no progresso médio
        let engagement = 'Baixo';
        if (averageProgress > 70) engagement = 'Alto';
        else if (averageProgress > 30) engagement = 'Médio';

        return {
            total: users.length,
            averageProgress,
            engagement
        };
    }

    /**
     * Calcula estatísticas usando dados da API
     */
    calculateStatsFromAPI(users: User[], progressStatistics?: any): {
        total: number;
        averageProgress: number;
        engagement: string;
    } {
        if (!users.length) {
            return { total: 0, averageProgress: 0, engagement: 'Baixo' };
        }

        // Usa o progresso médio da API se disponível, senão calcula localmente
        const averageProgress = progressStatistics?.average_progress_across_users ||
            this.calculateStats(users).averageProgress;

        // Determina engajamento baseado no progresso médio
        let engagement = 'Baixo';
        if (averageProgress > 70) engagement = 'Alto';
        else if (averageProgress > 30) engagement = 'Médio';

        return {
            total: users.length,
            averageProgress: Math.round(averageProgress),
            engagement
        };
    }

    /**
     * Cria um novo usuário com atualização otimista
     */
    createUser(userData: {
        name: string;
        document: string;
        phone: string;
        email: string;
        password: string;
        role_id: number;
    }): Observable<User> {
        // Cria um novo usuário localmente para adicionar à lista
        const newUser: User = {
            id: Math.random(), // ID temporário
            name: userData.name,
            email: userData.email,
            document: userData.document,
            phone: userData.phone,
            roles: [{ id: userData.role_id, name: 'Cargo' }] // Role temporário
        };

        // Atualiza o estado otimisticamente
        const currentState = this.usersStateSubject.value;
        const updatedState: UsersState = {
            ...currentState,
            users: [...currentState.users, newUser],
            pagination: currentState.pagination ? {
                ...currentState.pagination,
                total: currentState.pagination.total + 1
            } : null
        };
        this.usersStateSubject.next(updatedState);

        // Limpa cache para forçar refresh na próxima busca
        this.clearCache();

        const params = new HttpParams();
        const url = `${environment.apiUrl}/api/v1/users`;

        return this.http.post<any>(url, userData).pipe(
            map(response => {
                if (!response.success) {
                    throw new Error(response.message || 'Erro ao criar usuário');
                }

                // Atualiza o usuário com dados reais do servidor
                const realUser: User = {
                    ...newUser,
                    id: response.data.id || newUser.id,
                    roles: response.data.roles || newUser.roles
                };

                // Atualiza o estado com o usuário real
                const finalState = this.usersStateSubject.value;
                const finalUpdatedState: UsersState = {
                    ...finalState,
                    users: finalState.users.map(user =>
                        user.id === newUser.id ? realUser : user
                    )
                };
                this.usersStateSubject.next(finalUpdatedState);

                return realUser;
            }),
            catchError(error => {
                // Em caso de erro, remove o usuário adicionado otimisticamente
                const errorState = this.usersStateSubject.value;
                const rollbackState: UsersState = {
                    ...errorState,
                    users: errorState.users.filter(user => user.id !== newUser.id),
                    pagination: errorState.pagination ? {
                        ...errorState.pagination,
                        total: Math.max(0, errorState.pagination.total - 1)
                    } : null
                };
                this.usersStateSubject.next(rollbackState);

                const errorMessage = this.handleCreateError(error);
                return throwError(() => new Error(errorMessage));
            })
        );
    }

    /**
     * Trata erros de criação de usuário
     */
    private handleCreateError(error: any): string {
        let errorMessage = 'Erro ao criar usuário';

        if (error.status === 401) {
            errorMessage = 'Não autorizado. Faça login novamente.';
        } else if (error.status === 403) {
            errorMessage = 'Você não tem permissão para criar usuários.';
        } else if (error.status === 409) {
            errorMessage = 'Usuário já existe com este email ou documento.';
        } else if (error.status === 422) {
            errorMessage = 'Dados inválidos. Verifique as informações fornecidas.';
        } else if (error.status === 500) {
            errorMessage = 'Erro interno do servidor. Tente novamente mais tarde.';
        } else if (error.status === 0) {
            errorMessage = 'Erro de conexão. Verifique sua internet.';
        } else if (error.error?.message) {
            errorMessage = error.error.message;
        }

        console.error('Erro ao criar usuário:', {
            status: error.status,
            message: error.error?.message || error.message,
            error: error.error
        });

        return errorMessage;
    }

    /**
     * Atribui um cargo a múltiplos usuários
     */
    assignRoleToUsers(roleId: number, userIds: number[], token: string) {
        const url = `${environment.apiUrl}/api/v1/users/assign-role`;
        const headers = { 'Authorization': `Bearer ${token}` };
        return this.http.post<any>(url, { user_ids: userIds, role_id: roleId }, { headers });
    }

    /**
     * Exclui um usuário pelo id
     */
    deleteUser(userId: number, token: string): Observable<any> {
        const url = `${environment.apiUrl}/api/v1/users/${userId}`;
        const headers: any = { 'Authorization': `Bearer ${token}` };
        return this.http.delete<any>(url, { headers });
    }

    /**
     * Remove um usuário de um módulo específico
     */
    deleteUserFromRole(userId: number, roleId: number, token: string): Observable<any> {
        const url = `${environment.apiUrl}/api/v1/users/${userId}/role/${roleId}`;
        const headers: any = { 'Authorization': `Bearer ${token}` };
        return this.http.delete<any>(url, { headers });
    }
} 