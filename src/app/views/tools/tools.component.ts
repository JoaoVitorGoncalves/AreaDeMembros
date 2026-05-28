import { Component, OnInit, OnDestroy, ChangeDetectionStrategy, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Observable, Subject, of } from 'rxjs';
import { takeUntil, catchError } from 'rxjs/operators';
import { HeaderComponent } from '../../layouts/header/header.component';
import { SidebarComponent } from '../../layouts/sidebar/sidebar.component';
import { ToolsService } from '../../services/tools.service';
import { Tool } from '../../models/tool.model';
import { AuthService } from '../../services/auth.service';
import { AddToolComponent } from '../../components/add-tool/add-tool.component';

@Component({
    selector: 'app-tools',
    standalone: true,
    imports: [CommonModule, HeaderComponent, SidebarComponent, AddToolComponent],
    templateUrl: './tools.component.html',
    styleUrls: ['./tools.component.scss'],
    changeDetection: ChangeDetectionStrategy.OnPush
})
export class ToolsComponent implements OnInit, OnDestroy {
    private destroy$ = new Subject<void>();

    tools: Tool[] = [];
    loading$: Observable<boolean>;
    error: string | null = null;
    hasNoToolsForUser: boolean = false;
    isAdmin: boolean = false;
    isAddToolSidebarVisible = false;

    constructor(
        private toolsService: ToolsService,
        private cdr: ChangeDetectorRef,
        private authService: AuthService
    ) {
        this.loading$ = this.toolsService.loading$;
    }

    ngOnInit(): void {
        this.loadTools();
        this.isAdmin = this.authService.isAdmin();
    }

    ngOnDestroy(): void {
        this.destroy$.next();
        this.destroy$.complete();
    }

    private loadTools(): void {
        this.toolsService.getTools()
            .pipe(
                takeUntil(this.destroy$),
                catchError(error => {
                    this.error = error.message || 'Erro ao carregar ferramentas';
                    this.cdr.markForCheck();
                    return of({ tools: [], totalTools: 0, hasNoToolsForUser: false });
                })
            )
            .subscribe(result => {
                this.tools = result.tools;
                this.hasNoToolsForUser = result.hasNoToolsForUser;
                this.error = null;
                this.cdr.markForCheck();
            });
    }

    trackByTool(index: number, tool: Tool): string {
        return tool.uuid;
    }

    retryLoad(): void {
        this.error = null;
        this.loadTools();
    }

    refreshTools(): void {
        this.toolsService.refreshTools('');
    }

    // Sidebar methods
    openAddToolSidebar(): void {
        this.isAddToolSidebarVisible = true;
    }

    onToolCreated(newTool: Tool): void {
        this.isAddToolSidebarVisible = false;
        // A lista será atualizada reativamente pela inscrição no serviço.
    }

    onSidebarClose(): void {
        this.isAddToolSidebarVisible = false;
    }
} 