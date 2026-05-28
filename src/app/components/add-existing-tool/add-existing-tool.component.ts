import { Component, EventEmitter, Input, Output, OnInit, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { AuthService } from '../../services/auth.service';
import { environment } from '../../../environments/environment';
import { ToolsService } from '../../services/tools.service';
import { Tool } from '../../models/tool.model';

@Component({
    selector: 'app-add-existing-tool',
    standalone: true,
    imports: [CommonModule, FormsModule],
    templateUrl: './add-existing-tool.component.html',
    styleUrls: ['./add-existing-tool.component.scss']
})
export class AddExistingToolComponent implements OnInit {
    @Output() close = new EventEmitter<void>();
    @Output() add = new EventEmitter<Tool[]>();

    @Input() moduleToolIds: number[] = [];
    searchTerm = '';
    selectedIds = new Set<number>();
    tools: Tool[] = [];
    loading = false;
    error: string | null = null;
    @Input() roleId!: number;

    constructor(
        private http: HttpClient,
        private authService: AuthService,
        private cdr: ChangeDetectorRef,
        private toolsService: ToolsService
    ) { }

    ngOnInit(): void {
        this.loadTools();
    }

    loadTools(): void {
        this.tools = [];
        this.loading = true;
        this.error = null;
        if (!this.authService.isAdmin()) {
            this.error = 'Apenas administradores podem adicionar ferramentas.';
            this.loading = false;
            return;
        }
        const token = this.authService.getToken();
        if (!token) {
            this.error = 'Token de autenticação não encontrado. Faça login novamente.';
            this.loading = false;
            return;
        }
        this.toolsService.getAllToolsForAdminByRoleId(this.roleId).subscribe({
            next: (result) => {
                this.tools = result.tools.filter(t => !this.moduleToolIds.includes(t.id));
                this.loading = false;
                this.cdr.detectChanges();
            },
            error: (err) => {
                this.error = err.error?.message || 'Erro ao buscar ferramentas.';
                this.loading = false;
                this.cdr.detectChanges();
            }
        });
    }

    get filteredTools(): Tool[] {
        if (!this.searchTerm) return this.tools;
        return this.tools.filter(t =>
            t.name.toLowerCase().includes(this.searchTerm.toLowerCase()) ||
            t.description.toLowerCase().includes(this.searchTerm.toLowerCase())
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
            this.filteredTools.forEach(t => this.selectedIds.add(t.id));
        }
    }

    get allSelected(): boolean {
        return this.filteredTools.length > 0 && this.filteredTools.every(t => this.selectedIds.has(t.id));
    }

    onAdd(): void {
        if (!this.authService.isAdmin()) {
            this.error = 'Apenas administradores podem adicionar ferramentas.';
            return;
        }
        const token = this.authService.getToken();
        if (!token) {
            this.error = 'Token de autenticação não encontrado. Faça login novamente.';
            return;
        }
        const toolIds = Array.from(this.selectedIds);
        if (toolIds.length === 0) {
            this.error = 'Selecione pelo menos uma ferramenta.';
            return;
        }
        this.error = null;
        this.toolsService.assignToolsToRoles(toolIds, this.roleId, token).subscribe({
            next: (response) => {
                const addedTools = this.tools.filter(t => this.selectedIds.has(t.id));
                this.toolsService.addToolsToCache(addedTools); // Atualiza o cache global
                this.add.emit(addedTools);
                this.selectedIds.clear();
                this.cdr.detectChanges();
            },
            error: (err) => {
                this.error = err.error?.message || 'Erro ao adicionar ferramentas.';
                this.cdr.detectChanges();
            }
        });
    }

    onClose(): void {
        this.close.emit();
    }
} 