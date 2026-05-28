import { Injectable } from '@angular/core';
import { HttpInterceptor, HttpRequest, HttpHandler, HttpEvent } from '@angular/common/http';
import { Observable } from 'rxjs';
import { AuthService } from './auth.service';

@Injectable()
export class AuthInterceptor implements HttpInterceptor {

    constructor(private authService: AuthService) { }

    intercept(req: HttpRequest<any>, next: HttpHandler): Observable<HttpEvent<any>> {
        // Não adicionar token para requisições de login
        if (req.url.includes('/auth/login')) {
            return next.handle(req);
        }

        // Adicionar token se o usuário estiver autenticado
        if (this.authService.isAuthenticated()) {
            const authToken = this.authService.getFullAuthToken();

            if (authToken) {
                const authReq = req.clone({
                    headers: req.headers.set('Authorization', authToken)
                });
                return next.handle(authReq);
            }
        }

        return next.handle(req);
    }
} 