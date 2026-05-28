import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { HeaderComponent } from '../../layouts/header/header.component';
import { SidebarComponent } from '../../layouts/sidebar/sidebar.component';

@Component({
    selector: 'app-analytics',
    standalone: true,
    imports: [CommonModule, HeaderComponent, SidebarComponent],
    templateUrl: './analytics.component.html',
    styleUrls: ['./analytics.component.scss']
})
export class AnalyticsComponent implements OnInit {

    performanceData = {
        pageViews: 145672,
        uniqueVisitors: 89341,
        bounceRate: 23.4,
        avgSessionDuration: '3m 42s'
    };

    topPages = [
        { page: '/dashboard', views: 45123, percentage: 31 },
        { page: '/products', views: 32456, percentage: 22 },
        { page: '/about', views: 18765, percentage: 13 },
        { page: '/contact', views: 12345, percentage: 8 }
    ];

    constructor() { }

    ngOnInit(): void {
        console.log('📊 Analytics module loaded with delayed preloading');
    }
} 