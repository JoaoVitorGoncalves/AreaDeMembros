import { Injectable } from '@angular/core';
import { Router } from '@angular/router';
import { BehaviorSubject, Observable, throwError } from 'rxjs';
import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { map, catchError, tap } from 'rxjs/operators';
import { environment } from '../../environments/environment';

// Interfaces
interface LoginRequest {
    email: string;
    password: string;
}

interface RegisterRequest {
    name: string;
    email: string;
    phone: string;
    document: string;
    password: string;
    invite_token: string;
    admin_hash?: string;
}

export interface User {
    id: number;
    uuid: string;
    name: string;
    email: string;
    document: string;
    phone: string;
    roles: string[];
    is_admin?: boolean;
    created_at: string;
}

interface LoginResponse {
    success: boolean;
    message: string;
    timestamp: string;
    data: {
        user: User;
        token: string;
        token_type: string;
        expires_in: number;
    };
}

interface AuthError {
    message: string;
    status: number;
}

@Injectable({
    providedIn: 'root'
})
export class AuthService {

    private readonly API_URL = `${environment.apiUrl}/api/v1/auth`;
    private isLoggedInSubject = new BehaviorSubject<boolean>(this.hasToken());
    public isLoggedIn$ = this.isLoggedInSubject.asObservable();

    private loadingSubject = new BehaviorSubject<boolean>(false);
    public loading$ = this.loadingSubject.asObservable();

    constructor(
        private router: Router,
        private http: HttpClient
    ) { }

    private hasToken(): boolean {
        return localStorage.getItem('access_token') !== null;
    }

    login(email: string, password: string): Observable<LoginResponse> {
        this.loadingSubject.next(true);

        const loginData: LoginRequest = { email, password };

        return this.http.post<LoginResponse>(`${this.API_URL}/login`, loginData)
            .pipe(
                tap((response: LoginResponse) => {
                    if (response.success && response.data?.token) {
                        localStorage.setItem('access_token', response.data.token);
                        localStorage.setItem('token_type', response.data.token_type);
                        localStorage.setItem('expires_in', response.data.expires_in.toString());
                        localStorage.setItem('userEmail', email);
                        localStorage.setItem('user', JSON.stringify(response.data.user));

                        this.isLoggedInSubject.next(true);
                    }
                }),
                catchError((error: HttpErrorResponse) => this.handleLoginError(error)),
                tap(() => this.loadingSubject.next(false))
            );
    }

    register(data: RegisterRequest): Observable<LoginResponse> {
        return this.http.post<LoginResponse>(`${this.API_URL}/register`, data).pipe(
            tap((response: LoginResponse) => {
                if (response.success && response.data?.token) {
                    localStorage.setItem('access_token', response.data.token);
                    localStorage.setItem('token_type', response.data.token_type);
                    localStorage.setItem('expires_in', response.data.expires_in.toString());
                    localStorage.setItem('userEmail', data.email);
                    localStorage.setItem('user', JSON.stringify(response.data.user));

                    this.isLoggedInSubject.next(true);
                }
            }),
            catchError((error: HttpErrorResponse) => this.handleLoginError(error))
        );
    }

    private handleLoginError(error: HttpErrorResponse): Observable<never> {
        this.loadingSubject.next(false);

        let errorMessage = 'Erro interno do servidor';

        if (error.status === 401) {
            errorMessage = 'Email ou senha incorretos';
        } else if (error.status === 403) {
            errorMessage = error.error?.message || 'Acesso não autorizado';
        } else if (error.status === 404) {
            errorMessage = error.error?.message || 'Link de convite inválido';
        } else if (error.status === 409) {
            errorMessage = error.error?.message || 'Usuário já existe com este email ou documento';
        } else if (error.status === 422) {
            const errors = error.error?.errors;
            if (errors) {
                const allMessages: string[] = [];
                for (const field in errors) {
                    if (Array.isArray(errors[field])) {
                        allMessages.push(...errors[field]);
                    }
                }
                errorMessage = allMessages.length > 0 ? allMessages.join('. ') : 'Dados inválidos';
            } else {
                errorMessage = 'Dados inválidos';
            }
        } else if (error.status === 500) {
            if (error.error?.message?.includes('Rate limiter'))
                errorMessage = 'Servidor temporariamente indisponível. Tente novamente em alguns minutos.';
            else
                errorMessage = 'Erro interno do servidor. Contate o suporte.';
        } else if (error.status === 0) {
            errorMessage = 'Erro de conexão. Verifique sua internet';
        } else if (error.error?.message) {
            errorMessage = error.error.message;
        }

        console.error('Erro de autenticação detalhado:', {
            status: error.status,
            message: error.error?.message || error.message,
            error: error.error
        });

        const authError: AuthError = { message: errorMessage, status: error.status };
        return throwError(() => authError);
    }

    logout(): void {
        localStorage.clear();
        this.isLoggedInSubject.next(false);
        this.router.navigate(['/login']);
    }

    isAuthenticated(): boolean {
        return this.hasToken();
    }

    getUserEmail(): string | null {
        return localStorage.getItem('userEmail');
    }

    getToken(): string | null {
        return localStorage.getItem('access_token');
    }

    getTokenType(): string | null {
        return localStorage.getItem('token_type');
    }

    getFullAuthToken(): string | null {
        const token = this.getToken();
        const tokenType = this.getTokenType();
        return token && tokenType ? `${tokenType} ${token}` : null;
    }

    getUser(): User | null {
        const user = localStorage.getItem('user');
        return user ? JSON.parse(user) : null;
    }

    isAdmin(): boolean {
        const user = this.getUser();
        if (!user || !user.roles) return false;
        if (user.is_admin !== undefined) return user.is_admin;
        return user.roles.some(role =>
            ['admin', 'administrator', 'adm', 'Adm'].includes(role.toLowerCase())
        );
    }

    getTokenExpirationTime(): number | null {
        const expiresIn = localStorage.getItem('expires_in');
        return expiresIn ? parseInt(expiresIn) : null;
    }
} 