import { Injectable } from '@angular/core';
import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { BehaviorSubject, Observable, throwError } from 'rxjs';
import { map, catchError, tap } from 'rxjs/operators';
import { environment } from '../../environments/environment';

export interface AdminUser {
    id: number;
    uuid: string;
    name: string;
    email: string;
    tenant_hash: string;
    is_super_admin: boolean;
    created_at: string;
    stats?: {
        roles_count: number;
        modules_count: number;
        users_count: number;
        tools_count: number;
    };
}

interface AdminLoginResponse {
    success: boolean;
    message: string;
    data: {
        admin: AdminUser;
        token: string;
        token_type: string;
        expires_in: number;
    };
}

interface AdminRegisterResponse {
    success: boolean;
    message: string;
    data: {
        admin: AdminUser;
    };
}

interface AdminListResponse {
    success: boolean;
    data: {
        admins: AdminUser[];
        total: number;
    };
}

@Injectable({ providedIn: 'root' })
export class AdminService {
    private readonly API_URL = `${environment.apiUrl}/api/v1/admin`;
    private isLoggedInSubject = new BehaviorSubject<boolean>(this.hasToken());
    public isLoggedIn$ = this.isLoggedInSubject.asObservable();
    private loadingSubject = new BehaviorSubject<boolean>(false);
    public loading$ = this.loadingSubject.asObservable();
    private currentAdminSubject = new BehaviorSubject<AdminUser | null>(this.getAdmin());
    public currentAdmin$ = this.currentAdminSubject.asObservable();

    constructor(private http: HttpClient) { }

    private hasToken(): boolean {
        return localStorage.getItem('admin_access_token') !== null;
    }

    getToken(): string | null {
        return localStorage.getItem('admin_access_token');
    }

    getTokenType(): string | null {
        return localStorage.getItem('admin_token_type');
    }

    getFullAuthToken(): string | null {
        const token = this.getToken();
        const tokenType = this.getTokenType();
        return token && tokenType ? `${tokenType} ${token}` : null;
    }

    getTenantHash(): string | null {
        return localStorage.getItem('admin_tenant_hash');
    }

    getAdmin(): AdminUser | null {
        const data = localStorage.getItem('admin_user');
        return data ? JSON.parse(data) : null;
    }

    isAuthenticated(): boolean {
        return this.hasToken();
    }

    isSuperAdmin(): boolean {
        const admin = this.getAdmin();
        return admin?.is_super_admin === true;
    }

    login(email: string, password: string): Observable<AdminLoginResponse> {
        this.loadingSubject.next(true);
        return this.http.post<AdminLoginResponse>(`${this.API_URL}/login`, {
            email,
            password,
            // For existing admin users, also check via regular auth
        }).pipe(
            tap(response => {
                if (response.success && response.data?.token) {
                    this.setSession(response.data);
                }
            }),
            catchError((error: HttpErrorResponse) => {
                this.loadingSubject.next(false);
                const message = error.status === 401
                    ? 'Email ou senha incorretos'
                    : error.error?.message || 'Erro ao fazer login';
                return throwError(() => ({ message, status: error.status }));
            }),
            tap(() => this.loadingSubject.next(false))
        );
    }

    register(name: string, email: string, password: string): Observable<AdminRegisterResponse> {
        this.loadingSubject.next(true);
        return this.http.post<AdminRegisterResponse>(`${this.API_URL}/register`, {
            name, email, password
        }).pipe(
            tap(() => this.loadingSubject.next(false)),
            catchError(error => {
                this.loadingSubject.next(false);
                const message = error.error?.message || 'Erro ao criar admin';
                return throwError(() => ({ message }));
            })
        );
    }

    listAdmins(): Observable<AdminListResponse> {
        return this.http.get<AdminListResponse>(`${this.API_URL}/list`);
    }

    getProfile(): Observable<any> {
        return this.http.get(`${this.API_URL}/profile`);
    }

    logout(): void {
        this.http.post(`${this.API_URL}/logout`, {}).subscribe({
            error: () => { }
        });
        this.clearSession();
    }

    clearSession(): void {
        localStorage.removeItem('admin_access_token');
        localStorage.removeItem('admin_token_type');
        localStorage.removeItem('admin_expires_in');
        localStorage.removeItem('admin_user');
        localStorage.removeItem('admin_tenant_hash');
        this.isLoggedInSubject.next(false);
        this.currentAdminSubject.next(null);
    }

    private setSession(data: AdminLoginResponse['data']): void {
        localStorage.setItem('admin_access_token', data.token);
        localStorage.setItem('admin_token_type', data.token_type);
        localStorage.setItem('admin_expires_in', data.expires_in.toString());
        localStorage.setItem('admin_user', JSON.stringify(data.admin));
        localStorage.setItem('admin_tenant_hash', data.admin.tenant_hash);
        this.isLoggedInSubject.next(true);
        this.currentAdminSubject.next(data.admin);
    }
}
