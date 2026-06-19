import { Injectable } from '@angular/core';
import {
    HttpClient,
    HttpParams,
    HttpErrorResponse,
} from '@angular/common/http';
import { Observable, BehaviorSubject, of, throwError, timer } from 'rxjs';
import {
    catchError,
    map,
    shareReplay,
    tap,
    finalize,
    retryWhen,
    delayWhen,
    filter,
} from 'rxjs/operators';
import { AuthService } from './auth.service';
import { environment } from '../../environments/environment';

export interface Module {
    id: number;
    name: string;
    thumbnail_url: string;
    contentCount?: number;
    created_at?: string | null;
    updated_at?: string | null;
    lessons?: Lesson[];
}

export interface Lesson {
    id: number;
    uuid: string;
    name: string;
    description: string;
    thumbnail_url: string;
    video_url: string;
    hls_url?: string;
    conversion_status?: 'pending' | 'processing' | 'completed' | 'failed';
    created_at: string;
    updated_at: string;
    deleted_at: string | null;
    pivot?: {
        module_id: number;
        lesson_id: number;
    };
}

interface ApiModule {
    id: number;
    uuid: string;
    name: string;
    progress: number;
    image_path: string;
    content_count?: number;
    created_at: string | null;
    updated_at: string | null;
    roles: any[];
    lessons?: ApiLesson[];
}

interface ApiLesson {
    id: number;
    uuid: string;
    name: string;
    description: string;
    thumbnail_url: string;
    video_url: string;
    created_at: string;
    updated_at: string;
    deleted_at: string | null;
    pivot: {
        module_id: number;
        lesson_id: number;
    };
}

interface ModulesApiResponse {
    success: boolean;
    data: {
        modules: ApiModule[];
        total_modules: number;
    };
    message: string;
    timestamp: string;
}

@Injectable({
    providedIn: 'root',
})
export class ModuleService {
    private readonly API_URL = `${environment.apiUrl}/api/v1/modules`;
    private readonly CACHE_DURATION = 300000; // 5 minutos
    private readonly MAX_RETRIES = 3;
    private readonly RETRY_DELAY = 1000;

    // Cache por cargo usando Map
    private modulesCache = new Map<
        string,
        { data: Module[]; timestamp: number }
    >();
    public modulesSubject = new BehaviorSubject<Module[]>([]);
    public modules$ = this.modulesSubject.asObservable();
    private loadingSubject = new BehaviorSubject<boolean>(false);
    public loading$ = this.loadingSubject.asObservable();

    constructor(
        private http: HttpClient,
        private authService: AuthService,
    ) { }

    loadModules(): Observable<Module[]> {
        const user = this.authService.getUser();
        const userRole = user?.roles?.[0] || '';

        if (!userRole) {
            return of([]);
        }

        // Verificar cache primeiro
        const cacheKey = `user_${userRole}`;
        const cachedData = this.modulesCache.get(cacheKey);

        if (cachedData && this.isCacheValid(cachedData.timestamp)) {
            this.modulesSubject.next(cachedData.data);
            return of(cachedData.data);
        }

        this.loadingSubject.next(true);

        const params = new HttpParams().set('role', userRole);

        return this.http.get<ModulesApiResponse>(this.API_URL, { params }).pipe(
            retryWhen((errors) =>
                errors.pipe(
                    delayWhen(() => timer(this.RETRY_DELAY)),
                    tap((error) =>
                        console.warn(
                            `Tentativa de buscar módulos falhou: ${error.message}`,
                        ),
                    ),
                    map((error, index) => {
                        if (index >= this.MAX_RETRIES - 1) {
                            throw error;
                        }
                        return error;
                    }),
                ),
            ),
            map((response) => {
                if (
                    response &&
                    response.success &&
                    Array.isArray(response.data.modules)
                ) {
                    const modules = response.data.modules.map(
                        (apiModule: ApiModule): Module => {
                            return {
                                id: apiModule.id,
                                name: apiModule.name,
                                thumbnail_url: apiModule.image_path,
                                lessons:
                                    apiModule.lessons?.map((lesson) => ({
                                        id: lesson.id,
                                        uuid: lesson.uuid,
                                        name: lesson.name,
                                        description: lesson.description,
                                        thumbnail_url: lesson.thumbnail_url,
                                        video_url: lesson.video_url,
                                        created_at: lesson.created_at,
                                        updated_at: lesson.updated_at,
                                        deleted_at: lesson.deleted_at,
                                        pivot: lesson.pivot,
                                    })) || [],
                            };
                        },
                    );
                    return modules;
                }
                console.warn('⚠️ Resposta da API inválida ou sem módulos');
                return [];
            }),
            tap((modules) => {
                this.modulesCache.set(cacheKey, {
                    data: modules,
                    timestamp: Date.now(),
                });
                this.modulesSubject.next(modules);
                // Salvar no localStorage
                localStorage.setItem('persisted_modules', JSON.stringify(modules));
            }),
            catchError(this.handleError.bind(this)),
            finalize(() => this.loadingSubject.next(false)),
            shareReplay(1),
        );
    }

