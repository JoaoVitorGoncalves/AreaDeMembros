import { Injectable } from '@angular/core';
import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { BehaviorSubject, throwError, Observable, of } from 'rxjs';
import { map, catchError, tap, finalize, filter } from 'rxjs/operators';
import { AdminService } from './admin.service';
import { environment } from '../../environments/environment';

export interface Collaborator {
    id: number;
    uuid: string;
    name: string;
    email: string;
    type: 'recruiter' | 'editor';
    status: string;
    has_password: boolean;
    has_invite: boolean;
    last_login_at: string | null;
    created_at: string;
    tenant_hash: string | null;
}

export interface CreateCollaboratorRequest {
    name: string;
    email: string;
    type: 'recruiter' | 'editor';
    password?: string;
    generate_invite?: boolean;
}

export interface CollaboratorsResult {
    collaborators: Collaborator[];
    totalCollaborators: number;
    current_page: number;
    total_pages: number;
}

@Injectable({ providedIn: 'root' })
export class CollaboratorsService {
    private readonly API_URL = `${environment.apiUrl}/api/v1/collaborators`;
    private collaboratorsSubject = new BehaviorSubject<CollaboratorsResult | null>(null);
    public collaborators$ = this.collaboratorsSubject.asObservable().pipe(
        filter((result): result is CollaboratorsResult => result !== null)
    );
    private loadingSubject = new BehaviorSubject<boolean>(false);
    public loading$ = this.loadingSubject.asObservable();

    constructor(
        private http: HttpClient,
        private adminService: AdminService
    ) { }

    createCollaborator(data: CreateCollaboratorRequest): Observable<any> {
        this.loadingSubject.next(true);
        const payload: any = {
            name: data.name,
            email: data.email,
            type: data.type,
        };
        if (data.generate_invite) {
            payload.generate_invite = true;
        } else if (data.password) {
            payload.password = data.password;
        }

        return this.http.post<any>(this.API_URL, payload).pipe(
            map(response => response.data || response),
            tap(newCollaborator => {
                // Append to cache instead of clearing, so the list updates immediately
                const current = this.collaboratorsSubject.getValue();
                if (current) {
                    this.collaboratorsSubject.next({
                        ...current,
                        collaborators: [...current.collaborators, newCollaborator],
                        totalCollaborators: current.totalCollaborators + 1,
                    });
                } else {
                    this.collaboratorsSubject.next({
                        collaborators: [newCollaborator],
                        totalCollaborators: 1,
                        current_page: 1,
                        total_pages: 1,
                    });
                }
            }),
            catchError(error => this.handleError(error, 'Erro ao criar colaborador')),
            finalize(() => this.loadingSubject.next(false))
        );
    }

    getCollaborators(params?: { search?: string; type?: string; status?: string; page?: number; limit?: number }): Observable<CollaboratorsResult> {
        if (this.collaboratorsSubject.getValue()) {
            return this.collaborators$;
        }
        this.loadingSubject.next(true);
        let url = this.API_URL;
        const queryParams: string[] = [];
        if (params?.search) queryParams.push(`search=${encodeURIComponent(params.search)}`);
        if (params?.type) queryParams.push(`type=${params.type}`);
        if (params?.status) queryParams.push(`status=${params.status}`);
        if (params?.page) queryParams.push(`page=${params.page}`);
        if (params?.limit) queryParams.push(`limit=${params.limit}`);
        if (queryParams.length) url += '?' + queryParams.join('&');

        return this.http.get<any>(url).pipe(
            map(response => ({
                collaborators: response.data || [],
                totalCollaborators: response.pagination?.total || 0,
                current_page: response.pagination?.current_page || 1,
                total_pages: response.pagination?.total_pages || 1,
            })),
            tap(result => this.collaboratorsSubject.next(result)),
            catchError(error => {
                this.collaboratorsSubject.next(null);
                return this.handleError(error, 'Erro ao carregar colaboradores');
            }),
            finalize(() => this.loadingSubject.next(false))
        );
    }

    updateCollaborator(id: number, data: { name?: string; email?: string; type?: string; status?: string; regenerate_invite?: boolean }): Observable<any> {
        this.loadingSubject.next(true);
        return this.http.put<any>(`${this.API_URL}/${id}`, data).pipe(
            tap(() => this.clearCache()),
            map(response => response.data || response),
            catchError(error => this.handleError(error, 'Erro ao atualizar colaborador')),
            finalize(() => this.loadingSubject.next(false))
        );
    }

    deleteCollaborator(id: number): Observable<any> {
        this.loadingSubject.next(true);
        return this.http.delete<any>(`${this.API_URL}/${id}`).pipe(
            tap(() => this.clearCache()),
            catchError(error => this.handleError(error, 'Erro ao excluir colaborador')),
            finalize(() => this.loadingSubject.next(false))
        );
    }

    assignRoles(collaboratorId: number, roleIds: number[]): Observable<any> {
        return this.http.post<any>(`${this.API_URL}/${collaboratorId}/roles`, { role_ids: roleIds }).pipe(
            map(response => response.data || response),
            catchError(error => this.handleError(error, 'Erro ao atribuir cursos'))
        );
    }

    getAssignedRoles(collaboratorId: number): Observable<any[]> {
        return this.http.get<any>(`${this.API_URL}/${collaboratorId}/roles`).pipe(
            map(response => response.data?.roles || []),
            catchError(error => this.handleError(error, 'Erro ao carregar cursos atribuídos'))
        );
    }

    refreshCollaborators(): void {
        this.clearCache();
        this.getCollaborators().subscribe();
    }

    clearCache(): void {
        this.collaboratorsSubject.next(null);
    }

    private handleError(error: HttpErrorResponse, defaultMessage: string): Observable<never> {
        let message = defaultMessage;
        if (error.status === 401) message = 'Não autorizado. Faça login novamente.';
        else if (error.status === 403) message = error.error?.message || 'Acesso negado.';
        else if (error.status === 422) message = 'Dados inválidos. Verifique as informações.';
        else if (error.status === 404) message = 'Não encontrado.';
        else if (error.error?.message) message = error.error.message;
        return throwError(() => new Error(message));
    }
}
