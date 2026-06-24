import { Injectable } from '@angular/core';
import { CanActivate, Router } from '@angular/router';
import { AuthService } from '../services/auth.service';
import { AdminService } from '../services/admin.service';

@Injectable({
    providedIn: 'root'
})
export class AuthGuard implements CanActivate {

    constructor(
        private router: Router,
        private authService: AuthService,
        private adminService: AdminService
    ) { }

    canActivate(): boolean {
        if (this.authService.isAuthenticated() || this.adminService.isAuthenticated()) {
            return true;
        }

        const hash = this.adminService.getTenantHash();
        if (hash) {
            this.router.navigate([`/admin/${hash}/login`]);
        } else {
            this.router.navigate(['/login']);
        }
        return false;
    }
} 