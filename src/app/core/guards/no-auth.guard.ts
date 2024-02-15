import { Injectable } from '@angular/core';
import { CanLoad, Route, UrlSegment, Router } from '@angular/router';
import { Observable, of } from 'rxjs';
import { take, switchMap, tap } from 'rxjs/operators';
import { AuthService } from '@core/services/auth.service';

@Injectable({
    providedIn: 'root'
})
export class NoAuthGuard implements CanLoad {
    constructor(private authService: AuthService, private router: Router) { }
    canLoad(
        route: Route,
        segments: UrlSegment[]): Observable<boolean> | Promise<boolean> | boolean {
        return this.authService.isAuthenticated().pipe(
            take(1),
            switchMap(userAuth => {
                if (userAuth) {
                    return of(false);
                } else {
                    return of(true);
                }
            }),
            tap(isNoAuth => {
                if (!isNoAuth) {
                    this.router.navigate(['/empresas']);
                }
            })
        );
    }
}
