import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { AuthService } from '../../services/auth.service';
import { AdminService } from '../../services/admin.service';
import { Router, RouterModule } from '@angular/router';
import { SvgIconPipe } from '../../pipes/svg-icon.pipe';
import { ModuleService } from '../../services/module.service';
import { LessonService } from '../../services/lesson.service';
import { Module } from '../../services/module.service';
import { RolesService } from '../../services/roles.service';
import { Role } from '../../models/role.model';
import { CollaboratorsService, Collaborator } from '../../services/collaborators.service';
import { ChangeDetectorRef } from '@angular/core';

@Component({
  selector: 'app-sidebar',
  standalone: true,
  imports: [CommonModule, RouterModule, SvgIconPipe],
  templateUrl: './sidebar.component.html',
  styleUrls: ['./sidebar.component.scss']
})
export class SidebarComponent implements OnInit {
  isAdmin: boolean = false;
  modules: Module[] = [];
  totalGlobalProgress: number = 0;
  roles: Role[] = [];
  collaborators: Collaborator[] = [];
  collaboratorsSubscription: any;

  constructor(
    private authService: AuthService,
    private adminService: AdminService,
    private moduleService: ModuleService,
    private lessonService: LessonService,
    private rolesService: RolesService,
    private collaboratorsService: CollaboratorsService,
    private cdr: ChangeDetectorRef,
    private router: Router
  ) { }

  ngOnInit(): void {
    this.isAdmin = this.router.url.startsWith('/admin/')
      ? this.adminService.isAuthenticated()
      : this.authService.isAdmin();
    this.moduleService.modules$.subscribe(modules => {
      this.modules = modules;
      this.updateTotalGlobalProgress();
    });
    if (this.isAdmin) {
      // Assina roles$ para atualização reativa
      this.rolesService.roles$.subscribe(result => {
        this.roles = result.roles;
      });
      // Garante que a primeira busca seja feita
      this.rolesService.getRoles().subscribe();

      // Inscreve-se no observable de colaboradores (sem disparar request duplicada)
      this.collaboratorsSubscription = this.collaboratorsService.collaborators$.subscribe(result => {
        this.collaborators = result.collaborators;
        this.cdr.markForCheck();
      });
      // Dispara busca apenas se não houver dados em cache
      if (!this.collaboratorsService['collaboratorsSubject'].getValue()) {
        this.collaboratorsService.getCollaborators().subscribe();
      }
    }
  }

  ngOnDestroy(): void {
    if (this.collaboratorsSubscription) {
      this.collaboratorsSubscription.unsubscribe();
    }
  }

  get rolesCountExcluindoAdmin(): number {
    return this.roles.filter(r => (r.name || '').toLowerCase() !== 'admin').length;
  }

  get rolesProgressPercent(): number {
    const max = 10;
    const count = this.rolesCountExcluindoAdmin;
    return Math.min(100, Math.round((count / max) * 100));
  }

  // NOVO: Apenas colaboradores que são admin
  get collaboratorsAdminsCount(): number {
    return this.collaborators.filter((c: any) => c.roles[0].name === 'Adm').length;
  }

  get collaboratorsAdminsProgressPercent(): number {
    const max = 10;
    return Math.min(100, Math.round((this.collaboratorsAdminsCount / max) * 100));
  }

  get collaboratorsAdminsProgressText(): string {
    const max = 10;
    return this.collaboratorsAdminsCount > max ? `${max}/${max}+` : `${this.collaboratorsAdminsCount}/${max}`;
  }

  private updateTotalGlobalProgress(): void {
    if (!this.modules.length) {
      this.totalGlobalProgress = 0;
      return;
    }
    let sum = 0;
    let count = 0;
    this.modules.forEach(module => {
      if (module.lessons && module.lessons.length > 0) {
        let moduleSum = 0;
        module.lessons.forEach(lesson => {
          moduleSum += this.lessonService.getLessonProgressWithModule(module.id, lesson.id);
        });
        sum += moduleSum / module.lessons.length;
        count++;
      }
    });
    this.totalGlobalProgress = count > 0 ? Math.round(sum / count) : 0;
  }

  get adminRoutePrefix(): string {
    const parts = this.router.url.split('/');
    if (parts.length >= 3 && parts[1] === 'admin') {
      return `/admin/${parts[2]}`;
    }
    return '';
  }

  logout(): void {
    if (this.router.url.startsWith('/admin/')) {
      const hash = this.adminService.getTenantHash();
      this.adminService.logout();
      this.authService.logout();
      if (hash) {
        this.router.navigate([`/admin/${hash}/login`]);
      } else {
        this.router.navigate(['/admin/login']);
      }
    } else {
      this.authService.logout();
    }
  }
}
