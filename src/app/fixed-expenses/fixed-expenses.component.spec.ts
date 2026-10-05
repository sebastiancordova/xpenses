import { FormBuilder } from '@angular/forms';
import { CommonModule } from '@angular/common';
import { ApplicationRef } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { SharedModule } from '@shared/shared.module';
import { FixedExpensesService } from '@core/services/fixed-expenses.service';
import { FixedExpenseChargesService } from '@core/services/fixed-expense-charges.service';
import { PaymentMethodsService } from '@core/services/payment-methods.service';
import { ToastrService } from 'ngx-toastr';
import { of } from 'rxjs';
import { NgbModalConfig } from '@ng-bootstrap/ng-bootstrap';
import { FixedExpensesComponent } from './fixed-expenses.component';

describe('FixedExpensesComponent monthly records', () => {
  const createComponent = (): any => {
    const component = Object.create(FixedExpensesComponent.prototype);
    component.filtersForm = new FormBuilder().group({ search: '' });
    component.selectedPeriod = '2026-08';
    component.page = 1;
    component.pageSize = 8;
    component.fireFixedExpenses = [{ uid: 'light', title: 'Luz', amount: '110000' }];
    component.charges = [{ uid: 'light_2026-08', fixedExpenseId: 'light', period: '2026-08', title: 'Luz', amount: '100000', chargeDate: '2026-08-12', status: 'confirmed' }];
    return component;
  };

  it('shows the monthly amount independently of an edited recurring estimate', () => {
    const component = createComponent();
    component.filter();
    expect(component.rows[0].amount).toBe('100000');
    expect(component.confirmedAmount).toBe(100000);
    expect(component.estimatedAmount).toBe(0);
    component.setPeriod('2026-09');
    expect(component.rows[0].amount).toBe('110000');
    expect(component.confirmedAmount).toBe(0);
    expect(component.estimatedAmount).toBe(110000);
  });

  it('preserves historical rows after template deletion and removes skipped charges from totals', () => {
    const component = createComponent();
    component.fireFixedExpenses = [];
    component.filter();
    expect(component.rows[0].title).toBe('Luz');
    expect(component.confirmedAmount).toBe(100000);
    component.charges[0].status = 'skipped';
    component.filter();
    expect(component.totalAmountFiltered).toBe(0);
  });

  it('lists a September charge in September even when its account record belongs to October', () => {
    const component = createComponent();
    component.charges[0] = { ...component.charges[0], uid: 'light_2026-10', period: '2026-10', chargeDate: '2026-09-05' };
    component.setPeriod('2026-10');
    expect(component.confirmedAmount).toBe(0);
    expect(component.estimatedAmount).toBe(110000);
    expect(component.rows[0].charge).toBeUndefined();
    expect(component.rows[0].fixedExpenseId).toBe('light');
    component.setPeriod('2026-09');
    expect(component.rows.length).toBe(1);
    expect(component.confirmedAmount).toBe(100000);
    expect(component.estimatedAmount).toBe(0);
    expect(component.rows[0].charge.uid).toBe('light_2026-10');
  });

  it('keeps separate account occurrences that charged in the same calendar month', () => {
    const component = createComponent();
    component.charges.push({ ...component.charges[0], uid: 'light_2026-09', period: '2026-09', chargeDate: '2026-08-31', amount: '120000' });
    component.filter();
    expect(component.rows.length).toBe(2);
    expect(component.confirmedAmount).toBe(220000);
  });

  it('edits the original account identity and navigates to the actual charge month across a year boundary', async () => {
    const component = createComponent();
    component.selectedPeriod = '2027-01';
    component.activeRow = { fixedExpenseId: 'light', title: 'Luz', amount: '100000', charge: { ...component.charges[0], period: '2026-12' } };
    component.chargeForm = new FormBuilder().group({ amount: '100000', chargeDate: '2027-01-05', paymentMethodId: 'card' });
    component.chargesService = { save: jasmine.createSpy().and.resolveTo(), delete: jasmine.createSpy().and.resolveTo() };
    component.chargeModalRef = { close: jasmine.createSpy() };
    component.toastr = { success: jasmine.createSpy() };
    await component.saveCharge('confirmed');
    expect(component.chargesService.save).toHaveBeenCalledWith(jasmine.objectContaining({ period: '2026-12', chargeDate: '2027-01-05' }), 'light_2026-08');
    expect(component.selectedPeriod).toBe('2027-01');
    component.resetRequested = true;
    await component.resetCharge();
    expect(component.chargesService.delete).toHaveBeenCalledWith('light_2026-08');
  });

  it('keeps the monthly form open and recoverable after a write failure', async () => {
    const component = createComponent();
    component.activeRow = { fixedExpenseId: 'light', title: 'Luz', amount: '100000' };
    component.chargeForm = new FormBuilder().group({ amount: '100000', chargeDate: '2026-08-12', paymentMethodId: 'card' });
    component.chargesService = { save: jasmine.createSpy().and.rejectWith(new Error('offline')) };
    component.chargeModalRef = { close: jasmine.createSpy() };
    await component.saveCharge('confirmed');
    expect(component.chargeModalRef.close).not.toHaveBeenCalled();
    expect(component.chargeForm.value.amount).toBe('100000');
    expect(component.chargeError).toContain('conexión');
    expect(component.savingCharge).toBeFalse();
  });

  it('requires explicit confirmation before resetting a monthly record', async () => {
    const component = createComponent();
    component.activeRow = { fixedExpenseId: 'light', charge: component.charges[0] };
    component.chargesService = { delete: jasmine.createSpy().and.resolveTo() };
    component.chargeModalRef = { close: jasmine.createSpy() };
    component.toastr = { success: jasmine.createSpy() };
    await component.resetCharge();
    expect(component.chargesService.delete).not.toHaveBeenCalled();
    await component.resetCharge();
    expect(component.chargesService.delete).toHaveBeenCalledWith('light_2026-08');
  });
});

