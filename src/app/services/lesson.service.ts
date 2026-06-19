import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable, of, throwError } from 'rxjs';
import { HttpClient } from '@angular/common/http';
import { Module, Lesson, ModuleService } from './module.service';
import { AuthService } from './auth.service';
import { environment } from '../../environments/environment';
import { tap, catchError, map } from 'rxjs/operators';

// Interface para o payload do progresso
interface ProgressPayload {
    lesson_id: number;
    module_id: number;
    total_time: number;
    time: number;
    progress_percentage: number;
    progress: number;
    user_id?: number;
}

@Injectable({
    providedIn: 'root'
})
export class LessonService {
    private readonly API_URL = `${environment.apiUrl}/api/v1`;
    private modulesSubject = new BehaviorSubject<Module[]>([]);
    private loadingSubject = new BehaviorSubject<boolean>(false);

    // Subject para notificar sobre exclusão global de aulas
    private lessonDeletedSubject = new BehaviorSubject<{ lessonId: number, moduleId?: number } | null>(null);

    public modules$ = this.modulesSubject.asObservable();
    public loading$ = this.loadingSubject.asObservable();
    public lessonDeleted$ = this.lessonDeletedSubject.asObservable();

    constructor(
        private http: HttpClient,
        public authService: AuthService,
        private moduleService: ModuleService
    ) {
        // Restaurar módulos do localStorage se o BehaviorSubject estiver vazio
        if (this.modulesSubject.value.length === 0) {
            const persisted = localStorage.getItem('persisted_modules');
            if (persisted) {
                try {
                    const modules = JSON.parse(persisted);
                    this.modulesSubject.next(modules);
                } catch (e) {
                    // ignore
                }
            }
        }
    }

    // Método para definir módulos vindos do ModuleService
    setModules(modules: Module[]): void {
        this.modulesSubject.next(modules);
    }

    getModuleById(moduleId: number): Observable<Module | undefined> {
        return new Observable(observer => {
            const modules = this.modulesSubject.value;

            const module = modules.find(m => m.id === moduleId);

            observer.next(module);
            observer.complete();
        });
    }

    fetchFreshModuleFromApi(moduleId: number): Observable<Module | null> {
        return this.http.get<{ success: boolean; data: { module: Module } }>(
            `${this.API_URL}/modules/${moduleId}`
        ).pipe(
            tap(response => {
                if (response.success && response.data?.module) {
                    const freshModule = response.data.module;
                    const modules = this.modulesSubject.value;
                    const index = modules.findIndex(m => m.id === moduleId);
                    if (index >= 0) {
                        modules[index] = freshModule;
                        this.modulesSubject.next([...modules]);
                    }
                }
            }),
            map(response => response.success ? response.data.module : null),
            catchError(() => {
                const modules = this.modulesSubject.value;
                return of(modules.find(m => m.id === moduleId) || null);
            })
        );
    }

    getLessonById(moduleId: number, lessonId: number): Observable<Lesson | undefined> {
        return new Observable(observer => {
            const modules = this.modulesSubject.value;
            const module = modules.find(m => m.id === moduleId);
            const lesson = module?.lessons?.find(l => l.id === lessonId);
            observer.next(lesson);
            observer.complete();
        });
    }

    // Método para salvar progresso no localStorage e enviar para o backend
    saveVideoProgress(moduleId: number, lessonId: number, currentTime: number, totalTime: number): void {
        const key = `lesson_progress_${moduleId}_${lessonId}`;
        const progress = {
            currentTime: currentTime,
            totalTime: totalTime,
            progress: totalTime > 0 ? Math.round((currentTime / totalTime) * 100) : 0,
            lastUpdated: new Date().toISOString()
        };
        localStorage.setItem(key, JSON.stringify(progress));

        // Enviar progresso para o backend
        this.sendProgressToBackend(moduleId, lessonId, currentTime, totalTime, progress.progress);
    }

    // Método para enviar progresso para o backend
    private sendProgressToBackend(moduleId: number, lessonId: number, currentTime: number, totalTime: number, progressPercentage: number): void {
        const user = this.authService.getUser();

        if (!user) {
            console.warn('Usuário não autenticado, progresso salvo apenas localmente');
            return;
        }

        const payload: ProgressPayload = {
            lesson_id: lessonId,
            module_id: moduleId,
            total_time: Math.round(totalTime),
            time: Math.round(currentTime),
            progress_percentage: progressPercentage,
            progress: progressPercentage,
            user_id: user.id
        };

        this.http.post(`${this.API_URL}/progress/lesson`, payload)
            .subscribe({
                error: (error) => {
                    console.error('Erro ao enviar progresso para o backend:', error);
                }
            });
    }

