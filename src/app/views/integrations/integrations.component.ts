import { CommonModule } from '@angular/common';
import { Component, ChangeDetectionStrategy } from '@angular/core';
import { HeaderComponent } from '../../layouts/header/header.component';
import { SidebarComponent } from '../../layouts/sidebar/sidebar.component';

@Component({
    selector: 'app-integrations',
    standalone: true,
    imports: [CommonModule, HeaderComponent, SidebarComponent],
    templateUrl: './integrations.component.html',
    styleUrls: ['./integrations.component.scss'],
    changeDetection: ChangeDetectionStrategy.OnPush
})
export class IntegrationsComponent { } 