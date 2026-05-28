import { Injectable } from '@angular/core';
import { HttpClient, HttpErrorResponse, HttpHeaders } from '@angular/common/http';
import { BehaviorSubject, throwError, timer, Observable, of } from 'rxjs';
import { map, catchError, shareReplay, tap, finalize, retryWhen, delayWhen, filter } from 'rxjs/operators';
import { AuthService } from './auth.service';
import { environment } from '../../environments/environment';

export interface Collaborator {
    id: number;
    name: string;
    email: string;
    last_access: string;
    role: string;
    status: string;
    permissions: string[];
}

export interface CreateCollaboratorRequest {
    name: string;
    document: string;
    phone: string;
    email: string;
    password: string;
    role: string;
    permissions: string[];
}

export interface CreateCollaboratorResponse {
    success: boolean;
    message: string;
    data?: any;
}

export interface CollaboratorsResponse {
    success: boolean;
    message: string;
    data: any[]; // array de colaboradores
    pagination: {
        current_page: number;
        per_page: number;
        total: number;
        total_pages: number;
        has_more: boolean;
    };
}

export interface CollaboratorsResult {
    collaborators: any[];
    totalCollaborators: number;
}

@Injectable({ providedIn: 'root' })
export class CollaboratorsService {
    private readonly API_URL = `${environment.apiUrl}/api/v1/users/admins`;
    private readonly CACHE_DURATION = 300000; // 5 minutos
    private readonly MAX_RETRIES = 3;
    private readonly RETRY_DELAY = 1000;

    private collaboratorsSubject = new BehaviorSubject<CollaboratorsResult | null>(null);
    public collaborators$ = this.collaboratorsSubject.asObservable().pipe(
        filter((result): result is CollaboratorsResult => result !== null)
    );
    private cacheTimestamp: number = 0;
    private loadingSubject = new BehaviorSubject<boolean>(false);
    public loading$ = this.loadingSubject.asObservable();
    private inFlightRequest$: Observable<CollaboratorsResult> | null = null;

    constructor(private http: HttpClient, private authService: AuthService) { }

    createCollaborator(collaboratorData: CreateCollaboratorRequest): Observable<any> {
        // Validação de admin
        if (!this.authService.isAdmin()) {
            return throwError(() => new Error('Acesso negado: apenas administradores podem criar colaboradores.'));
        }

        // Validação de token
        const token = this.authService.getToken();
        if (!token) {
            return throwError(() => new Error('Token de autenticação não encontrado. Faça login novamente.'));
        }

        const headers = new HttpHeaders({
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
        });

        // Cria um novo colaborador localmente para adicionar à lista
        const newCollaborator: Collaborator = {
            id: Math.random(), // ID temporário
            name: collaboratorData.name,
            email: collaboratorData.email,
            last_access: new Date().toISOString(),
            role: collaboratorData.role,
            status: 'active',
            permissions: collaboratorData.permissions
        };

        return this.http.post<CreateCollaboratorResponse>(this.API_URL, collaboratorData, { headers }).pipe(
            tap(() => {
                // Adiciona o novo colaborador à lista local
                const currentData = this.collaboratorsSubject.getValue();
                if (currentData) {
                    const updatedResult: CollaboratorsResult = {
                        ...currentData,
                        collaborators: [...currentData.collaborators, newCollaborator],
                        totalCollaborators: currentData.totalCollaborators + 1
                    };
                    this.collaboratorsSubject.next(updatedResult);
                } else {
                    this.clearCache();
                }
            }),
            map((response: CreateCollaboratorResponse) => {
                if (!response.success) {
                    throw new Error(response.message || 'Erro ao criar colaborador');
                }
                return newCollaborator;
            }),
            catchError(error => {
                // Em caso de erro, remove o colaborador adicionado optimisticamente
                const currentData = this.collaboratorsSubject.getValue();
                if (currentData) {
                    const updatedResult: CollaboratorsResult = {
                        ...currentData,
                        collaborators: currentData.collaborators.filter(c => c.id !== newCollaborator.id),
                        totalCollaborators: currentData.totalCollaborators > 0 ? currentData.totalCollaborators - 1 : 0
                    };
                    this.collaboratorsSubject.next(updatedResult);
                }
                return this.handleCreateError(error);
            }),
            finalize(() => this.loadingSubject.next(false))
        );
    }

