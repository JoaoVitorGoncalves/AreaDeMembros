import { Injectable } from '@angular/core';
import { HttpInterceptor, HttpRequest, HttpHandler, HttpEvent } from '@angular/common/http';
import { Observable } from 'rxjs';
import { AuthService } from './auth.service';
import { AdminService } from './admin.service';

@Injectable()
export class AuthInterceptor implements HttpInterceptor {

    constructor(
        private authService: AuthService,
        private adminService: AdminService
    ) { }

    intercept(req: HttpRequest<any>, next: HttpHandler): Observable<HttpEvent<any>> {
        // Não adicionar token para requisições de login e accept-invite
        if (req.url.includes('/auth/login')
            || req.url.includes('/admin/login')
            || req.url.includes('/admin/register')
            || req.url.includes('/collaborator/login')
            || req.url.includes('/collaborator/accept-invite')) {
            return next.handle(req);
        }

        // Prioridade: admin token > user token
        const adminToken = this.adminService.getFullAuthToken();
        const userToken = this.authService.getFullAuthToken();
        const token = adminToken || userToken;

        if (token) {
            let headers = req.headers.set('Authorization', token);

            // Se for admin, adicionar X-Tenant-Hash
            const tenantHash = this.adminService.getTenantHash();
            if (tenantHash) {
                headers = headers.set('X-Tenant-Hash', tenantHash);
            }

            const authReq = req.clone({ headers });
            return next.handle(authReq);
        }

        return next.handle(req);
    }
}
