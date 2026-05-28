import { Component, EventEmitter, Input, Output, OnInit, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { AuthService } from '../../services/auth.service';
import { environment } from '../../../environments/environment';
import { ModuleService, Module } from '../../services/module.service';

@Component({
    selector: 'app-add-existing-module',
    standalone: true,
    imports: [CommonModule, FormsModule],
    templateUrl: './add-existing-module.component.html',
    styleUrls: ['./add-existing-module.component.scss']
})
export class AddExistingModuleComponent implements OnInit {
    @Output() close = new EventEmitter<void>();
    @Output() add = new EventEmitter<Module[]>();

    @Input() moduleIds: number[] = [];
    searchTerm = '';
    selectedIds = new Set<number>();
    modules: Module[] = [];
    loading = false;
    error: string | null = null;
    @Input() roleId!: number;

    constructor(
        private http: HttpClient,
        private authService: AuthService,
        private cdr: ChangeDetectorRef,
        private moduleService: ModuleService
    ) { }

    ngOnInit(): void {
        this.loadModules();
    }

    loadModules(): void {
        this.modules = [];
        this.loading = true;
        this.error = null;
        if (!this.authService.isAdmin()) {
            this.error = 'Apenas administradores podem adicionar módulos.';
            this.loading = false;
            return;
        }
        const token = this.authService.getToken();
        if (!token) {
            this.error = 'Token de autenticação não encontrado. Faça login novamente.';
            this.loading = false;
            return;
        }

        // Buscar módulos disponíveis para o cargo
        this.moduleService.getAllModulesForAdminByRoleId(this.roleId).subscribe({
            next: (result: { modules: Module[]; totalModules: number }) => {
                this.modules = result.modules.filter(m => !this.moduleIds.includes(m.id));
                this.loading = false;
                this.cdr.detectChanges();
            },
            error: (err: any) => {
                this.error = err.error?.message || 'Erro ao buscar módulos.';
                this.loading = false;
                this.cdr.detectChanges();
            }
        });
    }

    get filteredModules(): Module[] {
        if (!this.searchTerm) return this.modules;
        return this.modules.filter(m =>
            m.name.toLowerCase().includes(this.searchTerm.toLowerCase())
        );
    }

    isSelected(id: number): boolean {
        return this.selectedIds.has(id);
    }

    toggleSelect(id: number): void {
        if (this.selectedIds.has(id)) {
            this.selectedIds.delete(id);
        } else {
            this.selectedIds.add(id);
        }
    }

    selectAll(): void {
        if (this.allSelected) {
            this.selectedIds.clear();
        } else {
            this.filteredModules.forEach(m => this.selectedIds.add(m.id));
        }
    }

    get allSelected(): boolean {
        return this.filteredModules.length > 0 && this.filteredModules.every(m => this.selectedIds.has(m.id));
    }

    onAdd(): void {
        if (!this.authService.isAdmin()) {
            this.error = 'Apenas administradores podem adicionar módulos.';
            return;
        }
        const token = this.authService.getToken();
        if (!token) {
            this.error = 'Token de autenticação não encontrado. Faça login novamente.';
            return;
        }
        const moduleIds = Array.from(this.selectedIds);
        if (moduleIds.length === 0) {
            this.error = 'Selecione pelo menos um módulo.';
            return;
        }
        this.error = null;

        this.moduleService.assignModulesToRoles(moduleIds, this.roleId, token).subscribe({
            next: (response) => {
                this.add.emit(this.modules.filter(m => this.selectedIds.has(m.id)));
                this.selectedIds.clear();
                this.cdr.detectChanges();
            },
            error: (err) => {
                this.error = err.error?.message || 'Erro ao adicionar módulos.';
                this.cdr.detectChanges();
            }
        });
    }

    onClose(): void {
        this.close.emit();
    }
} 