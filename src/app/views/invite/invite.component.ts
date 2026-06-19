import { Component, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { Subject, takeUntil } from 'rxjs';
import { AuthService } from '../../services/auth.service';

@Component({
    selector: 'app-invite',
    standalone: true,
    imports: [CommonModule, FormsModule],
    templateUrl: './invite.component.html',
    styleUrls: ['./invite.component.scss']
})
export class InviteComponent implements OnDestroy {

    registerData = {
        name: '',
        email: '',
        phone: '',
        document: '',
        password: '',
    };

    errorMessage = '';
    isLoading = false;
    private destroy$ = new Subject<void>();

    constructor(
        private route: ActivatedRoute,
        private router: Router,
        private authService: AuthService
    ) {
    }

    ngOnDestroy(): void {
        this.destroy$.next();
        this.destroy$.complete();
    }

    onDocumentInput(event: Event): void {
        const input = event.target as HTMLInputElement;
        let value = input.value.replace(/\D/g, '');
        if (value.length > 11) value = value.slice(0, 11);
        if (value.length > 9) {
            value = value.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, '$1.$2.$3-$4');
        } else if (value.length > 6) {
            value = value.replace(/(\d{3})(\d{3})(\d{1,3})/, '$1.$2.$3');
        } else if (value.length > 3) {
            value = value.replace(/(\d{3})(\d{1,3})/, '$1.$2');
        }
        input.value = value;
        this.registerData.document = value;
    }

    onPhoneInput(event: Event): void {
        const input = event.target as HTMLInputElement;
        let value = input.value.replace(/\D/g, '');
        if (value.length > 11) value = value.slice(0, 11);
        if (value.length > 6) {
            value = value.replace(/(\d{2})(\d{5})(\d{0,4})/, '($1) $2-$3');
        } else if (value.length > 2) {
            value = value.replace(/(\d{2})(\d{0,5})/, '($1) $2');
        } else if (value.length > 0) {
            value = value.replace(/(\d{0,2})/, '($1');
        }
        input.value = value;
        this.registerData.phone = value;
    }

    validateEmail(email: string): boolean {
        return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
    }

    onSubmit(): void {
        if (!this.registerData.name || !this.registerData.email || !this.registerData.phone
            || !this.registerData.document || !this.registerData.password) {
            this.errorMessage = 'Preencha todos os campos';
            return;
        }

        if (!this.validateEmail(this.registerData.email)) {
            this.errorMessage = 'Informe um email válido';
            return;
        }

        if (this.registerData.password.length < 8) {
            this.errorMessage = 'A senha deve ter no mínimo 8 caracteres';
            return;
        }

        this.errorMessage = '';
        this.isLoading = true;

        const token = this.route.snapshot.paramMap.get('token');
        if (!token) {
            this.errorMessage = 'Link de convite inválido';
            this.isLoading = false;
            return;
        }

        this.authService.register({
            name: this.registerData.name,
            email: this.registerData.email,
            phone: this.registerData.phone.replace(/\D/g, ''),
            document: this.registerData.document.replace(/\D/g, ''),
            password: this.registerData.password,
            invite_token: token,
        }).pipe(takeUntil(this.destroy$)).subscribe({
            next: () => {
                this.router.navigate(['/dashboard']);
            },
            error: (error: any) => {
                this.errorMessage = error.message || 'Erro ao criar conta';
                this.isLoading = false;
            }
        });
    }

    clearError(): void {
        if (this.errorMessage) {
            this.errorMessage = '';
        }
    }
}