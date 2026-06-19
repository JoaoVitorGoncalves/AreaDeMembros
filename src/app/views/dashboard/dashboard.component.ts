import { Component, OnInit, ChangeDetectionStrategy, AfterViewInit, OnDestroy, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { AuthService, User } from '../../services/auth.service';
import { HeaderComponent } from '../../layouts/header/header.component';
import { SidebarComponent } from '../../layouts/sidebar/sidebar.component';
import { Module, ModuleService, Lesson } from '../../services/module.service';
import { Observable, BehaviorSubject, forkJoin } from 'rxjs';
import { RolesService, RolesResult } from '../../services/roles.service';
import { AdminCargoDetailComponent } from '../../components/admin-cargo-detail/admin-cargo-detail.component';
import { AddRoleComponent } from '../../components/add-role/add-role.component';
import { ConfirmModalComponent } from '../../components/confirm-modal/confirm-modal.component';
import { map } from 'rxjs/operators';
import { Router } from '@angular/router';
import { LessonService } from '../../services/lesson.service';

interface CourseModules {
  roleName: string;
  modules: Module[];
  loading: boolean;
}

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [CommonModule, HeaderComponent, SidebarComponent, AdminCargoDetailComponent, AddRoleComponent, ConfirmModalComponent],
  templateUrl: './dashboard.component.html',
  styleUrls: ['./dashboard.component.scss'],
  changeDetection: ChangeDetectionStrategy.Default
})
export class DashboardComponent implements OnInit, AfterViewInit, OnDestroy {

  currentUser: User | null = null;
  userRole: string = '';
  modules$: Observable<Module[]>;
  loading$: Observable<boolean>;
  isAdmin: boolean = false;
  roles$: Observable<RolesResult>;
  private rolesSubject = new BehaviorSubject<RolesResult | null>(null);
  selectedCargo: any = null;
  viewingCourse: any = null;
  viewCourseModulesList: Module[] = [];
  viewCourseLoading = false;
  showAddRoleSidebarFlag: boolean = false;
  lessonsInProgress: { module: Module; lesson: Lesson; progress: number; lastUpdated: string }[] = [];
  coursesWithModules: CourseModules[] = [];
  dropdownCargoIndex: number | null = null;
  confirmModalOpen = false;
  cargoToDelete: any = null;
  isDeletingCargo = false;

  get deleteMessage(): string {
    return `Tem certeza que deseja excluir o curso "${this.cargoToDelete?.name || ''}"? Esta ação não pode ser desfeita.`;
  }

  stats = [
    { title: 'Total de Usuários', value: '1.2M', change: '+12%', positive: true },
    { title: 'Receita Mensal', value: 'R$ 45.8K', change: '+8.5%', positive: true },
    { title: 'Taxa de Conversão', value: '3.2%', change: '-2.1%', positive: false },
    { title: 'Pedidos Hoje', value: '157', change: '+23%', positive: true }
  ];

  chartData = {
    labels: ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun'],
    values: [30, 45, 35, 55, 40, 65]
  };

  get rolesCountExcluindoAdmin(): number {
    const current = this.rolesSubject.value;
    if (!current) return 0;
    return current.roles.filter(r => (r.name || '').toLowerCase() !== 'admin').length;
  }

  constructor(
    private authService: AuthService,
    private moduleService: ModuleService,
    private rolesService: RolesService,
    private cdr: ChangeDetectorRef,
    private router: Router,
    private lessonService: LessonService
  ) {
    this.modules$ = this.moduleService.modules$;
    this.loading$ = this.moduleService.loading$;

    // Usar o rolesSubject local como observable principal para o template, filtrando valores null
    this.roles$ = this.rolesSubject.asObservable().pipe(
      map(roles => roles as RolesResult)
    );
  }