    loadModulesForRole(roleName: string): Observable<Module[]> {
        if (!roleName) {
            return of([]);
        }

        const cacheKey = `user_role_${roleName}`;
        const cachedData = this.modulesCache.get(cacheKey);

        if (cachedData && this.isCacheValid(cachedData.timestamp)) {
            return of(cachedData.data);
        }

        const params = new HttpParams().set('role', roleName);

        return this.http.get<ModulesApiResponse>(this.API_URL, { params }).pipe(
            retryWhen((errors) =>
                errors.pipe(
                    delayWhen(() => timer(this.RETRY_DELAY)),
                    tap((error) =>
                        console.warn(
                            `Tentativa de buscar módulos para role "${roleName}" falhou: ${error.message}`,
                        ),
                    ),
                    map((error, index) => {
                        if (index >= this.MAX_RETRIES - 1) {
                            throw error;
                        }
                        return error;
                    }),
                ),
            ),
            map((response) => {
                if (
                    response &&
                    response.success &&
                    Array.isArray(response.data.modules)
                ) {
                    return response.data.modules.map(
                        (apiModule: ApiModule): Module => {
                            return {
                                id: apiModule.id,
                                name: apiModule.name,
                                thumbnail_url: apiModule.image_path,
                                lessons:
                                    apiModule.lessons?.map((lesson) => ({
                                        id: lesson.id,
                                        uuid: lesson.uuid,
                                        name: lesson.name,
                                        description: lesson.description,
                                        thumbnail_url: lesson.thumbnail_url,
                                        video_url: lesson.video_url,
                                        created_at: lesson.created_at,
                                        updated_at: lesson.updated_at,
                                        deleted_at: lesson.deleted_at,
                                        pivot: lesson.pivot,
                                    })) || [],
                                };
                            },
                        );
                    }
                    return [];
            }),
            tap((modules) => {
                this.modulesCache.set(cacheKey, {
                    data: modules,
                    timestamp: Date.now(),
                });
            }),
            catchError(this.handleError.bind(this)),
        );
    }

    // Método para carregar módulos por cargo específico (para admin)
    loadModulesByRole(roleName: string, roleId?: number): Observable<Module[]> {
        const token = this.authService.getToken();
        const isAdmin = this.authService.isAdmin();

        if (!token || !isAdmin) {
            return of([]);
        }

        // Verificar cache primeiro
        const cacheKey = `role_${roleName}_${roleId || 'no_id'}`;
        const cachedData = this.modulesCache.get(cacheKey);

        if (cachedData && this.isCacheValid(cachedData.timestamp)) {
            this.modulesSubject.next(cachedData.data);
            return of(cachedData.data);
        }

        this.loadingSubject.next(true);

        const headers = {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json',
        };

        // Construir parâmetros
        let params = new HttpParams().set('role_name', roleName);

        if (roleId) {
            params = params.set('role_id', roleId.toString());
        }

        return this.http
            .get<ModulesApiResponse>(`${this.API_URL}/role`, { headers, params })
            .pipe(
                retryWhen((errors) =>
                    errors.pipe(
                        delayWhen(() => timer(this.RETRY_DELAY)),
                        tap((error) =>
                            console.warn(
                                `Tentativa de buscar módulos por cargo falhou: ${error.message}`,
                            ),
                        ),
                        map((error, index) => {
                            if (index >= this.MAX_RETRIES - 1) {
                                throw error;
                            }
                            return error;
                        }),
                    ),
                ),
                map((response) => {
                    if (
                        response &&
                        response.success &&
                        Array.isArray(response.data.modules)
                    ) {
                        return response.data.modules.map(
                            (apiModule: ApiModule): Module => ({
                                id: apiModule.id,
                                name: apiModule.name,
                                thumbnail_url: apiModule.image_path,
                                contentCount: apiModule.content_count || 0,
                                created_at: apiModule.created_at,
                                updated_at: apiModule.updated_at,
                                lessons:
                                    apiModule.lessons?.map((lesson) => ({
                                        id: lesson.id,
                                        uuid: lesson.uuid,
                                        name: lesson.name,
                                        description: lesson.description,
                                        thumbnail_url: lesson.thumbnail_url,
                                        video_url: lesson.video_url,
                                        created_at: lesson.created_at,
                                        updated_at: lesson.updated_at,
                                        deleted_at: lesson.deleted_at,
                                        pivot: lesson.pivot,
                                    })) || [],
                                }),
                            );
                    }
                    return [];
                }),
                tap((modules) => {
                    this.modulesCache.set(cacheKey, {
                        data: modules,
                        timestamp: Date.now(),
                    });
                    // Salvar no localStorage
                    localStorage.setItem('persisted_modules', JSON.stringify(modules));
                }),
                catchError(this.handleError.bind(this)),
                finalize(() => this.loadingSubject.next(false)),
                shareReplay(1),
            );
    }

