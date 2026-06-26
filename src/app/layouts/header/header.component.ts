import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink, Router } from '@angular/router';
import { AuthService } from '../../services/auth.service';
import { AdminService } from '../../services/admin.service';
import { CollaboratorAuthService } from '../../services/collaborator-auth.service';
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
  displayName: string = '';
  isCollaborator: boolean = false;
  logoRoute: string = '/';

  private adminService = inject(AdminService);
  private collaboratorAuth = inject(CollaboratorAuthService);
  private router = inject(Router);

  constructor(private authService: AuthService) { }

  ngOnInit(): void {
    this.isCollaborator = this.adminService.isCollaborator();
    this.user = this.authService.getUser();

    if (this.isCollaborator) {
      const collabUser = this.collaboratorAuth.getUser();
      if (collabUser) {
        this.displayName = collabUser.name;
        this.userInitials = this.getInitials(collabUser.name);
        this.userRole = collabUser.type === 'recruiter' ? 'Recrutador' : 'Editor';
      }
    } else if (this.user) {
      this.displayName = this.user.name;
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