  ngOnInit(): void {
    this.currentUser = this.authService.getUser();
    if (this.currentUser?.roles?.length) {
      this.userRole = this.currentUser.roles[0];
    }
    this.isAdmin = this.authService.isAdmin();

    if (this.isAdmin) {
      this.rolesService.getRoles().subscribe(roles => {
        this.rolesSubject.next(roles);
        this.cdr.detectChanges();
      });
    } else {
      const userRoles = (this.currentUser?.roles || []).filter(r => r.toLowerCase() !== 'admin');

      if (userRoles.length === 0) {
        return;
      }

      this.coursesWithModules = userRoles.map(roleName => ({
        roleName,
        modules: [],
        loading: true,
      }));

      const requests = userRoles.map(roleName =>
        this.moduleService.loadModulesForRole(roleName)
      );

      forkJoin(requests).subscribe(results => {
        const allModules: Module[] = [];

        results.forEach((modules, index) => {
          this.coursesWithModules[index].modules = modules;
          this.coursesWithModules[index].loading = false;
          allModules.push(...modules);

          modules.forEach(module => {
            if (!module.lessons || module.lessons.length === 0) {
              console.warn(`⚠️ Módulo ${module.name} (ID: ${module.id}) não possui aulas`);
            }
          });
        });

        this.moduleService.modulesSubject.next(allModules);
        this.lessonService.setModules(allModules);
        this.updateLessonsInProgress(true);
        this.cdr.detectChanges();
      });

      this.modules$.subscribe(() => this.updateLessonsInProgress(false));
    }

    // Restaurar estado do localStorage
    this.restoreState();

    // CRÍTICO: Sincronizar dados locais com o serviço para garantir consistência
    this.syncLocalDataWithService();

    // Adicionar listener para salvar estado antes de sair da página
    window.addEventListener('beforeunload', this.handleBeforeUnload.bind(this));

    // Adicionar listener para fechar dropdown quando clicar fora
    document.addEventListener('click', this.handleDocumentClick.bind(this));

    // Adicionar listener para fechar dropdown quando pressionar Escape
    document.addEventListener('keydown', this.handleKeydown.bind(this));
  }

  ngAfterViewInit(): void {
    // Aguardar o próximo ciclo para garantir que o DOM está renderizado
    setTimeout(() => {
      this.scrollToTop();
    }, 0);
  }

  // Novo método para lidar com a reativação do componente
  onViewActivated(): void {
    // Quando a view é reativada, garantir que os dados estejam sincronizados
    this.syncLocalDataWithService();
  }

  ngOnDestroy(): void {
    // Remover listener ao destruir o componente
    window.removeEventListener('beforeunload', this.handleBeforeUnload.bind(this));
    document.removeEventListener('click', this.handleDocumentClick.bind(this));
    document.removeEventListener('keydown', this.handleKeydown.bind(this));
  }

  logout(): void {
    this.authService.logout();
  }

  formatDate(dateString: string): string {
    const date = new Date(dateString);
    return date.toLocaleDateString('pt-BR');
  }

  openCargoDetail(cargo: any) {
    // PRIORIDADE 1: Verificar se temos dados atualizados no rolesSubject local
    const currentRoles = this.rolesSubject.value;
    if (currentRoles) {
      const updatedCargo = currentRoles.roles.find(role => role.id === cargo.id);
      if (updatedCargo) {
        this.selectedCargo = updatedCargo;
        this.saveState();
        this.scrollToTop();
        return;
      }
    }

    // PRIORIDADE 2: Tentar carregar do localStorage (apenas se não tiver dados locais)
    const localStorageCargo = this.loadCargoFromLocalStorage(cargo.id);
    if (localStorageCargo) {
      this.selectedCargo = localStorageCargo;
      this.saveState();
      this.scrollToTop();
      return;
    }

    // PRIORIDADE 3: Fallback para o serviço apenas se não tiver dados locais (primeira vez)
    this.rolesService.getRoles().subscribe(rolesResult => {
      const updatedCargo = rolesResult.roles.find(role => role.id === cargo.id);
      if (updatedCargo) {
        this.selectedCargo = updatedCargo;
      } else {
        this.selectedCargo = cargo;
      }
      this.saveState();
      this.scrollToTop();
    });
  }

  closeCargoDetail() {
    // Preservar o cargo atualizado no estado local antes de limpar a referência
    if (this.selectedCargo) {
      const currentRoles = this.rolesSubject.value;
      if (currentRoles) {
        // Atualiza a lista local de roles com o cargo atualizado
        const updatedRoles = currentRoles.roles.map(role =>
          role.id === this.selectedCargo.id ? this.selectedCargo : role
        );
        const newRolesResult = { ...currentRoles, roles: updatedRoles };
        this.rolesSubject.next(newRolesResult);

        // ATUALIZA O CACHE DIRETAMENTE (sem request desnecessário)
        this.rolesService.updateCacheWithLocalData(this.selectedCargo);
      }
    }

    this.selectedCargo = null;
    // Salva o estado sem o cargo selecionado, mas mantém as atualizações na lista local
    this.saveStateWithoutCargo();
    this.scrollToTop();
  }

