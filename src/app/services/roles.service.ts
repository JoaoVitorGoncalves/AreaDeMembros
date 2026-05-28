import { Injectable } from '@angular/core';
import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { Observable, BehaviorSubject, throwError, timer } from 'rxjs';
import { map, catchError, shareReplay, tap, finalize, retryWhen, delayWhen } from 'rxjs/operators';
import { Role, RolesResponse } from '../models/role.model';
import { AuthService } from './auth.service';
import { HttpHeaders } from '@angular/common/http';
import { environment } from '../../environments/environment';

export interface RolesResult {
    roles: Role[];
    totalRoles: number;
}

@Injectable({
    providedIn: 'root'
})
export class RolesService {
    private readonly API_URL = `${environment.apiUrl}/api/v1/roles`;
    private readonly CACHE_DURATION = 300000; // 5 minutos
    private readonly MAX_RETRIES = 3;
    private readonly RETRY_DELAY = 1000;

    private rolesCache: RolesResult | null = null;
    private cacheTimestamp: number = 0;
    private loadingSubject = new BehaviorSubject<boolean>(false);
    public loading$ = this.loadingSubject.asObservable();

    // NOVO: BehaviorSubject para emitir sempre que houver alteração
    private rolesSubject = new BehaviorSubject<RolesResult>({ roles: [], totalRoles: 0 });
    public roles$ = this.rolesSubject.asObservable();

    private inFlightRequest$: Observable<RolesResult> | null = null;

    constructor(private http: HttpClient, private authService: AuthService) { }

    getRoles(): Observable<RolesResult> {
        if (this.rolesCache && this.isCacheValid()) {
            // Atualiza o rolesSubject com o valor do cache
            this.rolesSubject.next(this.rolesCache);
            return this.roles$;
        }
        if (this.inFlightRequest$) {
            return this.inFlightRequest$;
        }
        this.loadingSubject.next(true);
        this.inFlightRequest$ = this.http.get<RolesResponse>(this.API_URL).pipe(
            retryWhen(errors =>
                errors.pipe(
                    delayWhen(() => timer(this.RETRY_DELAY)),
                    tap(error => console.warn(`Falha ao buscar cargos: ${error.message}`)),
                    map((error, index) => {
                        if (index >= this.MAX_RETRIES - 1) {
                            throw error;
                        }
                        return error;
                    })
                )
            ),
            map((response: RolesResponse) => {
                if (!response.success) {
                    throw new Error(response.message || 'Erro ao carregar cargos');
                }
                return {
                    roles: response.data.roles,
                    totalRoles: response.data.total_roles
                } as RolesResult;
            }),
            tap((result) => {
                this.cacheTimestamp = Date.now();
                this.rolesCache = result;
                this.rolesSubject.next(result);
            }),
            catchError(this.handleError.bind(this)),
            finalize(() => {
                this.loadingSubject.next(false);
                this.inFlightRequest$ = null;
            }),
            shareReplay(1)
        );
        // Atualiza o rolesSubject com o valor assim que disponível
        this.inFlightRequest$.subscribe(result => this.rolesSubject.next(result));
        return this.inFlightRequest$;
    }

    private isCacheValid(): boolean {
        return Date.now() - this.cacheTimestamp < this.CACHE_DURATION;
    }

    private handleError(error: HttpErrorResponse): Observable<never> {
        let errorMessage = 'Erro ao carregar cargos';

        if (error.status === 401) {
            errorMessage = 'Não autorizado. Faça login novamente.';
        } else if (error.status === 403) {
            errorMessage = 'Você não tem permissão para acessar estes cargos.';
        } else if (error.status === 404) {
            errorMessage = 'Endpoint de cargos não encontrado.';
        } else if (error.status === 500) {
            errorMessage = 'Erro interno do servidor. Tente novamente mais tarde.';
        } else if (error.status === 0) {
            errorMessage = 'Erro de conexão. Verifique sua internet.';
        } else if (error.error?.message) {
            errorMessage = error.error.message;
        }

        console.error('Erro ao buscar cargos:', {
            status: error.status,
            message: error.error?.message || error.message,
            error: error.error
        });

        return throwError(() => new Error(errorMessage));
    }

    clearCache(): void {
        this.rolesCache = null;
        this.cacheTimestamp = 0;
        this.inFlightRequest$ = null;
    }

    refreshRoles(): Observable<RolesResult> {
        this.clearCache();
        return this.getRoles();
    }

