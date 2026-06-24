import { inject } from '@angular/core';
import { Router, ActivatedRouteSnapshot } from '@angular/router';
import { AdminService } from '../services/admin.service';
import { map, take } from 'rxjs/operators';

export const AdminTenantGuard = (route: ActivatedRouteSnapshot) => {
    const adminService = inject(AdminService);
    const router = inject(Router);

    if (!adminService.isAuthenticated()) {
        const tenantHash = route.paramMap.get('tenant_hash');
        if (tenantHash) {
            router.navigate([`/admin/${tenantHash}/login`]);
        } else {
            router.navigate(['/admin/login']);
        }
        return false;
    }

    const tenantHash = route.paramMap.get('tenant_hash');
    const storedHash = adminService.getTenantHash();

    if (tenantHash !== storedHash) {
        router.navigate(['/admin/login']);
        return false;
    }

    return true;
};
