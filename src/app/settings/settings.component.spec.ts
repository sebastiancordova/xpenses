import { CommonModule } from '@angular/common';
import { TestBed, fakeAsync, flushMicrotasks } from '@angular/core/testing';
import { ReactiveFormsModule } from '@angular/forms';
import { Timestamp } from '@angular/fire/firestore';
import { of, throwError } from 'rxjs';
import { PaymentMethod } from '@core/models/payment-method';
import { DEFAULT_PREFERENCES } from '@core/models/user-preferences';
import { PaymentMethodsService } from '@core/services/payment-methods.service';
import { UserPreferencesService } from '@core/services/user-preferences.service';
import { SettingsComponent } from './settings.component';

describe('SettingsComponent', () => {
  const createdAt = Timestamp.fromDate(new Date(2026, 0, 1));
  let preferencesService: { getPreferences: jasmine.Spy; savePreferences: jasmine.Spy };
  let paymentMethodsService: {
    ensureDefault: jasmine.Spy;
    getAll: jasmine.Spy;
    save: jasmine.Spy;
    update: jasmine.Spy;
    setActive: jasmine.Spy;
  };
  let methods: PaymentMethod[];

  beforeEach(async () => {
    methods = [
      {
        uid: 'primary-credit', name: 'Banco Norte', type: 'credit', billingCycleDay: 19,
        isActive: true, isDefault: true, createdAt, updatedAt: createdAt
      },
      {
        uid: 'daily-debit', name: 'Cuenta diaria', type: 'debit',
        isActive: true, isDefault: false, createdAt, updatedAt: createdAt
      },
      {
        uid: 'old-cash', name: 'Efectivo antiguo', type: 'cash',
        isActive: false, isDefault: false, createdAt, updatedAt: createdAt
      },
      {
        uid: 'legacy-credit', name: 'Crédito histórico', type: 'credit',
        isActive: false, isDefault: false, createdAt, updatedAt: createdAt
      }
    ];
    preferencesService = {
      getPreferences: jasmine.createSpy().and.returnValue(of({ ...DEFAULT_PREFERENCES })),
      savePreferences: jasmine.createSpy().and.returnValue(Promise.resolve())
    };
    paymentMethodsService = {
      ensureDefault: jasmine.createSpy().and.returnValue(Promise.resolve(methods[0])),
      getAll: jasmine.createSpy().and.returnValue(of(methods)),
      save: jasmine.createSpy().and.returnValue(Promise.resolve()),
      update: jasmine.createSpy().and.returnValue(Promise.resolve()),
      setActive: jasmine.createSpy().and.returnValue(Promise.resolve())
    };

    await TestBed.configureTestingModule({
      declarations: [SettingsComponent],
      imports: [CommonModule, ReactiveFormsModule],
      providers: [
        { provide: UserPreferencesService, useValue: preferencesService },
        { provide: PaymentMethodsService, useValue: paymentMethodsService }
      ]
    }).compileComponents();
  });

  function createFixture() {
    const fixture = TestBed.createComponent(SettingsComponent);
    fixture.detectChanges();
    flushMicrotasks();
    fixture.detectChanges();
    return fixture;
  }

  it('loads defaults and methods through mocked services without Firebase access', fakeAsync(() => {
    const fixture = createFixture();
    const component = fixture.componentInstance;

    expect(preferencesService.getPreferences).toHaveBeenCalledTimes(1);
    expect(paymentMethodsService.ensureDefault).toHaveBeenCalledOnceWith(DEFAULT_PREFERENCES.billingCycleDay);
    expect(paymentMethodsService.getAll).toHaveBeenCalledTimes(1);
    expect(component.form.value).toEqual(DEFAULT_PREFERENCES);
    expect(component.savingsRate?.value).toBe(20);
    expect(component.variableRate?.value).toBe(50);
    expect(component.fixedRate).toBe(30);
    expect(component.allocationWarning).toBeFalse();
    expect(fixture.nativeElement.querySelector('#savingsRate').getAttribute('min')).toBe('0');
    expect(fixture.nativeElement.querySelector('#savingsRate').getAttribute('max')).toBe('100');
    expect(fixture.nativeElement.querySelector('.payment-method__default').textContent).toContain('Principal');
    const primaryRow = Array.from(fixture.nativeElement.querySelectorAll('.payment-method'))
      .find((row: any) => row.textContent.includes('Banco Norte')) as HTMLElement;
    expect(primaryRow.querySelector('.payment-method__toggle')).toBeNull();
    const legacyCreditRow = Array.from(fixture.nativeElement.querySelectorAll('.payment-method'))
      .find((row: any) => row.textContent.includes('Crédito histórico')) as HTMLElement;
    expect(legacyCreditRow.textContent).toContain('Tarjeta de crédito');
    expect(legacyCreditRow.textContent).not.toContain('Cierre día');

    component.togglePaymentMethod(methods[0]);
    flushMicrotasks();
    expect(paymentMethodsService.setActive).not.toHaveBeenCalled();
    fixture.destroy();
  }));

  it('blocks over-allocation, restores the recommendation, and saves changed preferences', fakeAsync(() => {
    const fixture = createFixture();
    const component = fixture.componentInstance;

    component.form.patchValue({ savingsRate: 65, variableRate: 40 });
    fixture.detectChanges();
    expect(component.totalAllocated).toBe(105);
    expect(component.allocationWarning).toBeTrue();
    expect(component.fixedRate).toBe(0);
    expect(fixture.nativeElement.querySelector('.allocation-error')).toBeTruthy();
    expect((fixture.nativeElement.querySelector('.btn-save') as HTMLButtonElement).disabled).toBeTrue();
    component.submit();
    flushMicrotasks();
    expect(preferencesService.savePreferences).not.toHaveBeenCalled();

    component.useRecommendedAllocation();
    expect(component.savingsRate?.value).toBe(20);
    expect(component.variableRate?.value).toBe(50);
    expect(component.fixedRate).toBe(30);
    component.changeRate('savingsRate', 5);
    component.submit();
    flushMicrotasks();
    expect(preferencesService.savePreferences).toHaveBeenCalledOnceWith({ billingCycleDay: 19, savingsRate: 25, variableRate: 50 });
    expect(component.saved).toBeTrue();
    fixture.destroy();
  }));

  it('keeps method editing and activation independent from budget controls, with credit-day rules', fakeAsync(() => {
    const fixture = createFixture();
    const component = fixture.componentInstance;

    component.editPaymentMethod(methods[0]);
    fixture.detectChanges();
    expect(component.paymentMethodForm.value).toEqual({ name: 'Banco Norte', type: 'credit', billingCycleDay: 19 });
    expect(component.paymentMethodBillingDay?.valid).toBeTrue();
    component.paymentMethodBillingDay?.setValue(29);
    expect(component.paymentMethodBillingDay?.invalid).toBeTrue();
    component.paymentMethodBillingDay?.setValue(28);
    expect(component.paymentMethodBillingDay?.valid).toBeTrue();

    component.cancelPaymentMethod();
    expect(component.hasUnsavedChanges).toBeFalse();
    component.togglePaymentMethod(methods[1]);
    flushMicrotasks();
    expect(paymentMethodsService.setActive).toHaveBeenCalledOnceWith(methods[1], false);
    expect(component.savingsRate?.value).toBe(20);
    expect(component.variableRate?.value).toBe(50);
    fixture.destroy();
  }));

  it('saves a credit closing day but omits it for a debit method', fakeAsync(() => {
    const fixture = createFixture();
    const component = fixture.componentInstance;

    component.startPaymentMethod();
    component.paymentMethodForm.patchValue({ name: 'Visa nueva', type: 'credit', billingCycleDay: 23 });
    component.savePaymentMethod();
    flushMicrotasks();
    expect(paymentMethodsService.save).toHaveBeenCalledWith(jasmine.objectContaining({
      name: 'Visa nueva', type: 'credit', billingCycleDay: 23, isActive: true, isDefault: false
    }));

    component.startPaymentMethod();
    component.paymentMethodForm.patchValue({ name: 'Cuenta débito', type: 'debit', billingCycleDay: 27 });
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('#payment-method-billing-day')).toBeNull();
    component.savePaymentMethod();
    flushMicrotasks();
    expect(paymentMethodsService.save).toHaveBeenCalledWith(jasmine.objectContaining({
      name: 'Cuenta débito', type: 'debit', billingCycleDay: undefined, isActive: true, isDefault: false
    }));
    fixture.destroy();
  }));

  it('shows payment-method failures outside the closed form while preferences remain available', fakeAsync(() => {
    paymentMethodsService.setActive.and.callFake(() => Promise.reject(new Error('offline')));
    const fixture = createFixture();
    const component = fixture.componentInstance;
    component.togglePaymentMethod(methods[1]);
    flushMicrotasks();
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelector('.payment-method-error').textContent).toContain('No se pudo actualizar');
    expect(fixture.nativeElement.querySelector('.payment-method-form')).toBeNull();
    expect(fixture.nativeElement.querySelector('#allocation-title')).toBeTruthy();
    expect(component.preferencesLoading).toBeFalse();
    fixture.destroy();
  }));

  it('retries a failed method-list read while preserving the saved preferences', fakeAsync(() => {
    paymentMethodsService.getAll.and.returnValues(
      throwError(() => new Error('offline')),
      of(methods)
    );
    const fixture = createFixture();
    const component = fixture.componentInstance;
    expect(fixture.nativeElement.querySelector('.payment-method-error p').textContent).toContain('No se pudieron cargar');
    expect(fixture.nativeElement.querySelector('.payment-method-retry')).toBeTruthy();

    fixture.nativeElement.querySelector('.payment-method-retry').click();
    flushMicrotasks();
    fixture.detectChanges();
    expect(component.paymentMethodError).toBe('');
    expect(component.paymentMethods.map(method => method.uid)).toContain('daily-debit');
    expect(component.form.value).toEqual(DEFAULT_PREFERENCES);
    expect(preferencesService.savePreferences).not.toHaveBeenCalled();
    expect(paymentMethodsService.ensureDefault).toHaveBeenCalledTimes(2);
    expect(paymentMethodsService.getAll).toHaveBeenCalledTimes(2);
    fixture.destroy();
  }));

  it('keeps preference-load errors recoverable and separate from payment-method errors', fakeAsync(() => {
    preferencesService.getPreferences.and.returnValues(
      throwError(() => new Error('offline')),
      of({ ...DEFAULT_PREFERENCES })
    );
    const fixture = TestBed.createComponent(SettingsComponent);
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('.settings-notice--error')).toBeTruthy();

    fixture.nativeElement.querySelector('.notice-action').click();
    flushMicrotasks();
    fixture.detectChanges();
    expect(fixture.componentInstance.loadError).toBeFalse();
    expect(fixture.componentInstance.preferencesLoading).toBeFalse();
    expect(paymentMethodsService.ensureDefault).toHaveBeenCalledTimes(1);
    fixture.destroy();
  }));
});
