import { User } from 'firebase/auth';
import { Injectable, inject } from '@angular/core';
import { Route, UrlSegment, ActivatedRouteSnapshot, RouterStateSnapshot, UrlTree, Router } from '@angular/router';
import { Observable, firstValueFrom, of } from 'rxjs';
import { take, switchMap, tap } from 'rxjs/operators';
import { AuthService } from '@core/services/auth.service';


@Injectable({
  providedIn: 'root'
})
export class AuthGuard {
  private authService: AuthService = inject(AuthService);
  private router: Router = inject(Router);
  CanMatch(route: Route, segments: UrlSegment[]) {
    return this.authService.isAuthenticated();
  }
}
