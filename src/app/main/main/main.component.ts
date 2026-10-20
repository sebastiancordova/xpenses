import { ChangeDetectionStrategy, Component, OnDestroy, OnInit, inject } from '@angular/core';
import { Subscription } from 'rxjs';
import { UserService } from '@core/services/user.service';

@Component({
  changeDetection: ChangeDetectionStrategy.Eager,
  standalone: false,
  selector: 'app-main',
  templateUrl: './main.component.html',
  styleUrls: ['./main.component.scss']
})
export class MainComponent implements OnInit, OnDestroy {
  private userService: UserService = inject(UserService);
  private userSubscription?: Subscription;

  ngOnInit(): void {
      this.userSubscription = this.userService.currentUser$();
  }

  ngOnDestroy(): void {
      this.userSubscription?.unsubscribe();
  }
}
