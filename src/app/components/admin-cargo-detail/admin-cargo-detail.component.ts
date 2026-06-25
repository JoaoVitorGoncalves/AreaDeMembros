import {
    Component,
    Input,
    Output,
    EventEmitter,
    OnInit,
    AfterViewInit,
    OnDestroy,
    OnChanges,
    SimpleChanges,
    ChangeDetectorRef,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { DragDropModule, CdkDragDrop, moveItemInArray } from '@angular/cdk/drag-drop';
import { Router } from '@angular/router';
import { Role } from '../../models/role.model';
import { UsersService, User } from '../../services/users.service';
import { Observable, Subject, BehaviorSubject, Subscription } from 'rxjs';
import { takeUntil } from 'rxjs/operators';
import { map } from 'rxjs/operators';
import { AddUserComponent } from '../add-user/add-user.component';
import { AddToolComponent } from '../add-tool/add-tool.component';
import { AddModuleComponent } from '../add-module/add-module.component';
import { ToolsService } from '../../services/tools.service';
import { Tool } from '../../models/tool.model';
import { SupportService } from '../../services/support.service';
import { Support } from '../../models/support.model';
import { RolesService } from '../../services/roles.service';
import { ModuleService, Module, Lesson } from '../../services/module.service';
import { AddLessonComponent } from '../add-lesson/add-lesson.component';
import { LessonService } from '../../services/lesson.service';
import { SvgIconPipe } from '../../pipes/svg-icon.pipe';
import { AddExistingUserComponent } from '../add-existing-user/add-existing-user.component';
import { AddExistingToolComponent } from '../add-existing-tool/add-existing-tool.component';
import { AddExistingModuleComponent } from '../add-existing-module/add-existing-module.component';
import { ConfirmModalComponent } from '../confirm-modal/confirm-modal.component';
import { AuthService } from '../../services/auth.service';
import { AdminService } from '../../services/admin.service';

@Component({
    selector: 'app-admin-cargo-detail',
    standalone: true,
    imports: [
        CommonModule,
        FormsModule,
        DragDropModule,
        AddUserComponent,
        AddToolComponent,
        AddModuleComponent,
        AddLessonComponent,
        SvgIconPipe,
        AddExistingUserComponent,
        AddExistingToolComponent,
        AddExistingModuleComponent,
        ConfirmModalComponent,
    ],
    templateUrl: './admin-cargo-detail.component.html',
    styleUrls: ['./admin-cargo-detail.component.scss'],
})
export class AdminCargoDetailComponent
    implements OnInit, AfterViewInit, OnDestroy, OnChanges {
    @Input() cargo: Role | null = null;
    @Output() close = new EventEmitter<void>();
    @Output() cargoUpdated = new EventEmitter<Role>();

    activeTab: string = 'conteudo';
    showAddUserSidebarFlag: boolean = false;
    showAddToolSidebarFlag: boolean = false;
    showAddModuleModalFlag: boolean = false;
    showAddLessonModalFlag: boolean = false;
    showEditToolModalFlag: boolean = false;
    showEditModuleModalFlag: boolean = false;
    showEditLessonModalFlag: boolean = false;
    editToolData: any = null;
    editModuleData: any = null;
    editLessonData: any = null;
    editLessonModuleId: number | null = null;
    editLessonModuleName: string | null = null;
    addLessonModuleId: number | null = null;
    addLessonModuleName: string | null = null;
    showUserDropdown: boolean = false;
    showAddExistingUserModal: boolean = false;
    // Adicionar controle para dropdown de ferramenta
    showToolDropdown: boolean = false;
    showAddExistingToolModal: boolean = false;

    // Adicionar controle para dropdown de módulo
    showModuleDropdown: boolean = false;
    showAddExistingModuleModal: boolean = false;

    // Controle de expansão dos módulos
    expandedModules = new Set<number>();

    // Controle de edição dos campos de suporte
    isEditingWhatsapp: boolean = false;
    isEditingEmail: boolean = false;

    // Controle de edição dos campos de configuração
    isEditingCourseName: boolean = false;

    // Observables do serviço de usuários
    users$: Observable<User[]>;
    loading$: Observable<boolean>;
    error$: Observable<string | null>;
    pagination$: Observable<any>;
    role$: Observable<any>;
    progressStatistics$: Observable<any>;
    users: User[] = [];
    filteredUsers: User[] = [];
    userSearchTerm: string = '';
    usersPerPage: number = 5; // Valor padrão, pode ser ajustado conforme a paginação

    // Adicionado: cache local de usuários adicionados manualmente
    private locallyAddedUsers: User[] = [];

    private getLocallyAddedUsersKey(): string {
        return this.cargo?.id ? `locallyAddedUsers_${this.cargo.id}` : '';
    }

    private saveLocallyAddedUsersToStorage(): void {
        const key = this.getLocallyAddedUsersKey();
        if (key) {
            localStorage.setItem(key, JSON.stringify(this.locallyAddedUsers));
        }
    }

    private loadLocallyAddedUsersFromStorage(): void {
        const key = this.getLocallyAddedUsersKey();
        if (key) {
            try {
                const data = localStorage.getItem(key);
                this.locallyAddedUsers = data ? JSON.parse(data) : [];
            } catch {
                this.locallyAddedUsers = [];
            }
        } else {
            this.locallyAddedUsers = [];
        }
    }

    private removeLocallyAddedUser(userId: number): void {
        const before = this.locallyAddedUsers.length;
        this.locallyAddedUsers = this.locallyAddedUsers.filter(
            (u) => u.id !== userId,
        );
        if (this.locallyAddedUsers.length !== before) {
            this.saveLocallyAddedUsersToStorage();
        }
    }

    // Observables do serviço de ferramentas
    tools$: Observable<Tool[]>;
    toolsLoading$: Observable<boolean>;
    toolsError$: Observable<string | null>;
    tools: Tool[] = []; // Adicionar array local para ferramentas
    private toolsSubject = new BehaviorSubject<Tool[]>([]);
    private toolsErrorSubject = new BehaviorSubject<string | null>(null);
    toolSearchTerm: string = '';
    filteredTools: Tool[] = [];

    // Adicionado: cache local de ferramentas adicionadas manualmente
    private locallyAddedTools: Tool[] = [];

    private getLocallyAddedToolsKey(): string {
        return this.cargo?.id ? `locallyAddedTools_${this.cargo.id}` : '';
    }

    private saveLocallyAddedToolsToStorage(): void {
        const key = this.getLocallyAddedToolsKey();
        if (key) {
            localStorage.setItem(key, JSON.stringify(this.locallyAddedTools));
        }
    }

    private loadLocallyAddedToolsFromStorage(): void {
        const key = this.getLocallyAddedToolsKey();
        if (key) {
            try {
                const data = localStorage.getItem(key);
                this.locallyAddedTools = data ? JSON.parse(data) : [];
            } catch {
                this.locallyAddedTools = [];
            }
        } else {
            this.locallyAddedTools = [];
        }
    }

    private removeLocallyAddedTool(toolId: number): void {
        const before = this.locallyAddedTools.length;
        this.locallyAddedTools = this.locallyAddedTools.filter(
            (t) => t.id !== toolId,
        );
        if (this.locallyAddedTools.length !== before) {
            this.saveLocallyAddedToolsToStorage();
        }
    }

    // Observables do serviço de módulos
    modules$: Observable<Module[]>;
    modulesLoading$: Observable<boolean>;
    modules: Module[] = []; // Adicionar array local para módulos
    private modulesSubject = new BehaviorSubject<Module[]>([]);
    private moduleRequestId = 0;

    // Cache local para módulos adicionados temporariamente
    private localModulesCache = new Map<number, Module[]>();

    support: Support | null = null;
    supportPhone: string = '';
    supportEmail: string = '';
    supportLoading$: Observable<boolean>;
    supportSaving$: Observable<boolean>;

    // Configurações
    courseName: string = 'Gestão de Tráfego';

    private destroy$ = new Subject<void>();
    private supportSavingSubject = new BehaviorSubject<boolean>(false);
    private userSearchSub?: Subscription;

    dropdownToolIndex: number | null = null;
    dropdownUserIndex: number | null = null;
    dropdownModuleIndex: number | null = null;
    dropdownLessonIndex: number | null = null;

    confirmModalOpen = false;
    confirmModalTarget: {
        action: 'deleteModule' | 'deleteModuleFromRole' | 'deleteLesson' | 'deleteLessonFromModule'
            | 'deleteUser' | 'deleteUserFromRole' | 'deleteTool' | 'deleteToolFromRole';
        module?: Module;
        lesson?: Lesson;
        user?: User;
        tool?: Tool;
    } | null = null;
    isDeletingTarget = false;

    showToolActionsDropdown(index: number, event: MouseEvent): void {
        event.stopPropagation();
        this.dropdownToolIndex = index;
        this.dropdownUserIndex = null; // Fecha dropdown de usuário se aberto
        this.dropdownModuleIndex = null; // Fecha dropdown de módulo se aberto
        this.dropdownLessonIndex = null; // Fecha dropdown de aula se aberto
    }

    hideToolActionsDropdown(): void {
        if (this.dropdownToolIndex !== null) {
            this.dropdownToolIndex = null;
        }
    }

    showUserActionsDropdown(index: number, event: MouseEvent): void {
        event.stopPropagation();
        this.dropdownUserIndex = index;
        this.dropdownToolIndex = null; // Fecha dropdown de ferramenta se aberto
        this.dropdownModuleIndex = null; // Fecha dropdown de módulo se aberto
        this.dropdownLessonIndex = null; // Fecha dropdown de aula se aberto
    }

    hideUserActionsDropdown(): void {
        if (this.dropdownUserIndex !== null) {
            this.dropdownUserIndex = null;
        }
    }

    showModuleActionsDropdown(index: number, event: MouseEvent): void {
        event.stopPropagation();
        this.dropdownModuleIndex = index;
        this.dropdownToolIndex = null; // Fecha dropdown de ferramenta se aberto
        this.dropdownUserIndex = null; // Fecha dropdown de usuário se aberto
        this.dropdownLessonIndex = null; // Fecha dropdown de aula se aberto
    }

    hideModuleActionsDropdown(): void {
        if (this.dropdownModuleIndex !== null) {
            this.dropdownModuleIndex = null;
        }
    }

    showLessonActionsDropdown(index: number, event: MouseEvent): void {
        event.stopPropagation();
        this.dropdownLessonIndex = index;
        this.dropdownToolIndex = null; // Fecha dropdown de ferramenta se aberto
        this.dropdownUserIndex = null; // Fecha dropdown de usuário se aberto
        this.dropdownModuleIndex = null; // Fecha dropdown de módulo se aberto
    }

    hideLessonActionsDropdown(): void {
        if (this.dropdownLessonIndex !== null) {
            this.dropdownLessonIndex = null;
        }
    }

    onDeleteTool(tool: Tool): void {
        this.confirmModalTarget = { action: 'deleteTool', tool };
        this.confirmModalOpen = true;
        this.hideToolActionsDropdown();
    }

    onDeleteToolFromRole(tool: Tool): void {
        this.confirmModalTarget = { action: 'deleteToolFromRole', tool };
        this.confirmModalOpen = true;
        this.hideToolActionsDropdown();
    }

    onDeleteModule(module: Module): void {
        this.confirmModalTarget = { action: 'deleteModule', module };
        this.confirmModalOpen = true;
        this.hideModuleActionsDropdown();
    }

    onDeleteModuleFromRole(module: Module): void {
        this.confirmModalTarget = { action: 'deleteModuleFromRole', module };
        this.confirmModalOpen = true;
        this.hideModuleActionsDropdown();
    }

    onDeleteLesson(lesson: Lesson, module: Module): void {
        this.confirmModalTarget = { action: 'deleteLesson', module, lesson };
        this.confirmModalOpen = true;
        this.hideLessonActionsDropdown();
    }

    onDeleteLessonFromModule(lesson: Lesson, module: Module): void {
        this.confirmModalTarget = { action: 'deleteLessonFromModule', module, lesson };
        this.confirmModalOpen = true;
        this.hideLessonActionsDropdown();
    }

    onConfirmDelete(): void {
        if (!this.confirmModalTarget) return;
        this.isDeletingTarget = true;
        const { action, module, lesson, user, tool } = this.confirmModalTarget;
        const token = this.authService.getToken() || '';

        switch (action) {
            case 'deleteModule':
                this.moduleService.deleteModule(module!.id, token).subscribe({
                    next: () => {
                        this.modules = this.modules.filter((m) => m.id !== module!.id);
                        this.modulesSubject.next(this.modules);
                        if (this.cargo?.id) {
                            const existing = this.localModulesCache.get(this.cargo.id) || [];
                            const updated = existing.filter((m) => m.id !== module!.id);
                            this.localModulesCache.set(this.cargo.id, updated);
                            this.saveLocalModulesToStorage();
                        }
                        this.resetDeleteState();
                    },
                    error: () => this.resetDeleteState(),
                });
                break;
            case 'deleteModuleFromRole':
                if (!this.cargo) return this.resetDeleteState();
                this.moduleService.deleteModuleFromRole(module!.id, this.cargo.id, token).subscribe({
                    next: () => {
                        this.modules = this.modules.filter((m) => m.id !== module!.id);
                        this.modulesSubject.next(this.modules);
                        if (this.cargo?.id) {
                            const existing = this.localModulesCache.get(this.cargo.id) || [];
                            const updated = existing.filter((m) => m.id !== module!.id);
                            this.localModulesCache.set(this.cargo.id, updated);
                            this.saveLocalModulesToStorage();
                        }
                        this.resetDeleteState();
                    },
                    error: () => this.resetDeleteState(),
                });
                break;
            case 'deleteLesson':
                this.lessonService.deleteLesson(lesson!.id, token).subscribe({
                    next: () => this.resetDeleteState(),
                    error: () => this.resetDeleteState(),
                });
                break;
            case 'deleteLessonFromModule':
                this.lessonService.deleteLessonFromModule(lesson!.id, module!.id, token).subscribe({
                    next: () => this.resetDeleteState(),
                    error: () => this.resetDeleteState(),
                });
                break;
            case 'deleteUser':
                this.usersService.deleteUser(user!.id, token).subscribe({
                    next: () => {
                        this.filteredUsers = this.filteredUsers.filter((u) => u.id !== user!.id);
                        this.users = this.users.filter((u) => u.id !== user!.id);
                        this.removeLocallyAddedUser(user!.id);
                        if (this.cargo?.name) {
                            this.usersService.clearCache(this.cargo.name);
                            this.loadUsers();
                        }
                        this.resetDeleteState();
                    },
                    error: () => this.resetDeleteState(),
                });
                break;
            case 'deleteUserFromRole':
                if (!this.cargo) return this.resetDeleteState();
                this.usersService.deleteUserFromRole(user!.id, this.cargo.id, token).subscribe({
                    next: () => {
                        this.filteredUsers = this.filteredUsers.filter((u) => u.id !== user!.id);
                        this.users = this.users.filter((u) => u.id !== user!.id);
                        this.removeLocallyAddedUser(user!.id);
                        const currentState = this.usersService['usersStateSubject'].value;
                        this.usersService['usersStateSubject'].next({
                            ...currentState,
                            users: currentState.users.filter((u: any) => u.id !== user!.id),
                        });
                        if (this.cargo?.name) {
                            const cacheKey = `${this.cargo.name}_1_5`;
                            const cached = this.usersService['cache'].get(cacheKey);
                            if (cached) {
                                const updatedUsers = cached.data.users.filter(
                                    (u: any) => u.id !== user!.id,
                                );
                                this.usersService['cache'].set(cacheKey, {
                                    ...cached,
                                    data: { ...cached.data, users: updatedUsers },
                                });
                            }
                        }
                        if (this.cargo && typeof this.cargo.users_count === 'number') {
                            this.cargo = {
                                ...this.cargo,
                                users_count: Math.max(0, this.cargo.users_count - 1),
                            };
                            this.cargoUpdated.emit(this.cargo);
                        }
                        this.resetDeleteState();
                    },
                    error: () => this.resetDeleteState(),
                });
                break;
            case 'deleteTool':
                this.toolsService.deleteTool(tool!.id, token).subscribe({
                    next: () => {
                        this.filteredTools = this.filteredTools.filter((t) => t.id !== tool!.id);
                        this.tools = this.tools.filter((t) => t.id !== tool!.id);
                        this.removeLocallyAddedTool(tool!.id);
                        this.resetDeleteState();
                    },
                    error: () => this.resetDeleteState(),
                });
                break;
            case 'deleteToolFromRole':
                if (!this.cargo) return this.resetDeleteState();
                this.toolsService.deleteToolFromRole(tool!.id, this.cargo.id, token).subscribe({
                    next: () => {
                        this.filteredTools = this.filteredTools.filter((t) => t.id !== tool!.id);
                        this.tools = this.tools.filter((t) => t.id !== tool!.id);
                        this.removeLocallyAddedTool(tool!.id);
                        const currentState = this.toolsService.toolsSubject.value;
                        if (currentState) {
                            this.toolsService.toolsSubject.next({
                                ...currentState,
                                tools: currentState.tools.filter((t: any) => t.id !== tool!.id),
                            });
                        }
                        this.resetDeleteState();
                    },
                    error: () => this.resetDeleteState(),
                });
                break;
        }
    }

    onCancelDelete(): void {
        this.resetDeleteState();
    }

    private resetDeleteState(): void {
        this.isDeletingTarget = false;
        this.confirmModalOpen = false;
        this.confirmModalTarget = null;
    }

    onDeleteUser(user: User): void {
        this.confirmModalTarget = { action: 'deleteUser', user };
        this.confirmModalOpen = true;
        this.hideUserActionsDropdown();
    }

    onDeleteUserFromModule(user: User): void {
        this.confirmModalTarget = { action: 'deleteUserFromRole', user };
        this.confirmModalOpen = true;
        this.hideUserActionsDropdown();
    }

    constructor(
        private usersService: UsersService,
        private toolsService: ToolsService,
        private supportService: SupportService,
        private rolesService: RolesService,
        private moduleService: ModuleService,
        private lessonService: LessonService,
        private router: Router,
        private cdr: ChangeDetectorRef, // Adicionado para detecção de mudanças
        private authService: AuthService,
        private adminService: AdminService,
    ) {
        this.users$ = this.usersService.users$;
        this.loading$ = this.usersService.loading$;
        this.error$ = this.usersService.error$;
        this.pagination$ = this.usersService.pagination$;
        this.role$ = this.usersService.role$;
        this.progressStatistics$ = this.usersService.progressStatistics$;

        // Atualiza users local sempre que users$ emitir
        this.users$.subscribe((users) => {
            // Sempre recarrega do localStorage para garantir persistência
            this.loadLocallyAddedUsersFromStorage();
            // Mescla usuários da API com os adicionados localmente, sem duplicar
            const mergedUsers = [...(users || [])];
            this.locallyAddedUsers.forEach((localUser) => {
                if (!mergedUsers.some((u) => u.id === localUser.id)) {
                    mergedUsers.push(localUser);
                }
            });
            // Garante que não há duplicatas (caso users já contenha algum local)
            this.users = mergedUsers.filter(
                (user, idx, arr) => arr.findIndex((u) => u.id === user.id) === idx,
            );
            this.applyUserFilter();
            // this.cdr.detectChanges();
        });

        // Módulos - usar estado global do ModuleService para sincronização em tempo real
        this.modules$ = this.moduleService.modules$;
        this.modulesLoading$ = this.moduleService.loading$;

        // Sincronizar módulos com o LessonService e atualizar estado local
        this.modules$.pipe(takeUntil(this.destroy$)).subscribe((modules) => {
            this.lessonService.setModules(modules);
            if (modules && modules.length > 0) {
                // Combinar módulos do servidor com módulos locais persistidos
                const localModules =
                    this.localModulesCache.get(this.cargo?.id ?? 0) || [];

                const modulesMap = new Map<number, Module>();
                modules.forEach((m) => modulesMap.set(m.id, m));
                localModules.forEach((lm) => {
                    if (!modulesMap.has(lm.id)) modulesMap.set(lm.id, lm);
                });

                const combinedModules = Array.from(modulesMap.values());
                this.modules = combinedModules;
                this.modulesSubject.next(this.modules);
            }
        });

        // Calcula estatísticas baseadas nos usuários
        // this.stats$ = this.users$.pipe(
        //     map(users => this.calculateStats(users)),
        //     takeUntil(this.destroy$)
        // );

        // Ferramentas - usar estado local em vez do global
        this.tools$ = this.toolsSubject.asObservable();
        this.toolsLoading$ = this.toolsService.loading$;
        this.toolsError$ = this.toolsErrorSubject.asObservable();

        // Atualiza tools local sempre que tools$ emitir
        this.tools$.subscribe((tools) => {
            // Sempre recarrega do localStorage para garantir persistência
            this.loadLocallyAddedToolsFromStorage();
            // Mescla ferramentas da API com as adicionadas localmente, sem duplicar
            if (tools && tools.length > 0) {
                // Combinar ferramentas do servidor com ferramentas locais não sincronizadas
                const currentLocalTools = this.tools || [];

                const toolsMap = new Map<number, Tool>();

                // Adicionar ferramentas do servidor primeiro
                tools.forEach((tool) => {
                    toolsMap.set(tool.id, tool);
                });

                // Adicionar ferramentas locais que não estão no servidor
                currentLocalTools.forEach((localTool) => {
                    if (!toolsMap.has(localTool.id)) {
                        toolsMap.set(localTool.id, localTool);
                    }
                });

                const combinedTools = Array.from(toolsMap.values());
                this.tools = combinedTools;
                this.applyToolFilter();
            }
        });

        // Suporte
        this.supportLoading$ = this.supportService.loading$;
        this.supportSaving$ = this.supportSavingSubject.asObservable();
    }

    ngOnInit(): void {
        // Limpar apenas campos locais na inicialização (não o cache)
        this.clearLocalSupportData();

        // Garantir que os módulos não sejam expandidos automaticamente na inicialização
        this.expandedModules.clear();

        // Carregar módulos locais do localStorage
        this.loadLocalModulesFromStorage();

        // Carregar usuários adicionados localmente do localStorage
        this.loadLocallyAddedUsersFromStorage();

        // Carregar ferramentas adicionadas localmente do localStorage
        this.loadLocallyAddedToolsFromStorage();

        // Sincronizar campos de configuração com o cargo selecionado
        if (this.cargo) {
            this.courseName = this.cargo.name || '';
        }

        // Restaurar tab ativa do localStorage se existir
        this.restoreTabState();

        // Carregar dados específicos da tab ativa
        this.loadModulesIfNeeded();
        this.loadUsersIfNeeded();
        this.loadToolsIfNeeded();
        this.loadSupportIfNeeded();
        // Adicionar listener para fechar dropdowns quando clicar fora
        document.addEventListener('click', this.handleDocumentClick.bind(this));

        // Adicionar listener para fechar dropdowns quando pressionar Escape
        document.addEventListener('keydown', this.handleKeydown.bind(this));

        // Escutar eventos de exclusão global de aulas
        this.lessonService.lessonDeleted$
            .pipe(takeUntil(this.destroy$))
            .subscribe((deletionEvent) => {
                if (deletionEvent) {
                    // O cache já foi atualizado de forma eficiente pelo LessonService
                    // Não é necessário fazer requisições adicionais ao servidor
                    // Apenas limpar o evento após processamento
                    this.lessonService.clearLessonDeletedEvent();
                }
            });
    }

    ngOnChanges(changes: SimpleChanges): void {
        // Detectar mudança no cargo
        if (changes['cargo'] && !changes['cargo'].firstChange) {
            const previousCargo = changes['cargo'].previousValue;
            const currentCargo = changes['cargo'].currentValue;

            // Se o cargo mudou, apenas limpar os campos locais (não o cache)
            if (previousCargo?.id !== currentCargo?.id) {
                this.clearLocalSupportData();

                // Limpar usuários adicionados localmente ao trocar de cargo
                this.locallyAddedUsers = [];
                this.loadLocallyAddedUsersFromStorage();

                // Limpar ferramentas adicionadas localmente ao trocar de cargo
                this.locallyAddedTools = [];
                this.loadLocallyAddedToolsFromStorage();

                // Limpar módulos do curso anterior para evitar vazamento de dados
                this.modules = [];
                this.modulesSubject.next([]);

                // Incrementar contador para ignorar respostas de requests antigas (race condition)
                this.moduleRequestId++;

                // Limpar cache interno do ModuleService (cache Map + BehaviorSubject)
                this.moduleService.clearCache();

                // Limpar cache local de módulos
                this.localModulesCache.clear();
                if (this.cargo?.id) {
                    localStorage.removeItem(`localModules_${this.cargo.id}`);
                }

                // Garantir que os módulos não sejam expandidos quando o cargo muda
                this.expandedModules.clear();

                // Sincronizar campos de configuração com o novo cargo
                this.courseName = currentCargo?.name || '';

                // Carregar módulos do servidor para o novo cargo
                this.loadModulesIfNeeded();

                // Se a tab ativa for suporte, carregar dados do novo cargo
                if (this.activeTab === 'suporte') {
                    this.loadSupport();
                }
            }
        }
    }

    ngAfterViewInit(): void {
        // Rolar para o topo quando o componente for exibido
        setTimeout(() => {
            this.scrollToTop();
        }, 0);
    }

    ngOnDestroy(): void {
        if (this.userSearchSub) this.userSearchSub.unsubscribe();
        this.destroy$.next();
        this.destroy$.complete();
        document.removeEventListener('click', this.handleDocumentClick.bind(this));
        document.removeEventListener('keydown', this.handleKeydown.bind(this));
    }

    private handleDocumentClick(event: Event): void {
        const target = event.target as HTMLElement;

        // Verificar se clicou em algum trigger de dropdown
        const toolTrigger = target.closest('.cargo-tools-table-actions');
        const userTrigger = target.closest('.cargo-users-table-actions');
        const moduleTrigger = target.closest('.cargo-users-table-actions'); // Mesma classe para módulos
        const lessonTrigger = target.closest('.cargo-users-table-actions'); // Mesma classe para aulas

        if (toolTrigger || userTrigger || moduleTrigger || lessonTrigger) {
            // Se clicou em um trigger, não fechar (o método específico vai lidar com isso)
            return;
        }

        // Verificar se clicou dentro de algum dropdown
        const dropdownMenu = target.closest('.dropdown-menu');

        if (dropdownMenu) {
            // Se clicou dentro de um dropdown, verificar se foi em um item
            const dropdownItem = target.closest('.dropdown-menu-item');
            if (!dropdownItem) {
                // Se clicou dentro do dropdown mas não em um item, fechar todos os dropdowns
                this.hideToolActionsDropdown();
                this.hideUserActionsDropdown();
                this.hideModuleActionsDropdown();
                this.hideLessonActionsDropdown();
            }
            return;
        }

        // Se chegou até aqui, clicou fora de todos os dropdowns - fechar todos
        this.hideToolActionsDropdown();
        this.hideUserActionsDropdown();
        this.hideModuleActionsDropdown();
        this.hideLessonActionsDropdown();
    }

    private handleKeydown(event: KeyboardEvent): void {
        // Fechar dropdowns se pressionar Escape
        if (event.key === 'Escape') {
            this.hideToolActionsDropdown();
            this.hideUserActionsDropdown();
            this.hideModuleActionsDropdown();
            this.hideLessonActionsDropdown();
        }
    }

    setActiveTab(tab: string): void {
        this.activeTab = tab;
        this.saveTabState();

        // Limpar expansões de módulos ao trocar de tab para evitar animações indesejadas
        if (tab !== 'conteudo') {
            this.expandedModules.clear();
        }

        // Carregar dados específicos da tab
        if (tab === 'conteudo' && this.cargo?.name) {
            this.loadModules();
        } else if (tab === 'usuarios' && this.cargo?.name) {
            this.loadUsers();
        } else if (tab === 'ferramentas' && this.cargo?.name) {
            this.loadTools();
        } else if (tab === 'suporte') {
            this.loadSupport();
        }
    }

    isActiveTab(tab: string): boolean {
        return this.activeTab === tab;
    }

    loadUsers(): void {
        if (this.cargo?.name) {
            this.usersService.loadUsers(this.cargo.name, 1, 5).subscribe();
        } else {
            console.warn('⚠️ Cargo não encontrado para carregar usuários');
        }
    }

    refreshUsers(): void {
        if (this.cargo?.name) {
            this.usersService.refreshUsers(this.cargo.name, 1, 10);
        }
    }

    loadModules(): void {
        if (this.cargo?.name) {
            const requestId = ++this.moduleRequestId;
            this.moduleService
                .loadModulesByRole(this.cargo.name, this.cargo.id)
                .subscribe({
                    next: (modules) => {
                        if (requestId !== this.moduleRequestId) return;

                        const serverModules = modules || [];

                        // Limpar módulos locais que já foram sincronizados com o servidor
                        this.clearSyncedLocalModules(serverModules.map((m) => m.id));

                        // Obter módulos adicionados localmente (persistidos)
                        const localModules =
                            this.localModulesCache.get(this.cargo!.id) || [];

                        // Combinar módulos do servidor com locais, evitando duplicatas
                        const modulesMap = new Map<number, Module>();
                        serverModules.forEach((m) => modulesMap.set(m.id, m));
                        localModules.forEach((lm) => {
                            if (!modulesMap.has(lm.id)) modulesMap.set(lm.id, lm);
                        });

                        const combinedModules = Array.from(modulesMap.values());

                        // Atualizar estado global E local
                        this.moduleService.modulesSubject.next(combinedModules);
                        this.modules = combinedModules;
                        this.modulesSubject.next(this.modules);

                        // Garantir que os módulos não sejam expandidos automaticamente
                        this.expandedModules.clear();
                    },
                    error: (error) => {
                        console.error('Erro ao carregar módulos:', error);
                        // Em caso de erro, usar apenas módulos locais
                        const localModules =
                            this.localModulesCache.get(this.cargo!.id) || [];

                        // Atualizar o estado global do ModuleService
                        this.moduleService.modulesSubject.next(localModules);

                        // Manter estado local para compatibilidade
                        this.modules = localModules;
                        this.modulesSubject.next(this.modules);

                        // Garantir que os módulos não sejam expandidos automaticamente
                        this.expandedModules.clear();
                    },
                });
        } else {
            console.warn('⚠️ Cargo não encontrado para carregar módulos');
        }
    }

    loadTools(): void {
        if (this.cargo?.name) {
            this.toolsService.loadTools(this.cargo.name).subscribe({
                next: (result) => {
                    // Obter ferramentas do servidor
                    const serverTools = result?.tools || [];

                    // Obter ferramentas atualmente na lista de exibição
                    const currentDisplayTools = this.tools || [];

                    // Obter ferramentas adicionadas localmente para este cargo
                    const localTools = this.locallyAddedTools || [];

                    // Verificar se há ferramentas na lista de exibição que não estão no servidor
                    // Essas são ferramentas que foram adicionadas localmente mas ainda não foram sincronizadas
                    const unsyncedLocalTools = currentDisplayTools.filter(
                        (displayTool) => {
                            // Se a ferramenta está na lista de exibição mas não está no servidor
                            // E não está no cache local, significa que foi adicionada recentemente
                            const isInServer = serverTools.some(
                                (serverTool) => serverTool.id === displayTool.id,
                            );
                            const isInLocalCache = localTools.some(
                                (localTool) => localTool.id === displayTool.id,
                            );

                            return !isInServer && !isInLocalCache;
                        },
                    );

                    // Limpar ferramentas locais que já foram sincronizadas com o servidor
                    this.clearSyncedLocalTools(serverTools.map((t) => t.id));

                    // Obter ferramentas locais atualizadas após limpeza
                    const updatedLocalTools = this.locallyAddedTools || [];

                    // Combinar ferramentas do servidor com ferramentas locais não sincronizadas, evitando duplicatas
                    const toolsMap = new Map<number, Tool>();

                    // Adicionar ferramentas do servidor primeiro (prioridade)
                    serverTools.forEach((tool) => {
                        toolsMap.set(tool.id, tool);
                    });

                    // Adicionar ferramentas locais não sincronizadas
                    updatedLocalTools.forEach((localTool) => {
                        if (!toolsMap.has(localTool.id)) {
                            toolsMap.set(localTool.id, localTool);
                        }
                    });

                    // Adicionar ferramentas não sincronizadas da lista de exibição
                    unsyncedLocalTools.forEach((unsyncedTool) => {
                        if (!toolsMap.has(unsyncedTool.id)) {
                            toolsMap.set(unsyncedTool.id, unsyncedTool);
                        }
                    });

                    const combinedTools = Array.from(toolsMap.values());

                    // Atualizar o estado local
                    this.tools = combinedTools;
                    this.toolsSubject.next(this.tools);
                    this.applyToolFilter();
                },
                error: (error) => {
                    this.toolsErrorSubject.next('Erro ao carregar ferramentas');
                    console.error('Erro ao carregar ferramentas:', error);
                    // Em caso de erro, usar apenas ferramentas locais
                    const localTools = this.locallyAddedTools || [];
                    this.tools = localTools;
                    this.toolsSubject.next(this.tools);
                    this.applyToolFilter();
                },
            });
        } else {
            console.warn('⚠️ Cargo não encontrado para carregar ferramentas');
        }
    }

    refreshTools(): void {
        if (this.cargo?.name) {
            this.toolsService.refreshTools(this.cargo.name).subscribe({
                next: (result) => {
                    this.tools = result?.tools || [];
                    this.toolsSubject.next(this.tools);
                },
                error: (error) => {
                    this.toolsErrorSubject.next('Erro ao atualizar ferramentas');
                    console.error('Erro ao atualizar ferramentas:', error);
                },
            });
        }
    }

    loadSupport(): void {
        const isAdmin = this.supportService['authService'].isAdmin();
        const roleName = isAdmin && this.cargo?.name ? this.cargo.name : undefined;
        const roleId = isAdmin && this.cargo?.id ? this.cargo.id : undefined;
        this.supportService
            .getSupport(false, roleName, roleId)
            .pipe(takeUntil(this.destroy$))
            .subscribe({
                next: (result) => {
                    this.support = result.support;
                    // Inicializar as propriedades locais
                    this.supportPhone = result.support?.phone || '';
                    this.supportEmail = result.support?.email || '';
                },
                error: (error) => {
                    console.error('Erro ao carregar suporte:', error);
                    // Em caso de erro, deixar os campos vazios mas funcionais
                    this.support = null;
                    this.supportPhone = '';
                    this.supportEmail = '';
                },
            });
    }

    // Forçar refresh do suporte (ignorar cache)
    refreshSupport(): void {
        const isAdmin = this.supportService['authService'].isAdmin();
        const roleName = isAdmin && this.cargo?.name ? this.cargo.name : undefined;
        const roleId = isAdmin && this.cargo?.id ? this.cargo.id : undefined;

        this.supportService
            .getSupport(true, roleName, roleId)
            .pipe(takeUntil(this.destroy$))
            .subscribe({
                next: (result) => {
                    this.support = result.support;
                    this.supportPhone = result.support?.phone || '';
                    this.supportEmail = result.support?.email || '';
                },
                error: (error) => {
                    console.error('Erro ao atualizar suporte:', error);
                },
            });
    }

    getInitials(name: string): string {
        return name
            .split(' ')
            .map((word) => word.charAt(0))
            .join('')
            .toUpperCase()
            .slice(0, 2);
    }

    getAvatarColor(userId: number): string {
        const colors = [
            '#3A4AFF',
            '#4A90E2',
            '#6A6AFF',
            '#FF6B6B',
            '#4ECDC4',
            '#45B7D1',
        ];
        return colors[userId % colors.length];
    }

    getEngagementColor(engagement: string): string {
        switch (engagement.toLowerCase()) {
            case 'altíssimo':
                return '#4ECDC4';
            case 'alto':
                return '#4ECDC4';
            case 'médio':
                return '#FFA726';
            case 'baixo':
                return '#FF6B6B';
            case 'nenhum':
                return '#808080';
            default:
                return '#808080';
        }
    }

    calculateStats(users: User[]): {
        total: number;
        averageProgress: number;
        engagement: string;
    } {
        return this.usersService.calculateStats(users);
    }

    /**
     * Calcula estatísticas usando dados da API
     */
    calculateStatsFromAPI(
        users: User[],
        progressStatistics?: any,
    ): { total: number; averageProgress: number; engagement: string } {
        return this.usersService.calculateStatsFromAPI(users, progressStatistics);
    }

    /**
     * Obtém o progresso individual do usuário
     */
    getUserProgress(user: User): number {
        return Math.round(user.progress_summary?.overall?.average_progress || 0);
    }

    /**
     * Obtém o engajamento individual do usuário baseado nas aulas concluídas
     */
    getUserEngagement(user: User): string {
        return this.usersService.calculateUserEngagement(user);
    }

    /**
     * Calcula o engajamento médio baseado nos engajamentos individuais dos usuários
     */
    getAverageEngagement(users: User[]): string {
        if (!users.length) return 'Nenhum';

        // Mapeia os engajamentos para valores numéricos para calcular a média
        const engagementValues = users.map((user) => {
            const engagement = this.getUserEngagement(user);
            switch (engagement) {
                case 'Nenhum':
                    return 0;
                case 'Baixo':
                    return 1;
                case 'Médio':
                    return 2;
                case 'Alto':
                    return 3;
                case 'Altíssimo':
                    return 4;
                default:
                    return 0;
            }
        });

        // Calcula a média
        const averageValue =
            engagementValues.reduce((sum: number, value: number) => sum + value, 0) /
            users.length;

        // Converte de volta para string
        if (averageValue === 0) return 'Nenhum';
        if (averageValue <= 1) return 'Baixo';
        if (averageValue <= 2) return 'Médio';
        if (averageValue <= 3) return 'Alto';
        return 'Altíssimo';
    }

    /**
     * Obtém a data do último acesso do usuário
     */
    getUserLastAccess(user: User): string {
        return user.last_login_at ? user.last_login_at : '---';
    }

    private scrollToTop(): void {
        window.scrollTo({ top: 0, behavior: 'smooth' });
    }

    private loadUsersIfNeeded(): void {
        // Se a tab ativa for usuários, carrega os dados
        if (this.activeTab === 'usuarios' && this.cargo?.name) {
            this.loadUsers();
        }
    }

    private loadModulesIfNeeded(): void {
        // Se a tab ativa for conteúdo, carrega os módulos
        if (this.activeTab === 'conteudo' && this.cargo?.name) {
            this.loadModules();
        }
    }

    private saveTabState(): void {
        if (this.cargo?.id) {
            const tabState = {
                cargoId: this.cargo.id,
                activeTab: this.activeTab,
                timestamp: Date.now(),
            };
            localStorage.setItem(
                `cargoTabState_${this.cargo.id}`,
                JSON.stringify(tabState),
            );
        }
    }

    private restoreTabState(): void {
        if (this.cargo?.id) {
            try {
                const savedTabState = localStorage.getItem(
                    `cargoTabState_${this.cargo.id}`,
                );
                if (savedTabState) {
                    const tabState = JSON.parse(savedTabState);
                    const now = Date.now();
                    const oneHour = 60 * 60 * 1000; // 1 hora em millisegundos

                    // Restaurar apenas se o estado foi salvo há menos de 1 hora
                    if (tabState.timestamp && now - tabState.timestamp < oneHour) {
                        this.activeTab = tabState.activeTab || 'conteudo';
                    } else {
                        // Limpar estado expirado
                        localStorage.removeItem(`cargoTabState_${this.cargo.id}`);
                    }
                }
            } catch (error) {
                console.error('Erro ao restaurar estado da tab:', error);
                localStorage.removeItem(`cargoTabState_${this.cargo.id}`);
            }
        }
    }

    // Métodos para controlar o sidebar de adicionar usuário
    showAddUserSidebar(): void {
        this.showAddUserSidebarFlag = true;
    }

    hideAddUserSidebar(): void {
        this.showAddUserSidebarFlag = false;
    }

    onUserCreated(user: any): void {
        // A lista já foi atualizada otimisticamente pelo UsersService
        this.hideAddUserSidebar();
        // Atualiza o users_count localmente e emite para o dashboard
        if (this.cargo) {
            const updatedCargo = {
                ...this.cargo,
                users_count: (this.cargo.users_count || 0) + 1,
            };
            this.cargo = updatedCargo;
            this.cargoUpdated.emit(updatedCargo);
        }
    }

    showAddToolSidebar(): void {
        this.showAddToolSidebarFlag = true;
    }

    hideAddToolSidebar(): void {
        this.showAddToolSidebarFlag = false;
    }

    onToolCreated(tool: any): void {
        // Atualiza a lista local e o observable imediatamente
        if (tool) {
            // Verificar se a ferramenta já existe na lista atual
            const existingToolIndex = this.tools.findIndex((t) => t.id === tool.id);
            let updatedTools: Tool[];

            if (existingToolIndex !== -1) {
                // Se já existe, atualizar a ferramenta existente
                updatedTools = [...this.tools];
                updatedTools[existingToolIndex] = tool;
            } else {
                // Se não existe, adicionar nova ferramenta
                updatedTools = [...this.tools, tool];
            }

            this.tools = updatedTools;
            this.toolsSubject.next(this.tools);

            // NÃO salvar no cache local quando a ferramenta é criada via API
            // O cache local é apenas para ferramentas que ainda não foram sincronizadas com o servidor
            // Quando uma ferramenta é criada via API, ela já está no servidor e será carregada
            // na próxima busca, então não precisa estar no cache local

            this.applyToolFilter();
            this.cdr.detectChanges();
        }
        this.hideAddToolSidebar();
    }

    // Métodos para controlar o modal de adicionar módulo
    showAddModuleModal(): void {
        this.showAddModuleModalFlag = true;
    }

    hideAddModuleModal(): void {
        this.showAddModuleModalFlag = false;
    }

    onModuleCreated(module: any): void {
        // Adicionar o novo módulo ao array local
        if (module) {
            const newModule: Module = {
                id: module.id || Date.now(),
                name: module.name,
                thumbnail_url:
                    module.thumbnail_url || '/assets/images/default-module.jpg',
                contentCount: 0,
                lessons: [],
            };

            console.log(`🆕 Módulo criado:`, {
                id: newModule.id,
                name: newModule.name,
            });

            // Verificar se o módulo já existe na lista atual
            const existingModuleIndex = this.modules.findIndex(
                (m) => m.id === newModule.id,
            );
            let updatedModules: Module[];

            if (existingModuleIndex !== -1) {
                // Se já existe, atualizar o módulo existente
                console.log(`🔄 Atualizando módulo existente: ${newModule.name}`);
                updatedModules = [...this.modules];
                updatedModules[existingModuleIndex] = newModule;
            } else {
                // Se não existe, adicionar novo módulo
                console.log(`➕ Adicionando novo módulo: ${newModule.name}`);
                updatedModules = [...this.modules, newModule];
            }

            // Atualizar o estado global do ModuleService para sincronização em tempo real
            this.moduleService.modulesSubject.next(updatedModules);

            // Manter estado local para compatibilidade
            this.modules = updatedModules;
            this.modulesSubject.next(this.modules);

            // NÃO salvar no cache local quando o módulo é criado via API
            // O cache local é apenas para módulos que ainda não foram sincronizados com o servidor
            // Quando um módulo é criado via API, ele já está no servidor e será carregado
            // na próxima busca, então não precisa estar no cache local
        }

        this.hideAddModuleModal();
    }

    showAddLessonModal(moduleId: number, moduleName: string): void {
        this.addLessonModuleId = moduleId;
        this.addLessonModuleName = moduleName;
        this.showAddLessonModalFlag = true;
    }

    hideAddLessonModal(): void {
        this.showAddLessonModalFlag = false;
        this.addLessonModuleId = null;
        this.addLessonModuleName = null;
    }

    // Edit Lesson Modal
    showEditLessonModal(lesson: any, module: any): void {
        this.editLessonData = lesson;
        this.editLessonModuleId = module.id;
        this.editLessonModuleName = module.name;
        this.showEditLessonModalFlag = true;
    }

    hideEditLessonModal(): void {
        this.showEditLessonModalFlag = false;
        this.editLessonData = null;
        this.editLessonModuleId = null;
        this.editLessonModuleName = null;
    }

    // Edit Module Modal
    showEditModuleModal(moduleData: any): void {
        this.editModuleData = moduleData;
        this.showEditModuleModalFlag = true;
    }

    hideEditModuleModal(): void {
        this.showEditModuleModalFlag = false;
        this.editModuleData = null;
    }

    // Edit Tool Modal
    showEditToolModal(tool: any): void {
        this.editToolData = tool;
        this.showEditToolModalFlag = true;
    }

    hideEditToolModal(): void {
        this.showEditToolModalFlag = false;
        this.editToolData = null;
    }

    onLessonCreated(lesson: any): void {
        // Atualizar o módulo local com a nova aula
        if (lesson && this.addLessonModuleId) {
            const moduleIndex = this.modules.findIndex(
                (m) => m.id === this.addLessonModuleId,
            );
            if (moduleIndex !== -1) {
                const updatedModules = [...this.modules];
                const module = { ...updatedModules[moduleIndex] };

                // Adicionar a nova aula ao módulo
                const newLesson: Lesson = {
                    id: lesson.id || Date.now(),
                    uuid: lesson.uuid || '',
                    name: lesson.name,
                    description: lesson.description || '',
                    thumbnail_url:
                        lesson.thumbnail_url || '/assets/images/default-lesson.jpg',
                    video_url: lesson.video_url || '',
                    created_at: lesson.created_at || new Date().toISOString(),
                    updated_at: lesson.updated_at || new Date().toISOString(),
                    deleted_at: null,
                    pivot: {
                        module_id: this.addLessonModuleId,
                        lesson_id: lesson.id || Date.now(),
                    },
                };

                module.lessons = [...(module.lessons || []), newLesson];
                updatedModules[moduleIndex] = module;

                // Atualizar o estado global do ModuleService para sincronização em tempo real
                this.moduleService.modulesSubject.next(updatedModules);

                // Manter estado local para compatibilidade
                this.modules = updatedModules;
                this.modulesSubject.next(this.modules);
            }
        }

        this.hideAddLessonModal();
    }

    onLessonUpdated(lessonData: any): void {
        if (lessonData && this.editLessonModuleId) {
            const moduleId = this.editLessonModuleId;
            const updatedLessonFields: Partial<Lesson> = {
                name: lessonData.name,
                description: lessonData.description,
                thumbnail_url: lessonData.thumbnail_url,
                video_url: lessonData.video_url,
            };
            this.moduleService.updateLessonInAllCaches(moduleId, lessonData.id, updatedLessonFields);

            const moduleIndex = this.modules.findIndex(m => m.id === moduleId);
            if (moduleIndex !== -1) {
                const updatedModules = [...this.modules];
                const module = { ...updatedModules[moduleIndex] };
                const lessonIndex = module.lessons?.findIndex(l => l.id === lessonData.id);
                if (lessonIndex !== undefined && lessonIndex >= 0 && module.lessons) {
                    const updatedLessons = [...module.lessons];
                    updatedLessons[lessonIndex] = { ...updatedLessons[lessonIndex], ...lessonData };
                    module.lessons = updatedLessons;
                    updatedModules[moduleIndex] = module;
                    this.modules = updatedModules;
                    this.modulesSubject.next(this.modules);
                }
            }
        }
        this.hideEditLessonModal();
    }

    onModuleUpdated(moduleData: any): void {
        if (moduleData) {
            const updatedModule: Partial<Module> = {
                name: moduleData.name,
                thumbnail_url: moduleData.thumbnail_url,
            };
            this.moduleService.updateModuleInAllCaches(moduleData.id, updatedModule);
            const index = this.modules.findIndex(m => m.id === moduleData.id);
            const updatedModules = [...this.modules];
            if (index !== -1) {
                updatedModules[index] = { ...updatedModules[index], ...updatedModule };
            }
            this.modules = updatedModules;
            this.modulesSubject.next(this.modules);
        }
        this.hideEditModuleModal();
    }

    onToolUpdated(tool: any): void {
        if (tool) {
            const index = this.tools.findIndex(t => t.id === tool.id);
            if (index !== -1) {
                const updatedTools = [...this.tools];
                updatedTools[index] = tool;
                this.tools = updatedTools;
                this.toolsSubject.next(this.tools);
                this.applyToolFilter();
                this.cdr.detectChanges();
            }
        }
        this.hideEditToolModal();
    }

    // Métodos para controlar o lesson viewer
    showLessonViewer(lesson: Lesson, module: Module): void {
        const hash = this.adminService.getTenantHash();
        if (hash) {
            this.router.navigate([`/admin/${hash}/lesson`, module.id, lesson.id]);
        } else {
            this.router.navigate(['/lesson', module.id, lesson.id]);
        }
    }

    onSupportCancel(): void {
        this.isEditingWhatsapp = false;
        this.isEditingEmail = false;
    }

    onSupportSave(): void {
        // Determinar quais campos foram modificados
        const phoneChanged = this.isEditingWhatsapp;
        const emailChanged = this.isEditingEmail;

        // Se nenhum campo foi editado, não fazer nada
        if (!phoneChanged && !emailChanged) {
            this.onSupportCancel();
            return;
        }

        // Preparar dados para envio
        const phone = phoneChanged ? this.supportPhone : undefined;
        const email = emailChanged ? this.supportEmail : undefined;

        // Determinar role_name e role_id para admin
        const isAdmin = this.supportService['authService'].isAdmin();
        const roleName = isAdmin && this.cargo?.name ? this.cargo.name : undefined;
        const roleId = isAdmin && this.cargo?.id ? this.cargo.id : undefined;

        // Iniciar salvamento
        this.supportSavingSubject.next(true);

        this.supportService
            .updateSupport(phone, email, roleName, roleId)
            .pipe(takeUntil(this.destroy$))
            .subscribe({
                next: (result) => {
                    // Atualizar dados locais
                    this.support = result.support;
                    this.supportPhone = result.support?.phone || '';
                    this.supportEmail = result.support?.email || '';

                    // Sair do modo de edição
                    this.isEditingWhatsapp = false;
                    this.isEditingEmail = false;

                    // Finalizar salvamento
                    this.supportSavingSubject.next(false);
                },
                error: (error) => {
                    console.error('Erro ao salvar suporte:', error);
                    // Finalizar salvamento
                    this.supportSavingSubject.next(false);
                    // Aqui você pode adicionar uma notificação de erro se desejar
                },
            });
    }

    // Otimização: Método para validar se os dados foram alterados
    hasSupportChanges(): boolean {
        if (!this.support) return this.isEditingWhatsapp || this.isEditingEmail;

        const phoneChanged =
            this.isEditingWhatsapp && this.supportPhone !== this.support.phone;
        const emailChanged =
            this.isEditingEmail && this.supportEmail !== this.support.email;

        return phoneChanged || emailChanged;
    }

    private loadToolsIfNeeded(): void {
        if (this.activeTab === 'ferramentas' && this.cargo?.name) {
            this.loadTools();
        }
    }

    private loadSupportIfNeeded(): void {
        if (this.activeTab === 'suporte') {
            this.loadSupport();
        }
    }

    private clearLocalSupportData(): void {
        this.support = null;
        this.supportPhone = '';
        this.supportEmail = '';
        this.isEditingWhatsapp = false;
        this.isEditingEmail = false;
        this.supportSavingSubject.next(false);
    }

    // Métodos para controlar a edição de configurações
    copyInviteLink(): void {
        const hash = this.adminService.getTenantHash();
        const url = `https://grupomillion.com/invite/${this.cargo?.invite_token || ''}${hash ? `?admin=${hash}` : ''}`;
        navigator.clipboard.writeText(url).catch(() => {
            const input = document.createElement('input');
            input.value = url;
            document.body.appendChild(input);
            input.select();
            document.execCommand('copy');
            document.body.removeChild(input);
        });
    }

    onConfigCancel(): void {
        this.isEditingCourseName = false;
    }

    onConfigSave(): void {
        if (!this.cargo) return;
        const updates: any = {};
        if (this.isEditingCourseName && this.courseName !== this.cargo.name) {
            updates.name = this.courseName;
        }
        if (Object.keys(updates).length === 0) {
            this.isEditingCourseName = false;
            return;
        }

        this.rolesService
            .updateRole(this.cargo.id, updates)
            .pipe(takeUntil(this.destroy$))
            .subscribe({
                next: (updatedRole) => {
                    const updatedCargo = {
                        ...this.cargo!,
                        name: this.isEditingCourseName ? this.courseName : this.cargo!.name,
                    };

                    this.cargo = updatedCargo;
                    this.rolesService.clearCache();
                    this.updateDashboardState(updatedCargo);
                    this.cargoUpdated.emit(updatedCargo);

                    this.isEditingCourseName = false;
                },
                error: (error) => {
                    console.error('❌ Erro ao atualizar cargo:', error);
                    // Aqui você pode adicionar uma notificação de erro se desejar
                },
            });
    }

    private updateDashboardState(updatedCargo: Role): void {
        try {
            const savedState = localStorage.getItem('dashboardState');
            if (savedState) {
                const state = JSON.parse(savedState);
                if (state.selectedCargo && state.selectedCargo.id === updatedCargo.id) {
                    // Atualiza o cargo selecionado no localStorage
                    state.selectedCargo = { ...state.selectedCargo, ...updatedCargo };
                    localStorage.setItem('dashboardState', JSON.stringify(state));
                }
            } else {
                // Se não existe estado salvo, cria um novo
                const newState = {
                    selectedCargo: updatedCargo,
                    timestamp: Date.now(),
                };
                localStorage.setItem('dashboardState', JSON.stringify(newState));
            }

            // Também salva no localStorage específico do cargo para persistência
            const cargoState = {
                cargo: updatedCargo,
                timestamp: Date.now(),
            };
            localStorage.setItem(
                `cargo_${updatedCargo.id}`,
                JSON.stringify(cargoState),
            );
        } catch (error) {
            console.error('Erro ao atualizar dashboardState:', error);
        }
    }

    // Otimização: Método para validar se os dados foram alterados
    hasConfigChanges(): boolean {
        return this.isEditingCourseName;
    }

    // Método para alterar o status ativo/inativo do cargo
    onActiveStatusChange(event: any): void {
        if (!this.cargo) return;

        const newActiveStatus = event.target.checked;

        // Atualiza o cargo local imediatamente para feedback visual
        this.cargo = { ...this.cargo, active: newActiveStatus };

        // Chama o serviço para atualizar no backend
        this.rolesService
            .updateRole(this.cargo.id, { active: newActiveStatus })
            .pipe(takeUntil(this.destroy$))
            .subscribe({
                next: (updatedRole) => {
                    // Atualiza o cargo com os dados do servidor
                    this.cargo = { ...this.cargo!, ...updatedRole };

                    // Atualiza o localStorage do dashboardState
                    this.updateDashboardState(this.cargo);

                    // Emite evento para o componente pai
                    this.cargoUpdated.emit(this.cargo);
                },
                error: (error) => {
                    console.error('❌ Erro ao atualizar status do cargo:', error);
                    // Reverte o estado em caso de erro
                    this.cargo = { ...this.cargo!, active: !newActiveStatus };
                },
            });
    }

    // Métodos para controlar a expansão dos módulos
    toggleModuleExpansion(moduleId: number): void {
        if (this.expandedModules.has(moduleId)) {
            this.expandedModules.delete(moduleId);
        } else {
            this.expandedModules.add(moduleId);
        }
    }

    isModuleExpanded(moduleId: number): boolean {
        return this.expandedModules.has(moduleId);
    }

    onModuleDrop(event: CdkDragDrop<Module[]>): void {
        moveItemInArray(this.modules, event.previousIndex, event.currentIndex);
        this.modulesSubject.next(this.modules);
        this.moduleService.modulesSubject.next(this.modules);

        const token = this.authService.getToken() || '';
        const moduleIds = this.modules.map(m => m.id);
        const roleId = this.cargo?.id;
        const roleName = this.cargo?.name;
        if (roleId && roleName) {
            this.moduleService.reorderModules(moduleIds, roleId, token).subscribe({
                next: () => this.moduleService.syncCacheWithCurrentOrder(roleName, roleId, this.modules),
                error: (err) => console.error('Erro ao salvar ordem dos módulos', err),
            });
        }
    }

    onLessonDrop(event: CdkDragDrop<Lesson[]>, moduleId: number): void {
        const target = this.modules.find(m => m.id === moduleId);
        if (!target || !target.lessons) return;
        moveItemInArray(target.lessons, event.previousIndex, event.currentIndex);
        this.modulesSubject.next(this.modules);
        this.moduleService.modulesSubject.next(this.modules);

        const token = this.authService.getToken() || '';
        const lessonIds = target.lessons.map(l => l.id);
        this.moduleService.reorderLessons(moduleId, lessonIds, token).subscribe({
            next: () => this.moduleService.syncLessonOrderAcrossAllCaches(moduleId, this.modules),
            error: (err) => console.error('Erro ao salvar ordem das aulas', err),
        });
    }

    showUserDropdownMenu(event: MouseEvent): void {
        event.stopPropagation();
        this.showUserDropdown = !this.showUserDropdown;
    }

    hideUserDropdown(): void {
        this.showUserDropdown = false;
    }

    onCreateUser(): void {
        this.hideUserDropdown();
        this.showAddUserSidebar();
    }

    onAddExistingUser(): void {
        this.hideUserDropdown();
        this.showAddExistingUserModal = true;
    }
    onCloseAddExistingUserModal(): void {
        this.showAddExistingUserModal = false;
    }
    onAddExistingUserModal(newUsers: any[]): void {
        this.showAddExistingUserModal = false;
        const filteredNewUsers = newUsers.filter(
            (u) => !this.users.some((existing) => existing.id === u.id),
        );
        if (filteredNewUsers.length === 0) return;

        // Mapear usuários para incluir dados de progresso
        const mappedUsers = filteredNewUsers.map((user) => ({
            id: user.id,
            name: user.name,
            email: user.email,
            document: user.document,
            phone: user.phone,
            roles: user.roles,
            last_login_at: user.last_login_at,
            // Preservar dados de progresso se existirem
            module_progress: user.module_progress || [],
            lesson_progress: user.lesson_progress || [],
            progress_summary: user.progress_summary || {
                modules: {
                    total: 0,
                    completed: 0,
                    average_progress: 0,
                    total_progress: 0,
                },
                lessons: {
                    total: 0,
                    completed: 0,
                    average_progress: 0,
                    total_progress: 0,
                },
                overall: { total_items: 0, completed_items: 0, average_progress: 0 },
            },
        }));

        // Atualiza o array local
        this.users = [...this.users, ...mappedUsers];

        // Adiciona ao cache local de usuários adicionados manualmente
        this.locallyAddedUsers = [
            ...this.locallyAddedUsers,
            ...mappedUsers.filter(
                (u) => !this.locallyAddedUsers.some((lu) => lu.id === u.id),
            ),
        ];
        this.saveLocallyAddedUsersToStorage();

        // Atualiza o estado global do serviço para refletir imediatamente na UI, sem duplicar
        const currentState = this.usersService['usersStateSubject'].value;
        const newGlobalUsers = [...currentState.users];
        mappedUsers.forEach((u) => {
            if (!newGlobalUsers.some((existing) => existing.id === u.id)) {
                newGlobalUsers.push(u);
            }
        });
        this.usersService['usersStateSubject'].next({
            ...currentState,
            users: newGlobalUsers,
        });

        // Atualiza o contador de usuários do cargo
        if (this.cargo) {
            const updatedCargo = {
                ...this.cargo,
                users_count: (this.cargo.users_count || 0) + mappedUsers.length,
            };
            this.cargo = updatedCargo;
            this.cargoUpdated.emit(updatedCargo);
            // Atualiza o localStorage do dashboardState
            this.updateDashboardState(updatedCargo);
        }
        this.cdr.detectChanges();
    }

    // --- Ferramentas Dropdown ---
    showToolDropdownMenu(event: MouseEvent): void {
        event.stopPropagation();
        this.showToolDropdown = !this.showToolDropdown;
    }

    hideToolDropdown(): void {
        this.showToolDropdown = false;
    }

    onCreateTool(): void {
        this.hideToolDropdown();
        this.showAddToolSidebar();
    }

    onAddExistingTool(): void {
        this.hideToolDropdown();
        this.showAddExistingToolModal = true;
    }

    onCloseAddExistingToolModal(): void {
        this.showAddExistingToolModal = false;
    }

    // Se for necessário tratar ferramentas adicionadas, implementar aqui
    onAddExistingToolModal(newTools: any[]): void {
        this.showAddExistingToolModal = false;

        const filteredNewTools = newTools.filter(
            (t) => !this.tools.some((existing: Tool) => existing.id === t.id),
        );
        if (filteredNewTools.length === 0) return;

        // Atualiza o array local
        this.tools = [...this.tools, ...filteredNewTools];

        // Adiciona ao cache local de ferramentas adicionadas manualmente
        this.locallyAddedTools = [
            ...this.locallyAddedTools,
            ...filteredNewTools.filter(
                (t) => !this.locallyAddedTools.some((lt) => lt.id === t.id),
            ),
        ];
        this.saveLocallyAddedToolsToStorage();

        this.toolsSubject.next(this.tools);

        // Emite evento de atualização do cargo
        if (this.cargo) {
            this.cargoUpdated.emit(this.cargo);
        }
        this.cdr.detectChanges();
    }

    // --- Módulos Dropdown ---
    showModuleDropdownMenu(event: MouseEvent): void {
        event.stopPropagation();
        this.showModuleDropdown = !this.showModuleDropdown;
    }

    hideModuleDropdown(): void {
        this.showModuleDropdown = false;
    }

    onCreateModule(): void {
        this.hideModuleDropdown();
        this.showAddModuleModal();
    }

    onAddExistingModule(): void {
        this.hideModuleDropdown();
        this.showAddExistingModuleModal = true;
    }

    onCloseAddExistingModuleModal(): void {
        this.showAddExistingModuleModal = false;
    }

    onAddExistingModuleModal(newModules: Module[]): void {
        this.showAddExistingModuleModal = false;

        const filteredNewModules = newModules.filter(
            (m) => !this.modules.some((existing) => existing.id === m.id),
        );
        if (filteredNewModules.length === 0) return;

        // Atualiza o array local
        const updatedModules = [...this.modules, ...filteredNewModules];

        // Atualizar o estado global do ModuleService para sincronização em tempo real
        this.moduleService.modulesSubject.next(updatedModules);

        // Manter estado local para compatibilidade
        this.modules = updatedModules;
        this.modulesSubject.next(this.modules);

        // Salvar módulos adicionados no cache local para persistência
        if (this.cargo?.id) {
            const existingLocalModules =
                this.localModulesCache.get(this.cargo.id) || [];

            // Usar Map para garantir IDs únicos no cache local
            const localModulesMap = new Map<number, Module>();

            // Adicionar módulos existentes
            existingLocalModules.forEach((module) => {
                localModulesMap.set(module.id, module);
            });

            // Adicionar novos módulos apenas se não existirem
            filteredNewModules.forEach((module) => {
                if (!localModulesMap.has(module.id)) {
                    localModulesMap.set(module.id, module);
                }
            });

            const updatedLocalModules = Array.from(localModulesMap.values());
            this.localModulesCache.set(this.cargo.id, updatedLocalModules);

            // Salvar no localStorage para persistência entre sessões
            this.saveLocalModulesToStorage();
        }

        // Emite evento de atualização do cargo
        if (this.cargo) {
            this.cargoUpdated.emit(this.cargo);
        }
        this.cdr.detectChanges();
    }

    get moduleUserIds(): number[] {
        return this.users ? this.users.map((u) => u.id) : [];
    }

    get moduleIds(): number[] {
        return this.modules ? this.modules.map((m) => m.id) : [];
    }

    private loadLocalModulesFromStorage(): void {
        if (this.cargo?.id) {
            const savedModules = localStorage.getItem(
                `localModules_${this.cargo.id}`,
            );
            if (savedModules) {
                try {
                    const parsedModules = JSON.parse(savedModules);
                    this.localModulesCache.set(this.cargo.id, parsedModules);
                } catch (error) {
                    console.error(
                        'Erro ao carregar módulos locais do localStorage:',
                        error,
                    );
                }
            }
        }
    }

    private saveLocalModulesToStorage(): void {
        if (this.cargo?.id) {
            try {
                localStorage.setItem(
                    `localModules_${this.cargo.id}`,
                    JSON.stringify(this.localModulesCache.get(this.cargo.id) || []),
                );
            } catch (error) {
                console.error('Erro ao salvar módulos locais no localStorage:', error);
            }
        }
    }

    // Método para limpar módulos locais (usado quando dados são sincronizados com servidor)
    private clearLocalModules(): void {
        if (this.cargo?.id) {
            this.localModulesCache.delete(this.cargo.id);
            localStorage.removeItem(`localModules_${this.cargo.id}`);
        }
    }

    // Método para limpar módulos locais que já foram sincronizados com o servidor
    private clearSyncedLocalModules(serverModuleIds: number[]): void {
        if (this.cargo?.id) {
            const existingLocalModules =
                this.localModulesCache.get(this.cargo.id) || [];
            const unsyncedModules = existingLocalModules.filter(
                (module) => !serverModuleIds.includes(module.id),
            );

            // Se houve mudança (módulos foram removidos do cache local), atualizar
            if (unsyncedModules.length !== existingLocalModules.length) {
                const removedCount =
                    existingLocalModules.length - unsyncedModules.length;
                console.log(
                    `🧹 Removendo ${removedCount} módulos sincronizados do cache local`,
                );
                this.localModulesCache.set(this.cargo.id, unsyncedModules);
                this.saveLocalModulesToStorage();
            }
        }
    }

    // Método para limpar ferramentas locais que já foram sincronizadas com o servidor
    private clearSyncedLocalTools(serverToolIds: number[]): void {
        const existingLocalTools = this.locallyAddedTools || [];
        const unsyncedTools = existingLocalTools.filter(
            (tool) => !serverToolIds.includes(tool.id),
        );

        // Se houve mudança (ferramentas foram removidas do cache local), atualizar
        if (unsyncedTools.length !== existingLocalTools.length) {
            this.locallyAddedTools = unsyncedTools;
            this.saveLocallyAddedToolsToStorage();
        }
    }

    // Método para forçar refresh dos módulos (limpa cache local e recarrega do servidor)
    refreshModules(): void {
        if (this.cargo?.name) {
            // Limpar módulos locais
            this.clearLocalModules();

            // Recarregar do servidor
            this.moduleService
                .refreshModules(this.cargo.name, this.cargo.id)
                .subscribe({
                    next: (modules) => {
                        // Atualizar o estado global do ModuleService para sincronização em tempo real
                        this.moduleService.modulesSubject.next(modules || []);

                        // Manter estado local para compatibilidade
                        this.modules = modules || [];
                        this.modulesSubject.next(this.modules);
                    },
                    error: (error) => {
                        console.error('Erro ao atualizar módulos:', error);
                    },
                });
        }
    }

    onUserSearchTermChange(term: string): void {
        this.userSearchTerm = term;
        // Se há mais usuários do que uma página, buscar na API
        if (this.users.length > this.usersPerPage && term.trim()) {
            if (this.userSearchSub) this.userSearchSub.unsubscribe();
            this.userSearchSub = this.usersService
                .searchUsersByName(term.trim())
                .subscribe({
                    next: (users) => {
                        this.filteredUsers = users;
                    },
                    error: () => {
                        this.filteredUsers = [];
                    },
                });
        } else {
            this.applyUserFilter();
        }
    }

    applyUserFilter(): void {
        // Só filtra localmente se a quantidade de usuários for igual ao tamanho da página (ou seja, todos carregados)
        if (this.users.length > 0 && this.users.length <= this.usersPerPage) {
            const term = this.userSearchTerm.trim().toLowerCase();
            if (!term) {
                this.filteredUsers = [...this.users];
            } else {
                this.filteredUsers = this.users.filter(
                    (user) =>
                        user.name.toLowerCase().includes(term) ||
                        user.email.toLowerCase().includes(term),
                );
            }
        } else {
            // Se não for para filtrar localmente, mostra todos os usuários carregados (ou pode implementar busca na API)
            this.filteredUsers = [...this.users];
        }
    }

    onToolSearchTermChange(term: string): void {
        this.toolSearchTerm = term;
        this.applyToolFilter();
    }

    applyToolFilter(): void {
        const term = this.toolSearchTerm.trim().toLowerCase();
        if (!term) {
            this.filteredTools = [...this.tools];
        } else {
            this.filteredTools = this.tools.filter((tool) =>
                tool.name.toLowerCase().includes(term),
            );
        }
    }

    // --- Engajamento SVG ---
    get averageEngagementLevel(): number {
        const users =
            this.filteredUsers && this.filteredUsers.length
                ? this.filteredUsers
                : this.users;
        const engagement = this.getAverageEngagement(users);
        switch (engagement) {
            case 'Nenhum':
                return 0;
            case 'Baixo':
                return 1;
            case 'Médio':
                return 2;
            case 'Alto':
                return 3;
            case 'Altíssimo':
                return 4;
            default:
                return 0;
        }
    }

    get confirmModalTitle(): string {
        switch (this.confirmModalTarget?.action) {
            case 'deleteModule': return 'Excluir módulo';
            case 'deleteModuleFromRole': return 'Remover módulo do curso';
            case 'deleteLesson': return 'Excluir aula';
            case 'deleteLessonFromModule': return 'Remover aula do módulo';
            case 'deleteUser': return 'Excluir usuário';
            case 'deleteUserFromRole': return 'Remover usuário do curso';
            case 'deleteTool': return 'Excluir ferramenta';
            case 'deleteToolFromRole': return 'Remover ferramenta do curso';
            default: return 'Confirmar';
        }
    }

    get confirmModalMessage(): string {
        const target = this.confirmModalTarget;
        if (!target) return '';
        const moduleName = target.module?.name || '';
        const lessonName = target.lesson?.name || '';
        const userName = target.user?.name || target.user?.email || '';
        const toolName = target.tool?.name || '';
        switch (target.action) {
            case 'deleteModule':
                return `Tem certeza que deseja excluir permanentemente o módulo "${moduleName}"? Todas as aulas deste módulo também serão excluídas.`;
            case 'deleteModuleFromRole':
                return `Tem certeza que deseja remover o módulo "${moduleName}" deste curso? O módulo continuará disponível em outros cursos.`;
            case 'deleteLesson':
                return `Tem certeza que deseja excluir permanentemente a aula "${lessonName}"?`;
            case 'deleteLessonFromModule':
                return `Tem certeza que deseja remover a aula "${lessonName}" deste módulo? A aula continuará disponível em outros módulos.`;
            case 'deleteUser':
                return `Tem certeza que deseja excluir permanentemente o usuário "${userName}"?`;
            case 'deleteUserFromRole':
                return `Tem certeza que deseja remover o usuário "${userName}" deste curso? O usuário continuará disponível em outros cursos.`;
            case 'deleteTool':
                return `Tem certeza que deseja excluir permanentemente a ferramenta "${toolName}"?`;
            case 'deleteToolFromRole':
                return `Tem certeza que deseja remover a ferramenta "${toolName}" deste curso? A ferramenta continuará disponível em outros cursos.`;
            default:
                return 'Tem certeza que deseja realizar esta ação?';
        }
    }

    get confirmModalIcon(): 'warning' | 'delete' | 'info' {
        switch (this.confirmModalTarget?.action) {
            case 'deleteModule':
            case 'deleteLesson':
            case 'deleteUser':
            case 'deleteTool':
                return 'delete';
            case 'deleteModuleFromRole':
            case 'deleteLessonFromModule':
            case 'deleteUserFromRole':
            case 'deleteToolFromRole':
                return 'warning';
            default:
                return 'warning';
        }
    }

    get confirmModalConfirmLabel(): string {
        switch (this.confirmModalTarget?.action) {
            case 'deleteModule':
            case 'deleteLesson':
            case 'deleteUser':
            case 'deleteTool':
                return 'Excluir';
            case 'deleteModuleFromRole':
            case 'deleteLessonFromModule':
            case 'deleteUserFromRole':
            case 'deleteToolFromRole':
                return 'Remover';
            default:
                return 'Confirmar';
        }
    }
}
