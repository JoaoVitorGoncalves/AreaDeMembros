import { Component, OnInit, OnDestroy, ChangeDetectionStrategy, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Observable, Subject, of } from 'rxjs';
import { takeUntil, catchError, map } from 'rxjs/operators';
import { HeaderComponent } from '../../layouts/header/header.component';
import { SidebarComponent } from '../../layouts/sidebar/sidebar.component';
import { CollaboratorsService, Collaborator, CollaboratorsResult } from '../../services/collaborators.service';
import { AuthService } from '../../services/auth.service';
import { AddCollaboratorComponent } from '../../components/add-collaborator/add-collaborator.component';

@Component({
    selector: 'app-collaborators',
    standalone: true,
    imports: [CommonModule, HeaderComponent, SidebarComponent, AddCollaboratorComponent],
    templateUrl: './collaborators.component.html',
    styleUrls: ['./collaborators.component.scss'],
    changeDetection: ChangeDetectionStrategy.OnPush
})
export class CollaboratorsComponent implements OnInit, OnDestroy {
    private destroy$ = new Subject<void>();

    collaborators: Collaborator[] = [];
    loading$: Observable<boolean>;
    error: string | null = null;
    isAdmin: boolean = false;
    showAddSidebar = false;
    collaboratorsSubscription: any;

    constructor(
        private collaboratorsService: CollaboratorsService,
        private authService: AuthService,
        private cdr: ChangeDetectorRef
    ) {
        this.loading$ = this.collaboratorsService.loading$;
    }

    ngOnInit(): void {
        this.isAdmin = this.authService.isAdmin();
        // Inscreve-se no observable de colaboradores (sem disparar request duplicada)
        this.collaboratorsSubscription = this.collaboratorsService.collaborators$.subscribe(result => {
            this.collaborators = result.collaborators;
            this.error = null;
            this.cdr.markForCheck();
        });
        // Dispara busca apenas se não houver dados em cache
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
                    return of({ collaborators: [], totalCollaborators: 0 });
                })
            )
            .subscribe(); // Não precisa atualizar a lista aqui, pois já está inscrito no observable
    }

    trackByCollaborator(index: number, collaborator: Collaborator): number {
        return collaborator.id;
    }

    retryLoad(): void {
        this.error = null;
        this.loadCollaborators();
    }

    openAddSidebar() {
        this.showAddSidebar = true;
    }

    closeAddSidebar() {
        this.showAddSidebar = false;
    }

    onCollaboratorCreated(newCollaborator: Collaborator) {
        this.showAddSidebar = false;
        // A lista será atualizada reativamente pela inscrição no serviço
    }

    refreshCollaborators() {
        this.collaboratorsService.refreshCollaborators();
    }
} 