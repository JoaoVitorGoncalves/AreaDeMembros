import { Injectable } from '@angular/core';
import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { BehaviorSubject, throwError, timer, Observable, of } from 'rxjs';
import { map, catchError, shareReplay, tap, finalize, retryWhen, delayWhen, filter, switchMap, take } from 'rxjs/operators';
import { Tool, ToolsResponse } from '../models/tool.model';
import { environment } from '../../environments/environment';

export interface ToolsResult {
    tools: Tool[];
    totalTools: number;
    hasNoToolsForUser: boolean;
}

@Injectable({
    providedIn: 'root'
})
export class ToolsService {
    private readonly API_URL = `${environment.apiUrl}/api/v1/tools`;
    private readonly CACHE_DURATION = 300000; // 5 minutos
    private readonly MAX_RETRIES = 3;
    private readonly RETRY_DELAY = 1000;

    public toolsSubject = new BehaviorSubject<ToolsResult | null>(null);
    private toolsCache$: Observable<ToolsResult> = this.toolsSubject.asObservable().pipe(
        filter((result): result is ToolsResult => result !== null),
        shareReplay(1)
    );
    private cacheTimestamp: number = 0;
    private loadingSubject = new BehaviorSubject<boolean>(false);

    public loading$ = this.loadingSubject.asObservable();

    constructor(private http: HttpClient) { }

    getTools(): Observable<ToolsResult> {
        if (!this.toolsSubject.getValue() || !this.isCacheValid()) {
            this.fetchToolsFromServer();
        }
        return this.toolsCache$;
    }

    private fetchToolsFromServer(): void {
        this.loadingSubject.next(true);
        this.http.get<ToolsResponse>(this.API_URL).pipe(
            retryWhen(errors =>
                errors.pipe(
                    delayWhen(() => timer(this.RETRY_DELAY)),
                    tap(error => console.warn(`Tentativa de buscar ferramentas falhou: ${error.message}`)),
                    map((error, index) => {
                        if (index >= this.MAX_RETRIES - 1) {
                            throw error;
                        }
                        return error;
                    })
                )
            ),
            map((response: ToolsResponse) => {
                if (!response.success) {
                    throw new Error(response.message || 'Erro ao carregar ferramentas');
                }

                const totalTools = response.data.total_tools;
                const hasNoToolsForUser = totalTools === 0;

                return {
                    tools: response.data.tools,
                    totalTools,
                    hasNoToolsForUser
                } as ToolsResult;
            }),
            tap((result) => {
                this.cacheTimestamp = Date.now();
                this.toolsSubject.next(result);
            }),
            catchError(error => {
                this.toolsSubject.next(null); // Limpa o cache em caso de erro
                return this.handleError(error);
            }),
            finalize(() => this.loadingSubject.next(false))
        ).subscribe(); // Subscribe to trigger the request
    }

    private isCacheValid(): boolean {
        return Date.now() - this.cacheTimestamp < this.CACHE_DURATION;
    }

    private handleError(error: HttpErrorResponse): Observable<never> {
        let errorMessage = 'Erro ao carregar ferramentas';

        if (error.status === 401) {
            errorMessage = 'Não autorizado. Faça login novamente.';
        } else if (error.status === 403) {
            errorMessage = 'Você não tem permissão para acessar estas ferramentas.';
        } else if (error.status === 404) {
            errorMessage = 'Endpoint de ferramentas não encontrado.';
        } else if (error.status === 500) {
            errorMessage = 'Erro interno do servidor. Tente novamente mais tarde.';
        } else if (error.status === 0) {
            errorMessage = 'Erro de conexão. Verifique sua internet.';
        } else if (error.error?.message) {
            errorMessage = error.error.message;
        }

        console.error('Erro ao buscar ferramentas:', {
            status: error.status,
            message: error.error?.message || error.message,
            error: error.error
        });

        return throwError(() => new Error(errorMessage));
    }

    // Método para criar uma nova ferramenta
    createTool(toolData: Partial<Tool>): Observable<Tool> {
        this.loadingSubject.next(true);

        const newTool: Tool = {
            ...toolData,
            uuid: `temp-${Date.now()}`,
            id: Math.random(),
            name: toolData.name || '',
            description: toolData.description || '',
            image_url: toolData.image_url || '',
            link: toolData.link || '',
        };

        return this.http.post<any>(this.API_URL, toolData).pipe(
            tap(() => {
                const currentData = this.toolsSubject.getValue();
                if (currentData) {
                    const updatedResult: ToolsResult = {
                        ...currentData,
                        tools: [...currentData.tools, newTool],
                        totalTools: currentData.totalTools + 1,
                        hasNoToolsForUser: false,
                    };
                    this.toolsSubject.next(updatedResult);
                } else {
                    this.clearCache();
                }
            }),
            map(() => newTool), // Retorna a nova ferramenta criada localmente
            catchError(err => {
                // Em caso de erro, removemos a ferramenta adicionada optimisticamente.
                const currentData = this.toolsSubject.getValue();
                if (currentData) {
                    const updatedResult: ToolsResult = {
                        ...currentData,
                        tools: currentData.tools.filter(t => t.uuid !== newTool.uuid),
                        totalTools: currentData.totalTools > 0 ? currentData.totalTools - 1 : 0,
                        hasNoToolsForUser: currentData.tools.length - 1 === 0,
                    };
                    this.toolsSubject.next(updatedResult);
                }
                return this.handleError(err);
            }),
            finalize(() => this.loadingSubject.next(false))
        );
    }

    // Método para limpar cache manualmente
    clearCache(): void {
        this.toolsSubject.next(null);
        this.cacheTimestamp = 0;
    }