  onCargoUpdated(updatedCargo: any) {
    // Atualiza o cargo selecionado na view
    this.selectedCargo = { ...updatedCargo };

    // Atualiza a lista local de roles
    const currentRoles = this.rolesSubject.value;
    if (currentRoles) {
      const updatedRoles = currentRoles.roles.map(role =>
        role.id === updatedCargo.id ? updatedCargo : role
      );
      const newRolesResult = { ...currentRoles, roles: updatedRoles };
      this.rolesSubject.next(newRolesResult);
    }

    // ATUALIZA O CACHE DIRETAMENTE (sem request desnecessário)
    this.rolesService.updateCacheWithLocalData(updatedCargo);

    // Atualiza o estado salvo no localStorage
    this.saveState();
  }

  viewCourse(cargo: any): void {
    this.viewingCourse = cargo;
    this.viewCourseModulesList = [];
    this.viewCourseLoading = true;
    this.moduleService.loadModulesByRole(cargo.name, cargo.id).subscribe({
      next: (modules) => {
        this.viewCourseModulesList = modules || [];
        this.viewCourseLoading = false;
      },
      error: () => {
        this.viewCourseModulesList = [];
        this.viewCourseLoading = false;
      },
    });
  }

  closeViewCourse(): void {
    this.viewingCourse = null;
    this.viewCourseModulesList = [];
  }

  viewCourseModule(module: Module): void {
    if (module.lessons && module.lessons.length > 0) {
      this.router.navigate(['/lesson', module.id, module.lessons[0].id]);
    }
  }

