import { TestBed } from '@angular/core/testing';
import { Auth } from '@angular/fire/auth';
import { Firestore, Timestamp } from '@angular/fire/firestore';
import { InstallmentPurchase } from '@core/models/installment-purchase';
import { UserService } from './user.service';
import { UserPreferencesService } from './user-preferences.service';
import { PaymentMethodsService } from './payment-methods.service';
import { InstallmentPurchasesService } from './installment-purchases.service';

describe('InstallmentPurchasesService cycle selection', () => {
  let service: InstallmentPurchasesService;
  const referenceDate = new Date(2026, 9, 15);
  const cycleStart = new Date(2026, 9, 1);
  const cycleEnd = new Date(2026, 9, 31, 23, 59, 59, 999);

  const purchase = (overrides: Partial<InstallmentPurchase> = {}): InstallmentPurchase => ({
    uid: 'titania', title: 'Comida Titania', installmentAmount: '11255', totalInstallments: 6,
    currentInstallment: 0, startDate: Timestamp.fromDate(new Date(2026, 4, 5)), paymentDay: 10,
    category: 'food', status: 'active', createdAt: Timestamp.fromMillis(0), updatedAt: Timestamp.fromMillis(0), ...overrides,
  });

  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [
      { provide: Auth, useValue: {} },
      { provide: Firestore, useValue: {} },
      { provide: UserService, useValue: { currentUserValue: {} } },
      { provide: UserPreferencesService, useValue: {} },
      { provide: PaymentMethodsService, useValue: {} },
    ] });
    service = TestBed.inject(InstallmentPurchasesService);
  });

  it('excludes a completed purchase from the current cycle even when its stored status is stale active', () => {
    const completed = purchase({ status: 'active' });
    expect(service.isCompleted(completed.startDate.toDate(), completed.paymentDay, completed.totalInstallments, referenceDate)).toBeTrue();
    expect(service.filterInstallmentsForCycle([completed], cycleStart, cycleEnd, undefined, undefined, referenceDate)).toEqual([]);
  });

  it('keeps the final installment in its closed historical cycle', () => {
    const completed = purchase({ status: 'completed' });
    const historicalStart = new Date(2026, 9, 1);
    const historicalEnd = new Date(2026, 9, 31, 23, 59, 59, 999);
    expect(historicalEnd.getTime()).toBe(new Date(2026, 10, 1).getTime() - 1);
    expect(service.filterInstallmentsForCycle([completed], historicalStart, historicalEnd, undefined, undefined, new Date(2026, 10, 1)))
      .toEqual([completed]);
    expect(service.getInstallmentInCycle(completed, historicalStart, historicalEnd)).toBe(6);
  });

  it('keeps an active purchase and its next scheduled installment in the current cycle', () => {
    const active = purchase({
      startDate: Timestamp.fromDate(new Date(2026, 8, 5)), totalInstallments: 3,
      currentInstallment: 1, status: 'active',
    });
    expect(service.filterInstallmentsForCycle([active], cycleStart, cycleEnd, undefined, undefined, referenceDate)).toEqual([active]);
    expect(service.getInstallmentInCycle(active, cycleStart, cycleEnd)).toBe(2);
  });

  it('does not mark the last installment completed on its due date', () => {
    const completedOnDueDate = purchase({ status: 'active' });
    const dueDate = new Date(2026, 9, 10);
    expect(service.isCompleted(completedOnDueDate.startDate.toDate(), completedOnDueDate.paymentDay, completedOnDueDate.totalInstallments, dueDate)).toBeFalse();
    expect(service.filterInstallmentsForCycle([completedOnDueDate], cycleStart, cycleEnd, undefined, undefined, dueDate)).toEqual([completedOnDueDate]);
  });

  it('uses the legacy payment method fallback when filtering by card', () => {
    const legacy = purchase({ paymentMethodId: undefined });
    expect(service.filterInstallmentsForCycle([legacy], cycleStart, cycleEnd, 'card-a', 'card-a', referenceDate)).toEqual([]);
    expect(service.filterInstallmentsForCycle([legacy], cycleStart, cycleEnd, 'card-a', 'card-a', new Date(2026, 8, 15)))
      .toEqual([legacy]);
  });

  it('excludes purchases assigned to a different payment method', () => {
    const otherCard = purchase({ paymentMethodId: 'card-b' });
    expect(service.filterInstallmentsForCycle([otherCard], cycleStart, cycleEnd, 'card-a', undefined, new Date(2026, 9, 10))).toEqual([]);
  });

  it('attributes credit card installments to the cycle that closes on their charge date', () => {
    const cycleStart = new Date(2026, 8, 19);
    const cycleEnd = new Date(2026, 9, 18, 23, 59, 59, 999);
    const freebuds = purchase({ uid: 'freebuds', title: 'Freebuds Pro', installmentAmount: '46663', paymentMethodId: 'card-a', startDate: Timestamp.fromDate(new Date(2026, 9, 5)), paymentDay: 19, totalInstallments: 3 });
    const septemberPurchase = purchase({ uid: 'brush', title: 'Cepillo de dientes', installmentAmount: '39956', paymentMethodId: 'card-a', startDate: Timestamp.fromDate(new Date(2026, 8, 5)), paymentDay: 19, totalInstallments: 3 });
    const januaryPurchase = purchase({ uid: 'solidarity', title: 'Fondo solidario', installmentAmount: '66955', paymentMethodId: 'card-a', startDate: Timestamp.fromDate(new Date(2026, 0, 5)), paymentDay: 19, totalInstallments: 10 });

    expect(service.getFirstPaymentDate(new Date(2026, 9, 5), 19)).toEqual(new Date(2026, 9, 19));
    expect(service.getInstallmentInCycle(freebuds, cycleStart, cycleEnd, 'billing-cycle')).toBe(1);
    expect(service.getInstallmentInCycle(septemberPurchase, cycleStart, cycleEnd, 'billing-cycle')).toBe(2);
    expect(service.getInstallmentInCycle(januaryPurchase, cycleStart, cycleEnd, 'billing-cycle')).toBe(10);
    const selected = service.filterInstallmentsForCycle([freebuds, septemberPurchase, januaryPurchase], cycleStart, cycleEnd, 'card-a', 'card-a', new Date(2026, 9, 5), 'billing-cycle');
    expect(selected.map(item => item.uid)).toEqual(['freebuds', 'brush', 'solidarity']);
    expect(selected.reduce((total, item) => total + Number(item.installmentAmount), 0)).toBe(153574);
    expect(service.getInstallmentInCycle(freebuds, cycleStart, cycleEnd)).toBeNull();
    expect(service.getInstallmentInCycle(freebuds, new Date(2026, 9, 19), new Date(2026, 10, 18, 23, 59, 59, 999), 'billing-cycle')).toBe(2);
  });

  it('clamps charge dates to month length and moves purchases made on the close to the next close', () => {
    expect(service.getPaymentDate(2025, 1, 31)).toEqual(new Date(2025, 1, 28));
    expect(service.getPaymentDate(2024, 1, 31)).toEqual(new Date(2024, 1, 29));
    expect(service.getPaymentDate(2026, 3, 30)).toEqual(new Date(2026, 3, 30));
    expect(service.getFirstPaymentDate(new Date(2025, 1, 28), 31)).toEqual(new Date(2025, 2, 31));
    expect(service.getFirstPaymentDate(new Date(2024, 1, 29), 29)).toEqual(new Date(2024, 2, 29));
    const jan31 = purchase({ startDate: Timestamp.fromDate(new Date(2025, 0, 5)), paymentDay: 31, totalInstallments: 3 });
    expect(service.getInstallmentInCycle(jan31, new Date(2025, 0, 31), new Date(2025, 1, 27, 23, 59, 59, 999), 'billing-cycle')).toBe(2);
    expect(service.getInstallmentInCycle(jan31, new Date(2025, 1, 28), new Date(2025, 2, 30, 23, 59, 59, 999), 'billing-cycle')).toBe(3);
  });
});