    // Método para criar um novo módulo
    createModule(moduleData: any): Observable<any> {
        this.loadingSubject.next(true);

        return this.http.post<any>(this.API_URL, moduleData).pipe(
            tap((response) => {
                if (response && response.success) {
                    // Limpar cache para forçar recarregamento
                    this.clearCache();
                }
            }),
            catchError((error) => {
                console.error('Erro ao criar módulo:', error);
                return of(null);
            }),
            finalize(() => this.loadingSubject.next(false)),
        );
    }

    // Métodos auxiliares para cache e tratamento de erro
    private isCacheValid(timestamp: number): boolean {
        return Date.now() - timestamp < this.CACHE_DURATION;
    }

    private handleError(error: HttpErrorResponse): Observable<never> {
        let errorMessage = 'Erro ao carregar módulos';

        if (error.status === 401) {
            errorMessage = 'Não autorizado. Faça login novamente.';
        } else if (error.status === 403) {
            errorMessage = 'Você não tem permissão para acessar estes módulos.';
        } else if (error.status === 404) {
            errorMessage = 'Endpoint de módulos não encontrado.';
        } else if (error.status === 500) {
            errorMessage = 'Erro interno do servidor. Tente novamente mais tarde.';
        } else if (error.status === 0) {
            errorMessage = 'Erro de conexão. Verifique sua internet.';
        } else if (error.error?.message) {
            errorMessage = error.error.message;
        }

        console.error('Erro ao buscar módulos:', {
            status: error.status,
            message: error.error?.message || error.message,
            error: error.error,
        });

        return throwError(() => new Error(errorMessage));
    }

    // Método para limpar cache manualmente
    clearCache(): void {
        this.modulesCache.clear();
        this.modulesSubject.next([]);
    }

    /**
     * Remove uma aula específica de todos os módulos em cache
     * sem fazer requisições desnecessárias para o servidor
     */
    removeLessonFromAllCachedModules(lessonId: number): void {
        let hasChanges = false;

        // Atualizar todos os caches de módulos
        this.modulesCache.forEach((cacheEntry, cacheKey) => {
            const updatedModules = cacheEntry.data.map((module) => {
                if (module.lessons) {
                    const originalLength = module.lessons.length;
                    module.lessons = module.lessons.filter(
                        (lesson) => lesson.id !== lessonId,
                    );

                    // Se houve mudança no número de aulas, atualizar contentCount
                    if (module.lessons.length !== originalLength) {
                        module.contentCount = module.lessons.length;
                        hasChanges = true;
                    }
                }
                return module;
            });

            // Atualizar o cache com os módulos modificados
            this.modulesCache.set(cacheKey, {
                data: updatedModules,
                timestamp: cacheEntry.timestamp,
            });
        });

        // Se houve mudanças, notificar os subscribers
        if (hasChanges) {
            // Emitir o valor atual do cache principal (se houver)
            const currentModules = this.modulesSubject.value;
            if (currentModules.length > 0) {
                const updatedCurrentModules = currentModules.map((module) => {
                    if (module.lessons) {
                        module.lessons = module.lessons.filter(
                            (lesson) => lesson.id !== lessonId,
                        );
                        module.contentCount = module.lessons.length;
                    }
                    return module;
                });
                this.modulesSubject.next(updatedCurrentModules);
            }
        }
    }

