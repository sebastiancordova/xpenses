import { Injectable, inject } from '@angular/core';
import { CanLoad, CanMatchFn, Route, UrlSegment, UrlTree } from '@angular/router';
import { AuthService } from '@core/services/auth.service';
import { UserService } from '@core/services/user.service';
import { ToastrService } from 'ngx-toastr';
import { Observable, firstValueFrom, of } from 'rxjs';
import { switchMap, take } from 'rxjs/operators';
import { User } from '@angular/fire/auth';

@Injectable({
  providedIn: 'root'
})
export class IsActiveGuard  {
  //private toastr: ToastrService = inject(ToastrService);
  private authService: AuthService = inject(AuthService);
  constructor() { }

  CanMatch(route: Route, segments: UrlSegment[]): Observable<boolean | UrlTree> | Promise<boolean> {
    return firstValueFrom(this.authService.isAuthenticated())
      .then((user: User | null) => {
        if (user && user.emailVerified) {
          return true;
        } else {
          this.authService.logout();
          //this.toastr.info('Usuario no activado');
          return false;
        }
      });

  }
}
