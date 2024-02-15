import { Component, OnDestroy, OnInit, inject } from '@angular/core';
import { AuthService } from '@core/services/auth.service';
import { Router } from '@angular/router';
import { UserService } from '@core/services/user.service';
import { IUser } from '@core/models/user';

@Component({
  selector: 'app-sidebar',
  templateUrl: './sidebar.component.html',
  styleUrls: ['./sidebar.component.scss']
})
export class SidebarComponent implements OnInit, OnDestroy {
  private router: Router = inject(Router);
  private userService: UserService = inject(UserService);
  private authService: AuthService = inject(AuthService);
  public isActive = false;
  public currentUser!: IUser;

  ngOnInit(): void {
    this.userService.currentUser.subscribe(user => {
      this.currentUser = user;
    })
  }

  toggleActive() {
    this.isActive = !this.isActive;
  }

  goToRoute(route: string) {
    this.router.navigate([`/${route}`]);
  }

  logout() {
    this.authService.logout().then(() => {
      this.router.navigate(['/auth/login']);
    });
  }

  ngOnDestroy(): void {

  }
}
