import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { BehaviorSubject, Observable, throwError, of } from 'rxjs';
import { map, catchError, finalize } from 'rxjs/operators';
import { Support, SupportResponse } from '../models/support.model';
import { AuthService } from './auth.service';
import { environment } from '../../environments/environment';

export interface SupportResult {
    support: Support | null;
}

interface CacheEntry {
    data: SupportResult;
    timestamp: number;
}

@Injectable({ providedIn: 'root' })
export class SupportService {
    private readonly API_URL = `${environment.apiUrl}/api/v1/support`;
    private readonly CACHE_DURATION = 300000; // 5 minutos

    // Cache por cargo usando Map
    private supportCache = new Map<string, CacheEntry>();
    private loadingSubject = new BehaviorSubject<boolean>(false);
    public loading$ = this.loadingSubject.asObservable();

    constructor(private http: HttpClient, private authService: AuthService) { }

    getSupport(forceRefresh: boolean = false, roleName?: string, roleId?: number): Observable<SupportResult> {
        const cacheKey = this.getCacheKey(roleName, roleId);
        const cached = this.supportCache.get(cacheKey);

        // Se não for force refresh e temos cache válido, retorna do cache
        if (!forceRefresh && cached && this.isCacheValid(cached.timestamp)) {
            return of(cached.data);
        }

        // Se não temos cache válido, busca do servidor
        return this.fetchSupportFromServer(roleName, roleId, cacheKey);
    }

    private fetchSupportFromServer(roleName?: string, roleId?: number, cacheKey?: string): Observable<SupportResult> {
        this.loadingSubject.next(true);

        const token = this.authService.getToken();
        const user = this.authService.getUser();

        if (!token || !user) {
            this.loadingSubject.next(false);
            return throwError(() => new Error('Token ou usuário não encontrado'));
        }

        // Determinar role_name e role_id
        let role_name = '';
        let role_id: number | undefined = undefined;

        if (this.authService.isAdmin() && roleName && roleId) {
            // Admin editando um cargo específico
            role_name = roleName;
            role_id = roleId;
        } else if (user.roles && user.roles.length > 0) {
            // Usuário comum, pega o primeiro cargo
            const firstRole = user.roles[0];
            if (typeof firstRole === 'string') {
                role_name = firstRole;
            } else if (firstRole && typeof firstRole === 'object') {
                role_name = (firstRole as any).name || '';
                role_id = (firstRole as any).id;
            }
        }

        // Montar params para query string
        let params: any = {};
        if (this.authService.isAdmin() && roleName && roleId) {
            params = { role_name: roleName, role_id: roleId };
        } else if (role_name) {
            params = { role_name };
            if (role_id !== undefined) params.role_id = role_id;
        }

        const headers = new HttpHeaders({
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json',
            'X-User-Id': user.id.toString()
        });

        return this.http.get(this.API_URL, { headers, params }).pipe(
            map((response: any) => {
                if (!response.success && !response.support) {
                    throw new Error(response.message || 'Erro ao carregar suporte');
                }

                const supportData = response.data?.support || response.data?.support?.support || null;
                const result = { support: supportData } as SupportResult;

                // Salvar no cache se temos uma chave válida
                if (cacheKey) {
                    this.supportCache.set(cacheKey, {
                        data: result,
                        timestamp: Date.now()
                    });
                }

                return result;
            }),
            catchError(error => {
                return throwError(() => error);
            }),
            finalize(() => {
                this.loadingSubject.next(false);
            })
        );
    }

