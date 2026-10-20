import { Injectable } from '@angular/core';
import { BehaviorSubject } from 'rxjs';

export type NotificationType = 'success' | 'error' | 'info' | 'warning';

export interface NotificationOptions {
  tapToDismiss?: boolean;
  disableTimeOut?: boolean;
  timeOut?: number;
}

export interface AppNotification {
  id: number;
  type: NotificationType;
  message: string;
  title: string;
  options: Required<NotificationOptions>;
}

@Injectable({ providedIn: 'root' })
export class NotificationsService {
  private readonly notificationsSubject = new BehaviorSubject<AppNotification[]>([]);
  readonly notifications$ = this.notificationsSubject.asObservable();
  private nextId = 1;

  success(message: string, title = '', options?: NotificationOptions): number {
    return this.add('success', message, title, options);
  }

  error(message: string, title = '', options?: NotificationOptions): number {
    return this.add('error', message, title, options);
  }

  info(message: string, title = '', options?: NotificationOptions): number {
    return this.add('info', message, title, options);
  }

  warning(message: string, title = '', options?: NotificationOptions): number {
    return this.add('warning', message, title, options);
  }

  dismiss(id: number): void {
    this.notificationsSubject.next(
      this.notificationsSubject.value.filter(notification => notification.id !== id)
    );
  }

  private add(
    type: NotificationType,
    message: string,
    title: string,
    options?: NotificationOptions
  ): number {
    const id = this.nextId++;
    const notification: AppNotification = {
      id,
      type,
      message,
      title,
      options: {
        tapToDismiss: options?.tapToDismiss ?? true,
        disableTimeOut: options?.disableTimeOut ?? false,
        timeOut: options?.timeOut ?? 5000,
      },
    };

    this.notificationsSubject.next([...this.notificationsSubject.value, notification]);
    return id;
  }
}
