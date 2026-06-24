import { Injectable } from '@angular/core';
import { CanActivate, Router } from '@angular/router';
import { AuthService } from '../services/auth.service';
import { AdminService } from '../services/admin.service';

@Injectable({
    providedIn: 'root'
})
export class AdminGuard implements CanActivate {

    constructor(
        private router: Router,
        private authService: AuthService,
        private adminService: AdminService
    ) { }

    canActivate(): boolean {
        const isAdmin = (this.authService.isAuthenticated() && this.authService.isAdmin())
            || this.adminService.isAuthenticated();

        if (isAdmin) {
            return true;
        }

        this.router.navigate(['/dashboard']);
        return false;
    }
} 