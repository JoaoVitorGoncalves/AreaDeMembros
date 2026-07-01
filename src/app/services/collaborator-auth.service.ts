import { Injectable } from '@angular/core';
import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { BehaviorSubject, Observable, throwError } from 'rxjs';
import { catchError, tap } from 'rxjs/operators';
import { Router } from '@angular/router';
import { environment } from '../../environments/environment';

export interface CollaboratorUser {
    id: number;
    uuid: string;
    name: string;
    email: string;
    type: 'recruiter' | 'editor';
    tenant_hash: string;
}

interface CollaboratorLoginResponse {
    success: boolean;
    message: string;
    data: {
        collaborator: CollaboratorUser;
        token: string;
        token_type: string;
        expires_in: number;
    };
}

interface AcceptInviteResponse {
    success: boolean;
    message: string;
    data: {
        collaborator: CollaboratorUser;
        token: string;
        token_type: string;
        expires_in: number;
    };
}

@Injectable({ providedIn: 'root' })
export class CollaboratorAuthService {
    private readonly API_URL = `${environment.apiUrl}/api/v1/collaborator`;
    private isLoggedInSubject = new BehaviorSubject<boolean>(this.hasToken());
    public isLoggedIn$ = this.isLoggedInSubject.asObservable();

    constructor(
        private http: HttpClient,
        private router: Router
    ) { }

    private hasToken(): boolean {
        return localStorage.getItem('collaborator_token') !== null;
    }

    getToken(): string | null {
        return localStorage.getItem('collaborator_token');
    }

    getUser(): CollaboratorUser | null {
        const data = localStorage.getItem('collaborator_user');
        return data ? JSON.parse(data) : null;
    }

    isAuthenticated(): boolean {
        return this.hasToken();
    }

    getType(): 'recruiter' | 'editor' | null {
        const user = this.getUser();
        return user?.type || null;
    }

    isRecruiter(): boolean {
        return this.getType() === 'recruiter';
    }

    isEditor(): boolean {
        return this.getType() === 'editor';
    }

    getTenantHash(): string | null {
        const user = this.getUser();
        return user?.tenant_hash || null;
    }

    login(email: string, password: string): Observable<CollaboratorLoginResponse> {
        return this.http.post<CollaboratorLoginResponse>(`${this.API_URL}/login`, { email, password }).pipe(
            tap(response => {
                if (response.success && response.data?.token) {
                    this.setSession(response.data);
                }
            }),
            catchError((error: HttpErrorResponse) => {
                const message = error.status === 401
                    ? 'Email ou senha incorretos'
                    : error.error?.message || 'Erro ao fazer login';
                return throwError(() => ({ message, status: error.status }));
            })
        );
    }

    acceptInvite(inviteToken: string, name: string, email: string, password: string): Observable<AcceptInviteResponse> {
        return this.http.post<AcceptInviteResponse>(`${this.API_URL}/accept-invite`, {
            invite_token: inviteToken,
            name,
            email,
            password
        }).pipe(
            tap(response => {
                if (response.success && response.data?.token) {
                    this.setSession(response.data);
                }
            }),
            catchError((error: HttpErrorResponse) => {
                const message = error.status === 404
                    ? 'Link de convite inválido'
                    : error.status === 409
                        ? 'Este convite já foi utilizado'
                        : error.error?.message || 'Erro ao aceitar convite';
                return throwError(() => ({ message, status: error.status }));
            })
        );
    }

    acceptInviteWithDetails(inviteToken: string, password: string, name?: string, email?: string): Observable<AcceptInviteResponse> {
        const payload: any = {
            invite_token: inviteToken,
            password
        };
        if (name) payload.name = name;
        if (email) payload.email = email;

        return this.http.post<AcceptInviteResponse>(`${this.API_URL}/accept-invite`, payload).pipe(
            tap(response => {
                if (response.success && response.data?.token) {
                    this.setSession(response.data);
                }
            }),
            catchError((error: HttpErrorResponse) => {
                const message = error.status === 404
                    ? 'Link de convite inválido'
                    : error.status === 409
                        ? 'Este convite já foi utilizado'
                        : error.error?.message || 'Erro ao aceitar convite';
                return throwError(() => ({ message, status: error.status }));
            })
        );
    }

    acceptInviteAsCollaborator(inviteToken: string, password: string): Observable<AcceptInviteResponse> {
        return this.http.post<AcceptInviteResponse>(`${this.API_URL}/accept-invite`, {
            invite_token: inviteToken,
            password
        }).pipe(
            tap(response => {
                if (response.success && response.data?.token) {
                    this.setSession(response.data);
                }
            }),
            catchError((error: HttpErrorResponse) => {
                const message = error.status === 404
                    ? 'Link de convite inválido'
                    : error.status === 409
                        ? 'Este convite já foi utilizado'
                        : error.error?.message || 'Erro ao aceitar convite';
                return throwError(() => ({ message, status: error.status }));
            })
        );
    }

    logout(): void {
        const token = this.getToken();
        if (token) {
            this.http.post(`${this.API_URL}/logout`, {}, {
                headers: { Authorization: `Bearer ${token}` }
            }).subscribe({ error: () => {} });
        }
        this.clearSession();
    }

    clearSession(): void {
        localStorage.removeItem('collaborator_token');
        localStorage.removeItem('collaborator_token_type');
        localStorage.removeItem('collaborator_user');
        this.isLoggedInSubject.next(false);
    }

    private setSession(data: CollaboratorLoginResponse['data']): void {
        localStorage.setItem('collaborator_token', data.token);
        localStorage.setItem('collaborator_token_type', data.token_type);
        localStorage.setItem('collaborator_user', JSON.stringify(data.collaborator));
        this.isLoggedInSubject.next(true);
    }
}