    createRole(data: { name: string; custom_url: string; active?: boolean; support_email?: string; support_phone?: string }): Observable<Role> {
        console.log(data);
        if (!this.authService.isAdmin()) {
            return throwError(() => new Error('Acesso negado: apenas administradores podem criar cargos.'));
        }
        const token = this.authService.getToken();
        if (!token) {
            return throwError(() => new Error('Token de autenticação não encontrado. Faça login novamente.'));
        }
        const headers = new HttpHeaders({
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
        });
        // Envia todos os campos recebidos, inclusive support_email e support_phone
        return this.http.post<{ success: boolean; data: Role; message?: string }>(this.API_URL, data, { headers }).pipe(
            map(response => {
                if (!response.success) {
                    throw new Error(response.message || 'Erro ao criar cargo');
                }
                return response.data;
            }),
            tap((newRole) => {
                // Atualiza o cache otimisticamente adicionando o novo cargo
                this.addRoleToCache(newRole);
                // Atualiza o rolesSubject
                const current = this.rolesSubject.value;
                this.rolesSubject.next({
                    roles: [...current.roles, newRole],
                    totalRoles: current.totalRoles + 1
                });
            }),
            catchError(this.handleError.bind(this))
        );
    }

    updateRole(id: number, data: Partial<Pick<Role, 'name' | 'custom_url' | 'active'>>): Observable<Role> {
        if (!this.authService.isAdmin()) {
            return throwError(() => new Error('Acesso negado: apenas administradores podem editar cargos.'));
        }
        const token = this.authService.getToken();
        if (!token) {
            return throwError(() => new Error('Token de autenticação não encontrado. Faça login novamente.'));
        }
        const headers = new HttpHeaders({
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
        });
        return this.http.put<Role>(`${this.API_URL}/${id}`, data, { headers }).pipe(
            tap((updatedRole) => {
                // Atualiza o cache de roles otimisticamente
                this.updateCacheWithRole(id, updatedRole);
                // Atualiza o rolesSubject
                const current = this.rolesSubject.value;
                this.rolesSubject.next({
                    roles: current.roles.map(role => role.id === id ? { ...role, ...updatedRole } : role),
                    totalRoles: current.totalRoles
                });
            }),
            catchError(this.handleError.bind(this))
        );
    }

    // Novo método para atualizar o cache diretamente com dados modificados
    updateCacheWithRole(id: number, updatedRole: Role): void {
        if (this.rolesCache) {
            // Cria um novo observable com os dados atualizados
            this.rolesCache = {
                ...this.rolesCache,
                roles: this.rolesCache.roles.map(role =>
                    role.id === id ? { ...role, ...updatedRole } : role
                )
            };

            // Força um refresh do cache para garantir que todos os subscribers recebam a atualização
            this.cacheTimestamp = Date.now();

            // CRÍTICO: Emite um novo valor para todos os subscribers imediatamente
            this.rolesSubject.next(this.rolesCache);
        }
        // Atualiza o rolesSubject
        const current = this.rolesSubject.value;
        this.rolesSubject.next({
            roles: current.roles.map(role => role.id === id ? { ...role, ...updatedRole } : role),
            totalRoles: current.totalRoles
        });
    }

    // Método para atualizar cache com dados locais (sem request)
    updateCacheWithLocalData(updatedRole: Role): void {
        this.updateCacheWithRole(updatedRole.id, updatedRole);
    }

    // Método para adicionar novo cargo ao cache
    private addRoleToCache(newRole: Role): void {
        if (this.rolesCache) {
            // Cria um novo observable com o novo cargo adicionado
            this.rolesCache = {
                ...this.rolesCache,
                roles: [...this.rolesCache.roles, newRole],
                totalRoles: this.rolesCache.totalRoles + 1
            };

            // Força um refresh do cache para garantir que todos os subscribers recebam a atualização
            this.cacheTimestamp = Date.now();

            // CRÍTICO: Emite um novo valor para todos os subscribers imediatamente
            this.rolesSubject.next(this.rolesCache);
        }
        // Atualiza o rolesSubject
        const current = this.rolesSubject.value;
        this.rolesSubject.next({
            roles: [...current.roles, newRole],
            totalRoles: current.totalRoles + 1
        });
    }

    deleteRole(id: number): Observable<void> {
        if (!this.authService.isAdmin()) {
            return throwError(() => new Error('Acesso negado: apenas administradores podem excluir cargos.'));
        }
        const token = this.authService.getToken();
        if (!token) {
            return throwError(() => new Error('Token de autenticação não encontrado. Faça login novamente.'));
        }
        const headers = new HttpHeaders({
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
        });
        return this.http.delete<void>(`${this.API_URL}/${id}`, { headers }).pipe(
            tap(() => {
                // Remove o cargo do cache otimisticamente
                if (this.rolesCache) {
                    this.rolesCache = {
                        ...this.rolesCache,
                        roles: this.rolesCache.roles.filter(role => role.id !== id),
                        totalRoles: this.rolesCache.totalRoles - 1
                    };
                    this.rolesSubject.next(this.rolesCache);
                }
            }),
            catchError(this.handleError.bind(this))
        );
    }
} 