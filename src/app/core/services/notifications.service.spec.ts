import { NotificationsService } from './notifications.service';

describe('NotificationsService', () => {
  let service: NotificationsService;

  beforeEach(() => {
    service = new NotificationsService();
  });

  it('uses a five second timeout and enables tap to dismiss by default', () => {
    let notification = service.success('Guardado');
    let value = 0;
    service.notifications$.subscribe(notifications => {
      value = notifications[0]?.id ?? 0;
    });

    expect(notification).toBe(value);
    service.notifications$.subscribe(notifications => {
      expect(notifications[0]?.options).toEqual({
        tapToDismiss: true,
        disableTimeOut: false,
        timeOut: 5000,
      });
    });
  });

  it('keeps a notification persistent when timeout is disabled', () => {
    service.success('Enlace enviado', '', { tapToDismiss: true, disableTimeOut: true });

    service.notifications$.subscribe(notifications => {
      expect(notifications[0]?.options.disableTimeOut).toBeTrue();
      expect(notifications[0]?.options.tapToDismiss).toBeTrue();
      expect(notifications[0]?.options.timeOut).toBe(5000);
    });
  });

  it('dismisses only the notification with the requested id', () => {
    const firstId = service.info('Primero');
    const secondId = service.error('Segundo');

    service.dismiss(firstId);

    service.notifications$.subscribe(notifications => {
      expect(notifications.map(notification => notification.id)).toEqual([secondId]);
    });
  });
});