  private scrollToTop(): void {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  private handleBeforeUnload(): void {
    this.saveState();
  }

  private handleDocumentClick(event: Event): void {
    // Fechar dropdown se clicar fora dele
    if (this.dropdownCargoIndex !== null) {
      const target = event.target as HTMLElement;

      // Verificar se clicou no trigger do dropdown
      const dropdownTrigger = target.closest('.admin-dashboard-card-action-more');
      if (dropdownTrigger) {
        // Se clicou no trigger, não fechar (o método showCargoActionsDropdown vai lidar com isso)
        return;
      }

      // Verificar se clicou dentro do dropdown
      const dropdownContainer = target.closest('.dropdown-menu');
      if (dropdownContainer) {
        // Se clicou dentro do dropdown, verificar se foi em um item específico
        const dropdownItem = target.closest('.dropdown-menu-item');
        if (!dropdownItem) {
          // Se clicou dentro do dropdown mas não em um item, fechar o dropdown
          this.hideCargoActionsDropdown();
        }
        // Se clicou em um item específico, não fechar (o item vai lidar com sua própria ação)
        return;
      }

      // Se chegou até aqui, clicou fora do dropdown e fora do trigger
      this.hideCargoActionsDropdown();
    }
  }

  private handleKeydown(event: KeyboardEvent): void {
    // Fechar dropdown se pressionar Escape
    if (event.key === 'Escape' && this.dropdownCargoIndex !== null) {
      this.hideCargoActionsDropdown();
    }
  }

  private saveState(): void {
    const state = {
      selectedCargo: this.selectedCargo,
      timestamp: Date.now()
    };
    localStorage.setItem('dashboardState', JSON.stringify(state));
  }

  private saveStateWithoutCargo(): void {
    const state = {
      timestamp: Date.now()
    };
    localStorage.setItem('dashboardState', JSON.stringify(state));
  }

  private restoreState(): void {
    try {
      const savedState = localStorage.getItem('dashboardState');
      if (savedState) {
        const state = JSON.parse(savedState);
        const now = Date.now();
        const oneHour = 60 * 60 * 1000; // 1 hora em millisegundos

        // Restaurar apenas se o estado foi salvo há menos de 1 hora
        if (state.timestamp && (now - state.timestamp) < oneHour) {
          // Só restaura selectedCargo se ele existir no estado
          if (state.selectedCargo) {
            this.selectedCargo = state.selectedCargo;

            // Sincroniza o estado local com o cargo restaurado
            this.syncLocalStateWithRestoredCargo(state.selectedCargo);
          }
        } else {
          // Limpar estado expirado
          localStorage.removeItem('dashboardState');
        }
      }
    } catch (error) {
      console.error('Erro ao restaurar estado do dashboard:', error);
      localStorage.removeItem('dashboardState');
    }
  }

  private syncLocalStateWithRestoredCargo(restoredCargo: any): void {
    // Sincroniza o estado local com o cargo restaurado
    const currentRoles = this.rolesSubject.value;
    if (currentRoles) {
      const updatedRoles = currentRoles.roles.map(role =>
        role.id === restoredCargo.id ? restoredCargo : role
      );
      const newRolesResult = { ...currentRoles, roles: updatedRoles };
      this.rolesSubject.next(newRolesResult);

      // ATUALIZA O CACHE DIRETAMENTE (sem request desnecessário)
      this.rolesService.updateCacheWithLocalData(restoredCargo);
    }
  }

  // Método para carregar estado do cargo do localStorage
  private loadCargoFromLocalStorage(cargoId: number): any | null {
    try {
      const cargoState = localStorage.getItem(`cargo_${cargoId}`);
      if (cargoState) {
        const state = JSON.parse(cargoState);
        const now = Date.now();
        const oneHour = 60 * 60 * 1000; // 1 hora em millisegundos

        // Retorna apenas se o estado foi salvo há menos de 1 hora
        if (state.timestamp && (now - state.timestamp) < oneHour) {
          return state.cargo;
        } else {
          // Limpar estado expirado
          localStorage.removeItem(`cargo_${cargoId}`);
        }
      }
    } catch (error) {
      console.error('Erro ao carregar estado do cargo:', error);
      localStorage.removeItem(`cargo_${cargoId}`);
    }
    return null;
  }

  // Método de debug para verificar o estado atual
  debugRolesState(): void {
  }

  // Novo método para sincronizar dados locais com o serviço
  private syncLocalDataWithService(): void {
    // Se temos dados locais, verificar se precisam ser sincronizados com o serviço
    const currentRoles = this.rolesSubject.value;
    if (currentRoles) {
      // Recarregar dados do serviço para garantir sincronização
      this.rolesService.getRoles().subscribe(serviceRoles => {
        // Mesclar dados locais com dados do serviço, priorizando dados locais mais recentes
        const mergedRoles = serviceRoles.roles.map(serviceRole => {
          const localRole = currentRoles.roles.find(local => local.id === serviceRole.id);
          // Se temos dados locais mais recentes (com timestamp), usar eles
          if (localRole && this.isLocalDataMoreRecent(localRole, serviceRole)) {
            return localRole;
          }
          return serviceRole;
        });

        const mergedResult = { ...serviceRoles, roles: mergedRoles };
        this.rolesSubject.next(mergedResult);
        this.cdr.detectChanges(); // Força detecção de mudanças
      });
    }
  }

  // Método auxiliar para verificar se dados locais são mais recentes
  private isLocalDataMoreRecent(localRole: any, serviceRole: any): boolean {
    // Implementação simples: se o cargo local tem dados diferentes, considerar mais recente
    return localRole.name !== serviceRole.name;
  }

  // Métodos para controlar o sidebar de adicionar cargo
  showAddRoleSidebar(): void {
    this.showAddRoleSidebarFlag = true;
  }

  hideAddRoleSidebar(): void {
    this.showAddRoleSidebarFlag = false;
  }

  onRoleCreated(newRole: any): void {
    // O serviço já atualizou o cache automaticamente, então apenas sincronizamos
    this.syncLocalDataWithService();

    // Fecha o sidebar
    this.hideAddRoleSidebar();
  }

  showCargoActionsDropdown(index: number, event: MouseEvent): void {
    event.stopPropagation();
    this.dropdownCargoIndex = this.dropdownCargoIndex === index ? null : index;
  }

  hideCargoActionsDropdown(): void {
    this.dropdownCargoIndex = null;
  }

  onDeleteCargo(cargo: any): void {
    this.cargoToDelete = cargo;
    this.confirmModalOpen = true;
    this.hideCargoActionsDropdown();
  }

  onConfirmDelete(): void {
    if (!this.cargoToDelete) return;
    this.isDeletingCargo = true;
    this.rolesService.deleteRole(this.cargoToDelete.id).subscribe({
      next: () => {
        const currentRoles = this.rolesSubject.value;
        if (currentRoles) {
          const updatedRoles = currentRoles.roles.filter(role => role.id !== this.cargoToDelete.id);
          const newRolesResult = { ...currentRoles, roles: updatedRoles };
          this.rolesSubject.next(newRolesResult);
        }
        this.isDeletingCargo = false;
        this.confirmModalOpen = false;
        this.cargoToDelete = null;
      },
      error: (error: any) => {
        console.error('Erro ao excluir cargo:', error);
        this.isDeletingCargo = false;
        this.confirmModalOpen = false;
        this.cargoToDelete = null;
      }
    });
  }

  onCancelDelete(): void {
    this.confirmModalOpen = false;
    this.cargoToDelete = null;
  }

  openModule(module: Module) {
    // Verificar se o módulo tem aulas
    if (module.lessons && module.lessons.length > 0) {
      // Encontrar a próxima aula não concluída ou a primeira aula
      let targetLesson = this.findNextIncompleteLesson(module);

      if (targetLesson) {
        this.router.navigate(['/lesson', module.id, targetLesson.id]);
      } else {
        // Se todas as aulas estão concluídas, ir para a primeira
        this.router.navigate(['/lesson', module.id, module.lessons[0].id]);
      }
    } else {
      // Se não há aulas no módulo, tentar recarregar os módulos
      console.warn('Módulo não possui aulas disponíveis, tentando recarregar...');
      this.moduleService.loadModules().subscribe(modules => {
        const updatedModule = modules.find(m => m.id === module.id);
        if (updatedModule && updatedModule.lessons && updatedModule.lessons.length > 0) {
          this.lessonService.setModules(modules);
          this.openModule(updatedModule);
        } else {
          console.error('Módulo ainda não possui aulas após recarregamento');
        }
      });
    }
  }

  // Método para encontrar a próxima aula não concluída
  private findNextIncompleteLesson(module: Module): any {
    if (!module.lessons || module.lessons.length === 0) {
      return null;
    }

    // Primeiro, verificar se há alguma aula com progresso salvo
    for (let lesson of module.lessons) {
      const progress = this.lessonService.getVideoProgress(module.id, lesson.id);
      if (progress && progress.progress > 0 && progress.progress < 90) {
        // Retorna a aula onde o usuário parou (progresso entre 0% e 90%)
        return lesson;
      }
    }

    // Se não há progresso salvo, procurar pela primeira aula não concluída
    for (let lesson of module.lessons) {
      const isCompleted = this.lessonService.isLessonCompleted(module.id, lesson.id);
      if (!isCompleted) {
        return lesson;
      }
    }

    // Se todas as aulas estão concluídas, retorna null (será tratado no método principal)
    return null;
  }

  continuarAula(module: Module, lesson: Lesson) {
    this.router.navigate(['/lesson', module.id, lesson.id]);
  }

  private updateLessonsInProgress(shouldFetchBackend: boolean = false): void {
    if (this.isAdmin) return; // Nunca faz request para admin
    this.lessonsInProgress = [];
    const modules = this.moduleService.modulesSubject?.value || [];
    let hasAnyProgress = false;
    let allLessons: { module: Module, lesson: Lesson }[] = [];
    modules.forEach(module => {
      module.lessons?.forEach(lesson => {
        allLessons.push({ module, lesson });
        const progressObj = this.lessonService.getVideoProgress(module.id, lesson.id);
        if (progressObj && progressObj.progress > 0 && progressObj.progress < 100) {
          hasAnyProgress = true;
          this.lessonsInProgress.push({
            module,
            lesson,
            progress: progressObj.progress,
            lastUpdated: progressObj.lastUpdated
          });
        }
      });
    });
    // Deduplicar por lesson.id — mesma aula em módulos diferentes
    const seen = new Map<number, typeof this.lessonsInProgress[0]>();
    this.lessonsInProgress.forEach(item => {
      const existing = seen.get(item.lesson.id);
      if (!existing || new Date(item.lastUpdated).getTime() > new Date(existing.lastUpdated).getTime()) {
        seen.set(item.lesson.id, item);
      }
    });
    this.lessonsInProgress = Array.from(seen.values());
    if (!hasAnyProgress && allLessons.length > 0 && shouldFetchBackend) {
      // Buscar progresso do backend se não houver nenhum salvo localmente
      const user = this.lessonService.authService.getUser();
      if (!user) return;
      const lessonIds = allLessons.map(item => item.lesson.id);
      this.lessonService.fetchLessonsProgressFromBackend(user.id, lessonIds).subscribe((progressResult: any) => {
        const lessonsProgress = progressResult?.data?.lessons_progress;
        if (Array.isArray(lessonsProgress)) {
          lessonsProgress.forEach((progress: any) => {
            const moduleId = allLessons.find(item => item.lesson.id === progress.lesson_id)?.module.id;
            if (moduleId) {
              const key = `lesson_progress_${moduleId}_${progress.lesson_id}`;
              localStorage.setItem(key, JSON.stringify({
                currentTime: progress.time || 0,
                totalTime: 0,
                progress: progress.progress || 0,
                lastUpdated: progress.updated_at || new Date().toISOString()
              }));
            }
          });
          // Após popular localStorage, refazer a busca (sem nova request)
          this.updateLessonsInProgress(false);
          this.cdr.detectChanges();
        }
      });
    }
    this.lessonsInProgress.sort((a, b) => new Date(b.lastUpdated).getTime() - new Date(a.lastUpdated).getTime());
    this.cdr.detectChanges();
  }
}
