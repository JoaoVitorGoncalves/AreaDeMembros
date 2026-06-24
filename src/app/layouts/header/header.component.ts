import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink, Router } from '@angular/router';
import { AuthService } from '../../services/auth.service';
import { AdminService } from '../../services/admin.service';
import { User } from '../../services/auth.service';

@Component({
  selector: 'app-header',
  standalone: true,
  imports: [CommonModule, RouterLink],
  templateUrl: './header.component.html',
  styleUrls: ['./header.component.scss']
})
export class HeaderComponent implements OnInit {
  user: User | null = null;
  userInitials: string = '';
  userRole: string = '';
  logoRoute: string = '/';

  private adminService = inject(AdminService);
  private router = inject(Router);

  constructor(private authService: AuthService) { }

  ngOnInit(): void {
    this.user = this.authService.getUser();
    if (this.user) {
      this.userInitials = this.getInitials(this.user.name);
      if (this.user.roles && this.user.roles.length > 0) {
        this.userRole = this.user.roles[0];
      }
    }
    if (this.router.url.startsWith('/admin/')) {
      const hash = this.adminService.getTenantHash();
      if (hash) {
        this.logoRoute = `/admin/${hash}/dashboard`;
      }
    }
  }

  private getInitials(name: string): string {
    if (!name) return '';
    const nameParts = name.trim().split(' ');
    if (nameParts.length > 1) {
      return (nameParts[0][0] + nameParts[nameParts.length - 1][0]).toUpperCase();
    }
    return name.substring(0, 2).toUpperCase();
  }
}
