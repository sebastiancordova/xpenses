import { provideZoneChangeDetection } from '@angular/core';
import { ComponentFixture, fakeAsync, TestBed, tick } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { NgbToast, NgbToastConfig } from '@ng-bootstrap/ng-bootstrap';
import { NotificationsService } from '@core/services/notifications.service';
import { NotificationsComponent } from './notifications.component';
import { NotificationsModule } from './notifications.module';

describe('NotificationsComponent', () => {
  let fixture: ComponentFixture<NotificationsComponent>;
  let service: NotificationsService;

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [NotificationsModule],
      providers: [
        provideZoneChangeDetection(),
        {
          provide: NgbToastConfig,
          useValue: { animation: false, autohide: true, delay: 5000, ariaLive: 'polite' },
        },
      ],
    });
    service = TestBed.inject(NotificationsService);
    fixture = TestBed.createComponent(NotificationsComponent);
  });

  it('uses a five second auto-hide by default', fakeAsync(() => {
    service.success('Gasto guardado');
    fixture.detectChanges();

    const toast = fixture.debugElement.query(By.directive(NgbToast)).componentInstance as NgbToast;
    expect(toast.autohide).toBeTrue();
    expect(toast.delay).toBe(5000);

    tick(5001);
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('ngb-toast')).toBeNull();
  }));

  it('keeps persistent notifications visible after five seconds', fakeAsync(() => {
    service.success('Enlace enviado', '', { tapToDismiss: true, disableTimeOut: true });
    fixture.detectChanges();

    const toast = fixture.debugElement.query(By.directive(NgbToast)).componentInstance as NgbToast;
    expect(toast.autohide).toBeFalse();

    tick(6000);
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('ngb-toast')).not.toBeNull();
  }));

  it('dismisses a notification when tapped or closed with the accessible button', fakeAsync(() => {
    service.info('Toca para cerrar');
    fixture.detectChanges();
    fixture.nativeElement.querySelector('ngb-toast').click();
    tick(0);
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('ngb-toast')).toBeNull();

    service.info('Cerrar con botón');
    fixture.detectChanges();
    fixture.nativeElement.querySelector('ngb-toast .btn-close').click();
    tick(0);
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('ngb-toast')).toBeNull();
  }));

  it('renders message content as text instead of interpreting HTML', () => {
    service.error('<img src=x onerror=alert(1)>');
    fixture.detectChanges();

    const toast = fixture.nativeElement.querySelector('ngb-toast') as HTMLElement;
    expect(toast.querySelector('img')).toBeNull();
    expect(toast.textContent).toContain('<img src=x onerror=alert(1)>');
  });
});
