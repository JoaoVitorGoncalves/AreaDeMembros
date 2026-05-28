import { Component, ChangeDetectionStrategy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { HeaderComponent } from '../../layouts/header/header.component';
import { SidebarComponent } from '../../layouts/sidebar/sidebar.component';

@Component({
    selector: 'app-settings',
    standalone: true,
    imports: [CommonModule, HeaderComponent, SidebarComponent],
    templateUrl: './settings.component.html',
    styleUrls: ['./settings.component.scss'],
    changeDetection: ChangeDetectionStrategy.OnPush
})
export class SettingsComponent {
    tabs = ['Perfil', 'Endereço', 'Assinatura', '2FA', 'Alterar senha'];
    activeTab = 0;

    setActiveTab(index: number) {
        this.activeTab = index;
    }
} 