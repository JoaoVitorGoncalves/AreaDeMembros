import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, ActivatedRoute } from '@angular/router';
import { Subject, takeUntil } from 'rxjs';
import { AuthService } from '../../services/auth.service';
import { AdminService } from '../../services/admin.service';
import { CollaboratorAuthService } from '../../services/collaborator-auth.service';
import { HttpClient, HttpHeaders, HttpEvent, HttpRequest } from '@angular/common/http';

@Component({
    selector: 'app-login',
    standalone: true,
    imports: [CommonModule, FormsModule],
    templateUrl: './login.component.html',
    styleUrls: ['./login.component.scss']
})
export class LoginComponent implements OnInit, OnDestroy {

    loginData = {
        email: '',
        password: ''
    };

    errorMessage = '';
    isLoading = false;
    private tenantHash: string | null = null;
    private isAdminRoute = false;
    private destroy$ = new Subject<void>();

    constructor(
        private router: Router,
        private route: ActivatedRoute,
        private authService: AuthService,
        private adminService: AdminService,
        private collaboratorAuth: CollaboratorAuthService,
        private http: HttpClient
    ) { }

    ngOnInit(): void {
        this.tenantHash = this.route.snapshot.paramMap.get('tenant_hash');
        this.isAdminRoute = this.router.url.startsWith('/admin');
        const loading$ = this.isAdminRoute
            ? this.adminService.loading$
            : this.authService.loading$;
        loading$.pipe(takeUntil(this.destroy$)).subscribe(loading => this.isLoading = loading);
    }

    ngOnDestroy(): void {
        this.destroy$.next();
        this.destroy$.complete();
    }

    onSubmit() {
        if (!this.loginData.email || !this.loginData.password) {
            this.errorMessage = 'Preencha todos os campos';
            return;
        }

        if (this.loginData.password.length < 8) {
            this.errorMessage = 'A senha deve ter no mínimo 8 caracteres';
            return;
        }

        this.errorMessage = '';

        const doLogin = () => {
            if (this.isAdminRoute) {
                this.adminService.login(this.loginData.email, this.loginData.password)
                    .pipe(takeUntil(this.destroy$))
                    .subscribe({
                        next: () => this.router.navigate([`/admin/${this.tenantHash}/dashboard`]),
                        error: (err: any) => {
                            // If admin login fails, try collaborator login
                            this.collaboratorAuth.login(this.loginData.email, this.loginData.password)
                                .pipe(takeUntil(this.destroy$))
                                .subscribe({
                                    next: (response) => {
                                        const hash = response.data.collaborator.tenant_hash;
                                        if (hash) {
                                            this.router.navigate([`/admin/${hash}/dashboard`]);
                                        } else if (this.tenantHash) {
                                            this.router.navigate([`/admin/${this.tenantHash}/dashboard`]);
                                        } else {
                                            this.router.navigate(['/dashboard']);
                                        }
                                    },
                                    error: () => {
                                        this.errorMessage = err.message || 'Email ou senha incorretos';
                                    }
                                });
                        }
                    });
            } else {
                this.authService.login(this.loginData.email, this.loginData.password)
                    .pipe(takeUntil(this.destroy$))
                    .subscribe({
                        next: () => {
                            if (this.tenantHash) {
                                this.router.navigate([`/${this.tenantHash}/dashboard`]);
                            } else {
                                this.router.navigate(['/dashboard']);
                            }
                        },
                        error: (err: any) => this.errorMessage = err.message || 'Erro ao fazer login'
                    });
            }
        };
        doLogin();
    }

    forgotPassword() {
        // Funcionalidade futura
        console.log('Esqueceu a senha');
    }

    // Limpar erro quando o usuário começar a digitar
    clearError() {
        if (this.errorMessage) {
            this.errorMessage = '';
        }
    }
} 