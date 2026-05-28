import { Routes } from '@angular/router';
import { AuthGuard } from './guards/auth.guard';
import { AdminGuard } from './guards/admin.guard';

export const routes: Routes = [
    {
        path: 'login',
        loadComponent: () => import('./views/login/login.component').then(c => c.LoginComponent)
    },
    {
        path: 'dashboard',
        loadComponent: () => import('./views/dashboard/dashboard.component').then(c => c.DashboardComponent),
        canActivate: [AuthGuard],
        data: { preload: 'immediate' }
    },
    {
        path: 'support',
        loadComponent: () => import('./views/doubts/doubts.component').then(c => c.DoubtsComponent),
        canActivate: [AuthGuard],
        data: { preload: 'delayed' }
    },
    {
        path: 'tools',
        loadComponent: () => import('./views/tools/tools.component').then(c => c.ToolsComponent),
        canActivate: [AuthGuard],
        data: { preload: 'delayed' }
    },
    {
        path: 'collaborators',
        loadComponent: () => import('./views/collaborators/collaborators.component').then(c => c.CollaboratorsComponent),
        canActivate: [AuthGuard, AdminGuard],
        data: { preload: 'delayed' }
    },
    {
        path: 'analytics',
        loadComponent: () => import('./views/analytics/analytics.component').then(c => c.AnalyticsComponent),
        canActivate: [AuthGuard, AdminGuard],
        data: { preload: 'delayed' }
    },
    {
        path: 'settings',
        loadComponent: () => import('./views/settings/settings.component').then(c => c.SettingsComponent),
        canActivate: [AuthGuard, AdminGuard],
        data: { preload: 'network-aware' }
    },
    {
        path: 'integrations',
        loadComponent: () => import('./views/integrations/integrations.component').then(c => c.IntegrationsComponent),
        canActivate: [AuthGuard, AdminGuard],
        data: { preload: 'delayed' }
    },
    {
        path: 'lesson/:moduleId/:lessonId',
        loadComponent: () => import('./views/lesson-viewer/lesson-viewer.component').then(c => c.LessonViewerComponent),
        canActivate: [AuthGuard],
        data: { preload: 'immediate' }
    },
    { path: '', redirectTo: '/dashboard', pathMatch: 'full' },
    { path: '**', redirectTo: '/login' }
];