    updateSupport(phone?: string, email?: string, roleName?: string, roleId?: number): Observable<SupportResult> {
        const token = this.authService.getToken();
        const user = this.authService.getUser();

        if (!token || !user) {
            return throwError(() => new Error('Token ou usuário não encontrado'));
        }

        // Preparar payload - apenas campos que foram fornecidos
        const payload: any = {};
        if (phone !== undefined) payload.phone = phone;
        if (email !== undefined) payload.email = email;

        // Se não há dados para atualizar, retorna erro
        if (Object.keys(payload).length === 0) {
            return throwError(() => new Error('Nenhum dado fornecido para atualização'));
        }

        // Determinar role_name e role_id
        let role_name = '';
        let role_id: number | undefined = undefined;

        if (this.authService.isAdmin() && roleName && roleId) {
            // Admin editando um cargo específico
            role_name = roleName;
            role_id = roleId;
        } else if (user.roles && user.roles.length > 0) {
            // Usuário comum, pega o primeiro cargo
            const firstRole = user.roles[0];
            if (typeof firstRole === 'string') {
                role_name = firstRole;
            } else if (firstRole && typeof firstRole === 'object') {
                role_name = (firstRole as any).name || '';
                role_id = (firstRole as any).id;
            }
        }

        // Adicionar role_name e role_id ao payload se disponíveis
        if (role_name) payload.role_name = role_name;
        if (role_id !== undefined) payload.role_id = role_id;

        const headers = new HttpHeaders({
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json',
            'X-User-Id': user.id.toString()
        });

        const cacheKey = this.getCacheKey(roleName, roleId);
        const currentSupport = this.supportCache.get(cacheKey)?.data.support || null;

        // Otimização: Atualizar cache otimisticamente antes da requisição
        const optimisticSupport = currentSupport ? {
            ...currentSupport,
            ...payload
        } : payload;
        const optimisticResult = { support: optimisticSupport } as SupportResult;

        // Atualizar cache otimisticamente
        this.supportCache.set(cacheKey, {
            data: optimisticResult,
            timestamp: Date.now()
        });

        return this.http.put(this.API_URL, payload, { headers }).pipe(
            map((response: any) => {
                if (!response.success) {
                    // Reverter cache otimístico em caso de erro
                    if (currentSupport) {
                        this.supportCache.set(cacheKey, {
                            data: { support: currentSupport },
                            timestamp: Date.now()
                        });
                    } else {
                        this.supportCache.delete(cacheKey);
                    }
                    throw new Error(response.message || 'Erro ao atualizar suporte');
                }

                const supportData = response.data?.support || response.data?.support?.support || null;
                const result = { support: supportData } as SupportResult;

                // Atualizar cache com dados reais do servidor
                this.supportCache.set(cacheKey, {
                    data: result,
                    timestamp: Date.now()
                });
                return result;
            }),
            catchError(error => {
                // Reverter cache otimístico em caso de erro
                if (currentSupport) {
                    this.supportCache.set(cacheKey, {
                        data: { support: currentSupport },
                        timestamp: Date.now()
                    });
                } else {
                    this.supportCache.delete(cacheKey);
                }
                return throwError(() => error);
            })
        );
    }

    private getCacheKey(roleName?: string, roleId?: number): string {
        // Priorizar role_id se disponível, senão usar role_name
        if (roleId) {
            return `role_id:${roleId}`;
        } else if (roleName) {
            return `role_name:${roleName}`;
        } else {
            return 'default';
        }
    }

    private isCacheValid(timestamp: number): boolean {
        return Date.now() - timestamp < this.CACHE_DURATION;
    }

    // Forçar refresh de um cargo específico
    refreshSupport(roleName?: string, roleId?: number): void {
        const cacheKey = this.getCacheKey(roleName, roleId);
        this.supportCache.delete(cacheKey);
    }

    // Limpar cache de um cargo específico (sem fazer nova requisição)
    clearSupportCache(roleName?: string, roleId?: number): void {
        if (roleName || roleId) {
            const cacheKey = this.getCacheKey(roleName, roleId);
            this.supportCache.delete(cacheKey);
        } else {
            // Limpar todo o cache se não especificar cargo
            this.supportCache.clear();
        }
    }

    // Debug: mostrar estado do cache
    getCacheStatus(): void {
        this.supportCache.forEach((entry, key) => {
            const age = Date.now() - entry.timestamp;
            const isValid = this.isCacheValid(entry.timestamp);
        });
    }
} 