    /**
     * Remove uma aula específica de um módulo específico em cache
     */
    removeLessonFromCachedModule(lessonId: number, moduleId: number): void {
        let hasChanges = false;

        // Atualizar todos os caches de módulos
        this.modulesCache.forEach((cacheEntry, cacheKey) => {
            const updatedModules = cacheEntry.data.map((module) => {
                if (module.id === moduleId && module.lessons) {
                    const originalLength = module.lessons.length;
                    module.lessons = module.lessons.filter(
                        (lesson) => lesson.id !== lessonId,
                    );

                    // Se houve mudança no número de aulas, atualizar contentCount
                    if (module.lessons.length !== originalLength) {
                        module.contentCount = module.lessons.length;
                        hasChanges = true;
                    }
                }
                return module;
            });

            // Atualizar o cache com os módulos modificados
            this.modulesCache.set(cacheKey, {
                data: updatedModules,
                timestamp: cacheEntry.timestamp,
            });
        });

        // Se houve mudanças, notificar os subscribers
        if (hasChanges) {
            // Emitir o valor atual do cache principal (se houver)
            const currentModules = this.modulesSubject.value;
            if (currentModules.length > 0) {
                const updatedCurrentModules = currentModules.map((module) => {
                    if (module.id === moduleId && module.lessons) {
                        module.lessons = module.lessons.filter(
                            (lesson) => lesson.id !== lessonId,
                        );
                        module.contentCount = module.lessons.length;
                    }
                    return module;
                });
                this.modulesSubject.next(updatedCurrentModules);
            }
        }
    }

    // Método para forçar refresh (ignorar cache)
    refreshModules(roleName?: string, roleId?: number): Observable<Module[]> {
        if (roleName) {
            // Limpar cache específico do cargo
            const cacheKey = `role_${roleName}_${roleId || 'no_id'}`;
            this.modulesCache.delete(cacheKey);
            return this.loadModulesByRole(roleName, roleId);
        } else {
            // Limpar cache geral
            this.clearCache();
            return this.loadModules();
        }
    }

    /**
     * Busca todos os módulos para admin, filtrando por role_id
     */
    getAllModulesForAdminByRoleId(
        roleId: number,
    ): Observable<{ modules: Module[]; totalModules: number }> {
        const token = this.authService.getToken();
        const isAdmin = this.authService.isAdmin();

        if (!token || !isAdmin) {
            return of({ modules: [], totalModules: 0 });
        }

        const url = `${this.API_URL}/all-admin?role_id=${roleId}`;
        const headers = {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json',
        };

        return this.http.get<ModulesApiResponse>(url, { headers }).pipe(
            map((response: ModulesApiResponse) => {
                if (!response.success) {
                    throw new Error(response.message || 'Erro ao carregar módulos');
                }

                const modules = response.data.modules.map(
                    (apiModule: ApiModule): Module => ({
                        id: apiModule.id,
                        name: apiModule.name,
                        thumbnail_url: apiModule.image_path,
                        contentCount: apiModule.content_count || 0,
                        created_at: apiModule.created_at,
                        updated_at: apiModule.updated_at,
                        lessons:
                            apiModule.lessons?.map((lesson) => ({
                                id: lesson.id,
                                uuid: lesson.uuid,
                                name: lesson.name,
                                description: lesson.description,
                                thumbnail_url: lesson.thumbnail_url,
                                video_url: lesson.video_url,
                                created_at: lesson.created_at,
                                updated_at: lesson.updated_at,
                                deleted_at: lesson.deleted_at,
                                pivot: lesson.pivot,
                            })) || [],
                        }),
                    );

                return {
                    modules,
                    totalModules: response.data.total_modules,
                };
            }),
            catchError((error) => this.handleError(error)),
        );
    }

    /**
     * Atribui módulos a um cargo usando /assign-to-roles
     */
    assignModulesToRoles(moduleIds: number[], roleId: number, token: string) {
        const url = `${environment.apiUrl}/api/v1/modules/assign-to-roles`;
        const headers = { Authorization: `Bearer ${token}` };
        return this.http.post<any>(
            url,
            { module_ids: moduleIds, role_id: roleId },
            { headers },
        );
    }

    /**
     * Deleta um módulo específico
     */
    deleteModule(moduleId: number, token: string): Observable<any> {
        const url = `${this.API_URL}/${moduleId}`;
        const headers = { Authorization: `Bearer ${token}` };

        return this.http.delete<any>(url, { headers }).pipe(
            tap(() => {
                // Limpar cache para forçar recarregamento
                this.clearCache();
            }),
            catchError((error) => {
                console.error('Erro ao deletar módulo:', error);
                return throwError(() => error);
            }),
        );
    }

    /**
     * Remove um módulo de um cargo específico
     */
    deleteModuleFromRole(
        moduleId: number,
        roleId: number,
        token: string,
    ): Observable<any> {
        const url = `${this.API_URL}/${moduleId}/role/${roleId}`;
        const headers = { Authorization: `Bearer ${token}` };

        return this.http.delete<any>(url, { headers }).pipe(
            tap(() => {
                // Limpar cache para forçar recarregamento
                this.clearCache();
            }),
            catchError((error) => {
                console.error('Erro ao remover módulo do cargo:', error);
                return throwError(() => error);
            }),
        );
    }
}