    // Método para obter progresso salvo do localStorage
    getVideoProgress(moduleId: number, lessonId: number): { currentTime: number; totalTime: number; progress: number; lastUpdated: string } | null {
        const key = `lesson_progress_${moduleId}_${lessonId}`;
        const saved = localStorage.getItem(key);
        if (saved) {
            try {
                const progress = JSON.parse(saved);
                return progress;
            } catch (e) {
                return null;
            }
        }
        return null;
    }

    // Método para atualizar progresso (pode ser implementado quando necessário)
    updateLessonProgress(moduleId: number, lessonId: number, progress: number): void {
        // Aqui você pode implementar a lógica para salvar o progresso no backend
        console.log(`Progresso da aula ${lessonId} do módulo ${moduleId}: ${progress}%`);
    }

    completeLesson(moduleId: number, lessonId: number): void {
        this.updateLessonProgress(moduleId, lessonId, 100);

        // Salvar como concluída no localStorage
        const key = `lesson_completed_${moduleId}_${lessonId}`;
        localStorage.setItem(key, 'true');

        // Enviar conclusão para o backend
        this.sendProgressToBackend(moduleId, lessonId, 0, 0, 100);
    }

    // Verificar se a aula foi concluída
    isLessonCompleted(moduleId: number, lessonId: number): boolean {
        const key = `lesson_completed_${moduleId}_${lessonId}`;
        return localStorage.getItem(key) === 'true';
    }

    // Método para obter duração estimada do vídeo (baseado no nome ou pode ser calculado)
    getEstimatedDuration(lesson: Lesson): string {
        // Por enquanto, retorna uma duração estimada
        // Você pode implementar lógica para calcular baseado no tamanho do arquivo ou metadata
        return '15:30'; // Duração padrão
    }

    // Método para obter progresso da aula (pode vir do backend)
    getLessonProgress(lessonId: number): number {
        // Por enquanto, retorna 0. Você pode implementar lógica para buscar do backend
        return 0;
    }

    // Método para obter progresso da aula com moduleId
    getLessonProgressWithModule(moduleId: number, lessonId: number): number {
        const savedProgress = this.getVideoProgress(moduleId, lessonId);
        if (savedProgress) {
            return savedProgress.progress;
        }
        return 0;
    }

    // Método para limpar progresso de uma aula específica
    clearLessonProgress(moduleId: number, lessonId: number): void {
        const progressKey = `lesson_progress_${moduleId}_${lessonId}`;
        const completedKey = `lesson_completed_${moduleId}_${lessonId}`;
        localStorage.removeItem(progressKey);
        localStorage.removeItem(completedKey);
    }

    // Método para limpar todos os progressos (útil para testes)
    clearAllProgress(): void {
        const keysToRemove: string[] = [];

        // Encontrar todas as chaves relacionadas ao progresso
        for (let i = 0; i < localStorage.length; i++) {
            const key = localStorage.key(i);
            if (key && (key.startsWith('lesson_progress_') || key.startsWith('lesson_completed_'))) {
                keysToRemove.push(key);
            }
        }

        // Remover as chaves
        keysToRemove.forEach(key => localStorage.removeItem(key));
    }

    // Método para forçar recarregar módulos do localStorage
    restoreModulesFromLocalStorage(): void {
        const persisted = localStorage.getItem('persisted_modules');
        if (persisted) {
            try {
                const modules = JSON.parse(persisted);
                this.modulesSubject.next(modules);
            } catch (e) {
                // ignore
            }
        }
    }

    // Buscar progresso de várias lessons do backend
    fetchLessonsProgressFromBackend(userId: number, lessonIds: number[]): Observable<any> {
        const token = this.authService.getToken();
        if (!token) {
            return new Observable(observer => {
                observer.error('Usuário não autenticado');
                observer.complete();
            });
        }
        const url = `${this.API_URL}/progress/lesson/progress`;
        const body = {
            user: userId,
            lesson_ids: lessonIds
        };
        const headers = {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
        };
        return this.http.post(url, body, { headers });
    }

