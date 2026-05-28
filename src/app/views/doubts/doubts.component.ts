import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { HeaderComponent } from '../../layouts/header/header.component';
import { SidebarComponent } from '../../layouts/sidebar/sidebar.component';

@Component({
    selector: 'app-doubts',
    standalone: true,
    imports: [CommonModule, HeaderComponent, SidebarComponent],
    templateUrl: './doubts.component.html',
    styleUrls: ['./doubts.component.scss']
})
export class DoubtsComponent {

} 