    /**
     * Busca colaboradores, usando cache e evitando requests duplicados.
     * Se já houver uma requisição em andamento, retorna o mesmo observable.
     */
    getCollaborators(): Observable<CollaboratorsResult> {
        if (!this.authService.isAdmin()) {
            return throwError(() => new Error('Acesso negado: apenas administradores podem visualizar colaboradores.'));
        }
        // Se já temos dados válidos em cache, retorna imediatamente
        if (this.collaboratorsSubject.getValue() && this.isCacheValid()) {
            return this.collaborators$;
        }
        // Se já existe uma requisição em andamento, retorna ela
        if (this.inFlightRequest$) {
            return this.inFlightRequest$;
        }
        // Caso contrário, dispara a requisição e compartilha
        this.loadingSubject.next(true);
        const token = this.authService.getToken();
        const headers = new HttpHeaders({
            'Authorization': `Bearer ${token}`
        });
        this.inFlightRequest$ = this.http.get<CollaboratorsResponse>(this.API_URL, { headers }).pipe(
            retryWhen(errors =>
                errors.pipe(
                    delayWhen(() => timer(this.RETRY_DELAY)),
                    tap(error => console.warn(`Tentativa de buscar colaboradores falhou: ${error.message}`)),
                    map((error, index) => {
                        if (index >= this.MAX_RETRIES - 1) {
                            throw error;
                        }
                        return error;
                    })
                )
            ),
            map((response: CollaboratorsResponse) => {
                if (!response.success) {
                    throw new Error(response.message || 'Erro ao carregar colaboradores');
                }
                return {
                    collaborators: response.data,
                    totalCollaborators: response.pagination?.total || response.data.length
                } as CollaboratorsResult;
            }),
            tap((result) => {
                this.cacheTimestamp = Date.now();
                this.collaboratorsSubject.next(result);
            }),
            catchError(error => {
                this.collaboratorsSubject.next(null); // Limpa o cache em caso de erro
                return this.handleError(error);
            }),
            finalize(() => {
                this.loadingSubject.next(false);
                this.inFlightRequest$ = null;
            }),
            shareReplay(1)
        );
        return this.inFlightRequest$;
    }

    private fetchCollaboratorsFromServer(): void {
        this.loadingSubject.next(true);
        const token = this.authService.getToken();
        const headers = new HttpHeaders({
            'Authorization': `Bearer ${token}`
        });
        this.http.get<CollaboratorsResponse>(this.API_URL, { headers }).pipe(
            retryWhen(errors =>
                errors.pipe(
                    delayWhen(() => timer(this.RETRY_DELAY)),
                    tap(error => console.warn(`Tentativa de buscar colaboradores falhou: ${error.message}`)),
                    map((error, index) => {
                        if (index >= this.MAX_RETRIES - 1) {
                            throw error;
                        }
                        return error;
                    })
                )
            ),
            map((response: CollaboratorsResponse) => {
                if (!response.success) {
                    throw new Error(response.message || 'Erro ao carregar colaboradores');
                }
                return {
                    collaborators: response.data,
                    totalCollaborators: response.pagination?.total || response.data.length
                } as CollaboratorsResult;
            }),
            tap((result) => {
                this.cacheTimestamp = Date.now();
                this.collaboratorsSubject.next(result);
            }),
            catchError(error => {
                this.collaboratorsSubject.next(null); // Limpa o cache em caso de erro
                return this.handleError(error);
            }),
            finalize(() => this.loadingSubject.next(false))
        ).subscribe();
    }

    private isCacheValid(): boolean {
        return Date.now() - this.cacheTimestamp < this.CACHE_DURATION;
    }

    refreshCollaborators(): void {
        this.clearCache();
        this.getCollaborators().subscribe();
    }

    private clearCache(): void {
        this.collaboratorsSubject.next(null);
        this.cacheTimestamp = 0;
    }

    private handleCreateError(error: HttpErrorResponse): Observable<never> {
        let errorMessage = 'Erro ao criar colaborador';

        if (error.status === 401) {
            errorMessage = 'Não autorizado. Faça login novamente.';
        } else if (error.status === 403) {
            errorMessage = 'Você não tem permissão para criar colaboradores.';
        } else if (error.status === 409) {
            errorMessage = 'Colaborador já existe com este email ou documento.';
        } else if (error.status === 422) {
            errorMessage = 'Dados inválidos. Verifique as informações fornecidas.';
        } else if (error.status === 500) {
            errorMessage = 'Erro interno do servidor. Tente novamente mais tarde.';
        } else if (error.status === 0) {
            errorMessage = 'Erro de conexão. Verifique sua internet.';
        } else if (error.error?.message) {
            errorMessage = error.error.message;
        }

        console.error('Erro ao criar colaborador:', {
            status: error.status,
            message: error.error?.message || error.message,
            error: error.error
        });

        return throwError(() => new Error(errorMessage));
    }

    private handleError(error: HttpErrorResponse): Observable<never> {
        let errorMessage = 'Erro ao carregar colaboradores';
        if (error.status === 401) {
            errorMessage = 'Não autorizado. Faça login novamente.';
        } else if (error.status === 403) {
            errorMessage = 'Você não tem permissão para acessar estes colaboradores.';
        } else if (error.status === 404) {
            errorMessage = 'Endpoint de colaboradores não encontrado.';
        } else if (error.status === 500) {
            errorMessage = 'Erro interno do servidor. Tente novamente mais tarde.';
        } else if (error.status === 0) {
            errorMessage = 'Erro de conexão. Verifique sua internet.';
        } else if (error.error?.message) {
            errorMessage = error.error.message;
        }
        console.error('Erro ao buscar colaboradores:', {
            status: error.status,
            message: error.error?.message || error.message,
            error: error.error
        });
        return throwError(() => new Error(errorMessage));
    }
} 