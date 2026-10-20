import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { NgbToast } from '@ng-bootstrap/ng-bootstrap';
import { AppNotification, NotificationsService } from '@core/services/notifications.service';

@Component({
  selector: 'app-notifications',
  standalone: false,
  changeDetection: ChangeDetectionStrategy.Eager,
  templateUrl: './notifications.component.html',
  styleUrls: ['./notifications.component.scss'],
})
export class NotificationsComponent {
  readonly notifications = inject(NotificationsService);
  readonly notifications$ = this.notifications.notifications$;

  onToastTap(notification: AppNotification, toast: NgbToast): void {
    if (notification.options.tapToDismiss) {
      toast.hide();
    }
  }

  closeToast(toast: NgbToast, event: MouseEvent): void {
    event.stopPropagation();
    toast.hide();
  }

  onToastHidden(id: number): void {
    this.notifications.dismiss(id);
  }
}