    /**
     * Adiciona ferramentas ao cache local e atualiza o observable
     */
    public addToolsToCache(newTools: Tool[]): void {
        const currentData = this.toolsSubject.getValue();
        if (currentData) {
            // Evita duplicatas
            const existingIds = new Set(currentData.tools.map(t => t.id));
            const filteredNewTools = newTools.filter(t => !existingIds.has(t.id));
            if (filteredNewTools.length > 0) {
                const updatedResult: ToolsResult = {
                    ...currentData,
                    tools: [...currentData.tools, ...filteredNewTools],
                    totalTools: currentData.totalTools + filteredNewTools.length,
                    hasNoToolsForUser: false,
                };
                this.toolsSubject.next(updatedResult);
            }
        } else {
            // Se não há cache, cria um novo
            const updatedResult: ToolsResult = {
                tools: newTools,
                totalTools: newTools.length,
                hasNoToolsForUser: newTools.length === 0,
            };
            this.toolsSubject.next(updatedResult);
        }
    }

    /**
     * Busca ferramentas por cargo (roleName) com cache inteligente
     */
    getToolsByRole(roleName: string, forceRefresh: boolean = false): Observable<ToolsResult> {
        const cacheKey = `role_${roleName}`;
        const now = Date.now();
        // Implementação de cache simples por cargo
        if (!forceRefresh && this.toolsSubject.getValue() && this.isCacheValid() && (this as any)._lastRoleKey === cacheKey) {
            return this.toolsCache$;
        }
        (this as any)._lastRoleKey = cacheKey;
        this.loadingSubject.next(true);
        const url = `${this.API_URL}/role-name/${roleName}`;
        return this.http.get<ToolsResponse>(url).pipe(
            map(response => {
                if (!response.success) {
                    throw new Error(response.message || 'Erro ao carregar ferramentas');
                }
                const totalTools = response.data.total_tools;
                const hasNoToolsForUser = totalTools === 0;
                const result: ToolsResult = {
                    tools: response.data.tools,
                    totalTools,
                    hasNoToolsForUser
                };
                this.cacheTimestamp = now;
                this.toolsSubject.next(result);
                return result;
            }),
            catchError(error => {
                this.toolsSubject.next(null);
                return this.handleError(error);
            }),
            finalize(() => this.loadingSubject.next(false)),
            shareReplay(1)
        );
    }

    /**
     * Carrega ferramentas por cargo (roleName)
     */
    loadTools(roleName: string): Observable<ToolsResult> {
        return this.getToolsByRole(roleName);
    }

    /**
     * Força refresh das ferramentas por cargo (roleName)
     */
    refreshTools(roleName: string): Observable<ToolsResult> {
        return this.getToolsByRole(roleName, true);
    }

    /**
     * Atribui ferramentas a um cargo usando /assign-to-roles
     */
    assignToolsToRoles(toolIds: number[], roleId: number, token: string) {
        const url = `${environment.apiUrl}/api/v1/tools/assign-to-roles`;
        const headers = { 'Authorization': `Bearer ${token}` };
        return this.http.post<any>(url, { tool_ids: toolIds, role_id: roleId }, { headers });
    }

    /**
     * Busca todas as ferramentas para admin, filtrando por role_id
     */
    getAllToolsForAdminByRoleId(roleId: number): Observable<ToolsResult> {
        const url = `${this.API_URL}/all-admin?role_id=${roleId}`;
        return this.http.get<ToolsResponse>(url).pipe(
            map((response: ToolsResponse) => {
                if (!response.success) {
                    throw new Error(response.message || 'Erro ao carregar ferramentas');
                }
                const totalTools = response.data.total_tools;
                const hasNoToolsForUser = totalTools === 0;
                return {
                    tools: response.data.tools,
                    totalTools,
                    hasNoToolsForUser
                } as ToolsResult;
            }),
            catchError(error => this.handleError(error))
        );
    }

    /**
     * Exclui uma ferramenta pelo id
     */
    deleteTool(toolId: number, token: string): Observable<any> {
        const url = `${this.API_URL}/${toolId}`;
        const headers: any = { 'Authorization': `Bearer ${token}` };
        return this.http.delete<any>(url, { headers }).pipe(
            tap(() => {
                // Remove da lista local
                const currentData = this.toolsSubject.getValue();
                if (currentData) {
                    const updatedResult: ToolsResult = {
                        ...currentData,
                        tools: currentData.tools.filter(t => t.id !== toolId),
                        totalTools: Math.max(0, currentData.totalTools - 1),
                        hasNoToolsForUser: (currentData.totalTools - 1) === 0
                    };
                    this.toolsSubject.next(updatedResult);
                }
            }),
            catchError(err => this.handleError(err))
        );
    }

    /**
     * Remove uma ferramenta de um cargo específico
     */
    deleteToolFromRole(toolId: number, roleId: number, token: string): Observable<any> {
        const url = `${this.API_URL}/${toolId}/role/${roleId}`;
        const headers: any = { 'Authorization': `Bearer ${token}` };
        return this.http.delete<any>(url, { headers }).pipe(
            tap(() => {
                // Remove da lista local
                const currentData = this.toolsSubject.getValue();
                if (currentData) {
                    const updatedResult: ToolsResult = {
                        ...currentData,
                        tools: currentData.tools.filter(t => t.id !== toolId),
                        totalTools: Math.max(0, currentData.totalTools - 1),
                        hasNoToolsForUser: (currentData.totalTools - 1) === 0
                    };
                    this.toolsSubject.next(updatedResult);
                }
            }),
            catchError(err => this.handleError(err))
        );
    }
} 