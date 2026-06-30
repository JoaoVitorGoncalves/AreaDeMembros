import { Component, OnInit, OnDestroy, ChangeDetectionStrategy, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Observable, Subject, of } from 'rxjs';
import { takeUntil, catchError } from 'rxjs/operators';
import { FormsModule } from '@angular/forms';
import { HeaderComponent } from '../../layouts/header/header.component';
import { SidebarComponent } from '../../layouts/sidebar/sidebar.component';
import { CollaboratorsService, Collaborator } from '../../services/collaborators.service';
import { AdminService } from '../../services/admin.service';
import { AddCollaboratorComponent } from '../../components/add-collaborator/add-collaborator.component';
import { ConfirmModalComponent } from '../../components/confirm-modal/confirm-modal.component';

@Component({
    selector: 'app-collaborators',
    standalone: true,
    imports: [CommonModule, FormsModule, HeaderComponent, SidebarComponent, AddCollaboratorComponent, ConfirmModalComponent],
    templateUrl: './collaborators.component.html',
    styleUrls: ['./collaborators.component.scss'],
    changeDetection: ChangeDetectionStrategy.OnPush
})
export class CollaboratorsComponent implements OnInit, OnDestroy {
    private destroy$ = new Subject<void>();

    collaborators: Collaborator[] = [];
    filteredCollaborators: Collaborator[] = [];
    loading$: Observable<boolean>;
    error: string | null = null;
    isAdmin: boolean = false;
    showAddSidebar = false;
    collaboratorsSubscription: any;

    searchTerm: string = '';
    filterType: string = '';

    openDropdownId: number | null = null;
    showDeleteModal = false;
    deleteMessage = '';
    private collaboratorToDelete: Collaborator | null = null;

    constructor(
        private collaboratorsService: CollaboratorsService,
        private adminService: AdminService,
        private cdr: ChangeDetectorRef
    ) {
        this.loading$ = this.collaboratorsService.loading$;
    }

    ngOnInit(): void {
        this.isAdmin = this.adminService.isAuthenticated() && !this.adminService.isCollaborator();
        this.collaboratorsSubscription = this.collaboratorsService.collaborators$.subscribe(result => {
            this.collaborators = result.collaborators;
            this.applyFilters();
            this.error = null;
            this.cdr.markForCheck();
        });
        if (!this.collaboratorsService['collaboratorsSubject'].getValue()) {
            this.loadCollaborators();
        }
    }

    ngOnDestroy(): void {
        this.destroy$.next();
        this.destroy$.complete();
        if (this.collaboratorsSubscription) {
            this.collaboratorsSubscription.unsubscribe();
        }
    }

    private loadCollaborators(): void {
        this.collaboratorsService.getCollaborators()
            .pipe(
                takeUntil(this.destroy$),
                catchError(error => {
                    this.error = error.message || 'Erro ao carregar colaboradores';
                    this.cdr.markForCheck();
                    return of({ collaborators: [], totalCollaborators: 0, current_page: 1, total_pages: 1 });
                })
            )
            .subscribe();
    }

    toggleActionsDropdown(id: number): void {
        this.openDropdownId = this.openDropdownId === id ? null : id;
        this.cdr.markForCheck();
    }

    applyFilters(): void {
        let list = [...this.collaborators];
        if (this.searchTerm) {
            const term = this.searchTerm.toLowerCase();
            list = list.filter(c => c.name.toLowerCase().includes(term) || c.email.toLowerCase().includes(term));
        }
        if (this.filterType) {
            list = list.filter(c => c.type === this.filterType);
        }
        this.filteredCollaborators = list;
        this.cdr.markForCheck();
    }

    trackByCollaborator(index: number, collaborator: Collaborator): number {
        return collaborator.id;
    }

    retryLoad(): void {
        this.error = null;
        this.loadCollaborators();
    }

    openAddSidebar(): void {
        this.showAddSidebar = true;
    }

    closeAddSidebar(): void {
        this.showAddSidebar = false;
    }

    onCollaboratorCreated(newCollaborator: Collaborator): void {
        this.showAddSidebar = false;
    }

    refreshCollaborators(): void {
        this.collaboratorsService.refreshCollaborators();
    }

    copyInviteUrl(collaborator: Collaborator): void {
        this.openDropdownId = null;
        this.collaboratorsService.updateCollaborator(collaborator.id, { regenerate_invite: true }).subscribe({
            next: (result) => {
                if (result.invite_url) {
                    navigator.clipboard.writeText(result.invite_url);
                    this.refreshCollaborators();
                }
            }
        });
    }

    confirmDelete(collaborator: Collaborator): void {
        this.openDropdownId = null;
        this.collaboratorToDelete = collaborator;
        this.deleteMessage = `Tem certeza que deseja excluir "${collaborator.name}"?`;
        this.showDeleteModal = true;
        this.cdr.markForCheck();
    }

    onDeleteConfirm(): void {
        if (!this.collaboratorToDelete) return;
        this.showDeleteModal = false;
        this.collaboratorsService.deleteCollaborator(this.collaboratorToDelete.id).subscribe({
            next: () => {
                this.collaboratorToDelete = null;
                this.refreshCollaborators();
            },
            error: (err) => {
                this.error = err.message;
                this.collaboratorToDelete = null;
                this.cdr.markForCheck();
            }
        });
    }

    onDeleteCancel(): void {
        this.showDeleteModal = false;
        this.collaboratorToDelete = null;
    }
}
