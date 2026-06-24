import { inject } from '@angular/core';
import { Router } from '@angular/router';
import { AdminService } from '../services/admin.service';

export const SuperAdminGuard = () => {
    const adminService = inject(AdminService);
    const router = inject(Router);

    if (!adminService.isAuthenticated() || !adminService.isSuperAdmin()) {
        router.navigate(['/admin/login']);
        return false;
    }

    return true;
};