describe('FixedExpensesComponent rendered monthly modal', () => {
  it('opens its first modal with monthly data and cleans it up when the page is destroyed', async () => {
    await TestBed.configureTestingModule({
      declarations: [FixedExpensesComponent], imports: [CommonModule, SharedModule],
      providers: [
        { provide: FixedExpensesService, useValue: { getAll: () => of([{ uid: 'light', title: 'Luz', amount: '110000', paymentMethodId: 'card' }]) } },
        { provide: FixedExpenseChargesService, useValue: { getAll: () => of([]) } },
        { provide: PaymentMethodsService, useValue: { getAll: () => of([{ uid: 'card', name: 'Tarjeta de prueba', isDefault: true, isActive: true }]) } },
        { provide: ToastrService, useValue: {} }
      ]
    }).compileComponents();
    const fixture = TestBed.createComponent(FixedExpensesComponent);
    fixture.detectChanges();
    const component = fixture.componentInstance;
    component.openCharge(component.rows[0]);
    TestBed.inject(ApplicationRef).tick();
    expect(document.body.querySelector('#monthly-charge-title')?.textContent).toContain('Registrar cargo');
    expect((document.body.querySelector('#monthly-amount') as HTMLInputElement).value).toBe('110000');
    expect((document.body.querySelector('#monthly-method') as HTMLSelectElement).value).toBe('card');
    expect(getComputedStyle(document.body.querySelector('.monthly-fixed-charge-modal .modal-content') as Element).borderTopLeftRadius).toBe('14px');
    fixture.destroy();
  });

  it('keeps the monthly dialog above the backdrop, editable and dismissible on repeated opens', async () => {
    const save = jasmine.createSpy('save').and.resolveTo();
    await TestBed.configureTestingModule({
      declarations: [FixedExpensesComponent], imports: [CommonModule, SharedModule],
      providers: [
        { provide: FixedExpensesService, useValue: { getAll: () => of([{ uid: 'light', title: 'Luz', amount: '110000', paymentMethodId: 'card' }]) } },
        { provide: FixedExpenseChargesService, useValue: { getAll: () => of([]), save } },
        { provide: PaymentMethodsService, useValue: { getAll: () => of([{ uid: 'card', name: 'Tarjeta de prueba', isDefault: true, isActive: true }]) } },
        { provide: ToastrService, useValue: { success: jasmine.createSpy() } }
      ]
    }).compileComponents();
    TestBed.inject(NgbModalConfig).animation = false;
    const fixture = TestBed.createComponent(FixedExpensesComponent);
    fixture.detectChanges();
    const component = fixture.componentInstance;
    component.setPeriod('2026-10');
    component.openCharge(component.rows[0]);
    TestBed.inject(ApplicationRef).tick();
    const window = document.body.querySelector('.monthly-fixed-charge-modal') as HTMLElement;
    const backdrop = document.body.querySelector('ngb-modal-backdrop') as HTMLElement;
    expect(Number(getComputedStyle(window).zIndex)).toBeGreaterThan(Number(getComputedStyle(backdrop).zIndex));
    const amount = window.querySelector('#monthly-amount') as HTMLInputElement;
    const rect = amount.getBoundingClientRect();
    // A programmatic click alone also fires when a backdrop blocks real pointer input.
    expect(document.elementFromPoint(rect.left + rect.width / 2, rect.top + rect.height / 2)).toBe(amount);
    amount.focus();
    expect(document.activeElement).toBe(amount);
    amount.value = '120000';
    amount.dispatchEvent(new Event('input', { bubbles: true }));
    expect(component.chargeForm.value.amount).toBe('120000');
    component.chargeForm.patchValue({ chargeDate: '2026-09-05' });
    TestBed.inject(ApplicationRef).tick();
    expect(window.textContent).toContain('Aparecerá en los cargos de septiembre de 2026');
    (window.querySelector('button[type="submit"]') as HTMLButtonElement).click();
    await fixture.whenStable();
    expect(save).toHaveBeenCalledWith(jasmine.objectContaining({ period: '2026-10', chargeDate: '2026-09-05' }), undefined);
    expect(component.selectedPeriod).toBe('2026-09');
    expect(document.body.querySelector('.monthly-fixed-charge-modal')).toBeNull();
    expect(document.body.querySelector('ngb-modal-backdrop')).toBeNull();
    component.openCharge(component.rows[0]);
    TestBed.inject(ApplicationRef).tick();
    (document.body.querySelector('[aria-label="Cerrar registro mensual"]') as HTMLButtonElement).click();
    await fixture.whenStable();
    expect(document.body.querySelector('.monthly-fixed-charge-modal')).toBeNull();
    expect(document.body.querySelector('ngb-modal-backdrop')).toBeNull();
    expect(document.body.classList.contains('modal-open')).toBeFalse();
    fixture.destroy();
  });
});
