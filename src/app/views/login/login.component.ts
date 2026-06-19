import { Component, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { Subject, takeUntil } from 'rxjs';
import { AuthService } from '../../services/auth.service';
import { HttpClient, HttpHeaders, HttpEvent, HttpRequest } from '@angular/common/http';

@Component({
    selector: 'app-login',
    standalone: true,
    imports: [CommonModule, FormsModule],
    templateUrl: './login.component.html',
    styleUrls: ['./login.component.scss']
})
export class LoginComponent implements OnDestroy {

    loginData = {
        email: '',
        password: ''
    };

    errorMessage = '';
    isLoading = false;
    private destroy$ = new Subject<void>();

    constructor(
        private router: Router,
        private authService: AuthService,
        private http: HttpClient
    ) {
        // Subscribe to loading state
        this.authService.loading$
            .pipe(takeUntil(this.destroy$))
            .subscribe(loading => this.isLoading = loading);
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

        this.authService.login(this.loginData.email, this.loginData.password)
            .pipe(takeUntil(this.destroy$))
            .subscribe({
                next: (response) => {
                    this.router.navigate(['/dashboard']);
                },
                error: (error: any) => {
                    this.errorMessage = error.message || 'Erro ao fazer login';
                }
            });
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