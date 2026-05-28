import { Injectable } from '@angular/core';
import { PreloadingStrategy, Route } from '@angular/router';
import { Observable, of, timer } from 'rxjs';
import { mergeMap } from 'rxjs/operators';

@Injectable({
    providedIn: 'root'
})
export class CustomPreloadingStrategy implements PreloadingStrategy {

    preload(route: Route, load: () => Observable<any>): Observable<any> {
        // Check if route has preloading configuration
        if (route.data && route.data['preload']) {
            const preloadConfig = route.data['preload'];

            // Immediate preload for high priority routes
            if (preloadConfig === 'immediate') {
                return load();
            }

            // Delayed preload for medium priority routes
            if (preloadConfig === 'delayed') {
                return timer(3000).pipe(mergeMap(() => load()));
            }

            // Network-based preload (only on fast connections)
            if (preloadConfig === 'network-aware') {
                return this.shouldPreloadBasedOnNetwork() ? load() : of(null);
            }
        }

        // Default: no preload
        return of(null);
    }

    private shouldPreloadBasedOnNetwork(): boolean {
        // Check if navigator.connection exists (not available in all browsers)
        const connection = (navigator as any).connection;

        if (connection) {
            // Only preload on fast connections
            return connection.effectiveType === '4g' && !connection.saveData;
        }

        // Fallback: assume good connection
        return true;
    }
} 