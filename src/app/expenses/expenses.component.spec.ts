import { CommonModule } from '@angular/common';
import { TestBed, fakeAsync, tick } from '@angular/core/testing';
import { Timestamp } from '@angular/fire/firestore';
import { NgbDropdownModule } from '@ng-bootstrap/ng-bootstrap';
import { ExpensesService } from '@core/services/expenses.service';
import { PaymentMethodsService } from '@core/services/payment-methods.service';
import { SharedModule } from '@shared/shared.module';
import { ToastrService } from 'ngx-toastr';
import { of, throwError } from 'rxjs';
import { ExpensesComponent } from './expenses.component';

describe('ExpensesComponent payment-method filtering', () => {
  const records = [
    { uid: 'a', title: 'Mercado', amount: '100', category: 'Alimentación', paymentMethodId: 'credit' },
    { uid: 'b', title: 'Mercado débito', amount: '200', category: 'Alimentación', paymentMethodId: 'debit' },
    { uid: 'c', title: 'Bus', amount: '50', category: 'Transporte', paymentMethodId: 'credit' },
    { uid: 'd', title: 'Antiguo', amount: '30', category: 'Alimentación' },
    { uid: 'e', title: 'Vacío', amount: '20', category: 'Alimentación', paymentMethodId: '' },
    { uid: 'f', title: 'Nulo', amount: '10', category: 'Alimentación', paymentMethodId: null }
  ].map(record => ({ ...record, comment: '', createdAt: Timestamp.fromDate(new Date(2026, 9, 3)) }));
  let expensesService: { getAll: jasmine.Spy };
  let methodsService: { getAll: jasmine.Spy };

  beforeEach(async () => {
    expensesService = { getAll: jasmine.createSpy().and.returnValue(of(records)) };
    methodsService = { getAll: jasmine.createSpy().and.returnValue(of([
      { uid: 'credit', name: 'Crédito', type: 'credit', isActive: true, isDefault: true },
      { uid: 'debit', name: 'Débito', type: 'debit', isActive: false }
    ])) };
    await TestBed.configureTestingModule({
      declarations: [ExpensesComponent],
      imports: [CommonModule, SharedModule, NgbDropdownModule],
      providers: [
        { provide: ExpensesService, useValue: expensesService },
        { provide: PaymentMethodsService, useValue: methodsService },
        { provide: ToastrService, useValue: {} }
      ]
    }).compileComponents();
  });

  it('filters exact IDs through the payment-method menu and keeps unassigned records in all methods', fakeAsync(() => {
    const fixture = TestBed.createComponent(ExpensesComponent);
    fixture.detectChanges();
    const component = fixture.componentInstance;
    const trigger = fixture.nativeElement.querySelector('#expense-payment-method') as HTMLButtonElement;
    expect(trigger.getAttribute('aria-labelledby')).toContain('expense-payment-method-label');
    expect(fixture.nativeElement.querySelector('#expense-payment-method-label').textContent).toContain('Método de pago');
    expect(component.collectionSize).toBe(6);
    expect(component.totalAmountFiltered).toBe(410);
    trigger.click();
    fixture.detectChanges();
    const menu = fixture.nativeElement.querySelector('.filter-payment-method__menu') as HTMLElement;
    expect(menu.textContent).toContain('Débito (inactivo)');
    const escapeEvent = new KeyboardEvent('keydown', { key: 'Escape', keyCode: 27, bubbles: true });
    Object.defineProperty(escapeEvent, 'which', { get: () => 27 });
    trigger.dispatchEvent(escapeEvent);
    fixture.detectChanges();
    expect(menu.classList.contains('show')).toBeFalse();
    trigger.click();
    fixture.detectChanges();
    const menuItems = Array.from(menu.querySelectorAll('button')) as HTMLButtonElement[];
    menuItems.find(item => item.textContent?.trim() === 'Crédito')?.click();
    expect(document.activeElement).toBe(trigger);
    tick(200);
    expect(component.expenses.map(record => record.uid)).toEqual(['a', 'c']);
    expect(component.totalAmountFiltered).toBe(150);
    component.filtersForm.patchValue({ paymentMethodId: 'debit' });
    tick(200);
    expect(component.expenses.map(record => record.uid)).toEqual(['b']);
    expect(component.totalAmountFiltered).toBe(200);
    component.filtersForm.patchValue({ paymentMethodId: component.unassignedPaymentMethod });
    tick(200);
    expect(component.expenses.map(record => record.uid)).toEqual(['d', 'e', 'f']);
    expect(component.totalAmountFiltered).toBe(60);
    expect(expensesService.getAll).toHaveBeenCalledTimes(1);
    fixture.destroy();
  }));

  it('combines method, search and category before total and pagination and resets the page on changes', fakeAsync(() => {
    const fixture = TestBed.createComponent(ExpensesComponent);
    fixture.detectChanges();
    const component = fixture.componentInstance;
    component.pageSize = 1;
    component.page = 2;
    component.filtersForm.patchValue({ paymentMethodId: 'credit' });
    tick(200);
    expect(component.page).toBe(1);
    expect(component.collectionSize).toBe(2);
    expect(component.totalAmountFiltered).toBe(150);
    component.toggleAmountSort();
    component.page = 2;
    component.filter();
    expect(component.expenses[0].uid).toBe('c');
    component.filtersForm.patchValue({ search: 'mercado', category: 'Alimentación' });
    tick(200);
    expect(component.page).toBe(1);
    expect(component.collectionSize).toBe(1);
    expect(component.totalAmountFiltered).toBe(100);
    fixture.destroy();
  }));

  it('preserves explicit dates on method changes and clears all filters together', fakeAsync(() => {
    const fixture = TestBed.createComponent(ExpensesComponent);
    fixture.detectChanges();
    const component = fixture.componentInstance;
    const from = new Date(2026, 8, 20);
    const to = new Date(2026, 9, 19);
    component.filterByDate({ from, to });
    component.filtersForm.patchValue({ paymentMethodId: 'credit', search: 'Mercado', category: 'Alimentación' });
    tick(200);
    expect(component.visibleDateRange).toEqual({ from, to });
    expect(expensesService.getAll).toHaveBeenCalledWith(from, to);
    expect(expensesService.getAll).toHaveBeenCalledTimes(2);
    component.page = 2;
    component.clearFilters();
    tick(200);
    expect(component.filtersForm.value).toEqual({ search: '', category: '', paymentMethodId: '' });
    expect(component.hasActiveFilters).toBeFalse();
    expect(component.page).toBe(1);
    expect(component.collectionSize).toBe(6);
    expect(expensesService.getAll).toHaveBeenCalledWith(undefined, undefined);
    fixture.destroy();
  }));

  it('renders a recoverable empty state when combined filters have no matches', fakeAsync(() => {
    const fixture = TestBed.createComponent(ExpensesComponent);
    fixture.detectChanges();
    fixture.componentInstance.filtersForm.patchValue({ paymentMethodId: 'debit', category: 'Transporte' });
    tick(200);
    fixture.detectChanges();
    expect(fixture.componentInstance.totalAmountFiltered).toBe(0);
    expect(fixture.nativeElement.querySelector('.empty-state').textContent).toContain('Sin resultados');
    expect(fixture.nativeElement.querySelector('.empty-state').textContent).toContain('Limpiar filtros');
    fixture.destroy();
  }));

  it('allows all-method and unassigned filtering when methods fail to load', fakeAsync(() => {
    methodsService.getAll.and.returnValue(throwError(() => new Error('offline')));
    const fixture = TestBed.createComponent(ExpensesComponent);
    fixture.detectChanges();
    const component = fixture.componentInstance;
    expect(component.paymentMethodsError).toBeTrue();
    expect(component.collectionSize).toBe(6);
    component.filtersForm.patchValue({ paymentMethodId: component.unassignedPaymentMethod });
    tick(200);
    expect(component.totalAmountFiltered).toBe(60);
    fixture.destroy();
  }));

});