    // Enviar progresso do módulo para o backend
    sendModuleProgressToBackend(userId: number, moduleId: number, progress: number, time: number): void {
        const token = this.authService.getToken();
        if (!token) return;
        const url = `${this.API_URL}/progress/module`;
        const body = {
            user_id: Number(userId), // garantir nome e tipo correto
            module_id: Number(moduleId),
            progress: Math.max(0, Math.min(100, Math.round(progress))),
            time: Math.max(0, Math.round(time))
        };
        const headers = {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
        };
        this.http.post(url, body, { headers }).subscribe({
            error: (error) => {
                console.error('Erro ao enviar progresso do módulo para o backend:', error, body);
            }
        });
    }

    /**
     * Deleta uma aula específica
     */
    deleteLesson(lessonId: number, token: string): Observable<any> {
        const url = `${this.API_URL}/lessons/${lessonId}`;
        const headers = { 'Authorization': `Bearer ${token}` };

        return this.http.delete<any>(url, { headers }).pipe(
            tap(() => {
                // Atualizar cache de forma eficiente sem fazer requisições desnecessárias
                this.updateCacheAfterLessonDeletion(lessonId);
                this.lessonDeletedSubject.next({ lessonId: lessonId });
            }),
            catchError(error => {
                console.error('Erro ao deletar aula:', error);
                return throwError(() => error);
            })
        );
    }

    /**
     * Remove uma aula de um módulo específico
     */
    deleteLessonFromModule(lessonId: number, moduleId: number, token: string): Observable<any> {
        const url = `${this.API_URL}/lessons/${lessonId}/module/${moduleId}`;
        const headers = { 'Authorization': `Bearer ${token}` };

        return this.http.delete<any>(url, { headers }).pipe(
            tap(() => {
                // Atualizar cache de forma eficiente sem fazer requisições desnecessárias
                this.updateCacheAfterLessonDeletionFromModule(lessonId, moduleId);
                this.lessonDeletedSubject.next({ lessonId: lessonId, moduleId: moduleId });
            }),
            catchError(error => {
                console.error('Erro ao remover aula do módulo:', error);
                return throwError(() => error);
            })
        );
    }

    /**
     * Atualiza o cache de forma eficiente após exclusão de uma aula
     * Remove a aula de todos os módulos em cache sem fazer requisições desnecessárias
     */
    private updateCacheAfterLessonDeletion(lessonId: number): void {
        // Usar o método eficiente do ModuleService para remover a aula de todos os módulos
        this.moduleService.removeLessonFromAllCachedModules(lessonId);

        // Atualizar também o cache local do LessonService
        const currentModules = this.modulesSubject.value;
        if (currentModules.length > 0) {
            const updatedModules = currentModules.map(module => {
                if (module.lessons) {
                    module.lessons = module.lessons.filter(lesson => lesson.id !== lessonId);
                    module.contentCount = module.lessons.length;
                }
                return module;
            });
            this.modulesSubject.next(updatedModules);
        }

        // Atualizar localStorage
        localStorage.setItem('persisted_modules', JSON.stringify(this.modulesSubject.value));
    }

    /**
     * Atualiza o cache de forma eficiente após remoção de uma aula de um módulo específico
     */
    private updateCacheAfterLessonDeletionFromModule(lessonId: number, moduleId: number): void {
        // Usar o método eficiente do ModuleService para remover a aula do módulo específico
        this.moduleService.removeLessonFromCachedModule(lessonId, moduleId);

        // Atualizar também o cache local do LessonService
        const currentModules = this.modulesSubject.value;
        if (currentModules.length > 0) {
            const updatedModules = currentModules.map(module => {
                if (module.id === moduleId && module.lessons) {
                    module.lessons = module.lessons.filter(lesson => lesson.id !== lessonId);
                    module.contentCount = module.lessons.length;
                }
                return module;
            });
            this.modulesSubject.next(updatedModules);
        }

        // Atualizar localStorage
        localStorage.setItem('persisted_modules', JSON.stringify(this.modulesSubject.value));
    }

    /**
     * Limpa o cache dos módulos (método mantido para compatibilidade)
     */
    private clearCache(): void {
        // Limpar cache do localStorage
        localStorage.removeItem('persisted_modules');

        // Limpar cache do ModuleService para forçar recarregamento global
        this.moduleService.clearCache();

        // Recarregar módulos do backend se necessário
        this.restoreModulesFromLocalStorage();
    }

    /**
     * Limpa o evento de exclusão de aula
     */
    clearLessonDeletedEvent(): void {
        this.lessonDeletedSubject.next(null);
    }
} 