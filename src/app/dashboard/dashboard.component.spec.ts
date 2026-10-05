import { EMPTY, of, Subject } from 'rxjs';
import { DashboardComponent } from './dashboard.component';
import { InstallmentPurchasesService } from '@core/services/installment-purchases.service';

describe('DashboardComponent period comparison', () => {
  const createDashboard = (type: 'credit' | 'debit' | 'cash' = 'debit', billingCycleDay = 19): any => {
    const dashboard = Object.create(DashboardComponent.prototype);
    dashboard.months = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];
    dashboard.shortMonths = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];
    const now = new Date();
    dashboard.displayDate = new Date(now.getFullYear(), now.getMonth(), 1);
    dashboard.selectedPaymentMethod = { uid: 'synthetic-method', type, billingCycleDay };
    dashboard.prefs = { billingCycleDay: 19 };
    dashboard.paymentMethods = [];
    dashboard.periodStartDate = new Date();
    dashboard.periodEndDate = new Date();
    dashboard.comparisonRequests$ = new Subject();
    dashboard.dailySpendRequests$ = new Subject();
    dashboard.monthToDateSpend = 0;
    dashboard.previousMonthToDateSpend = 0;
    dashboard.isComparisonLoading = false;
    dashboard.comparisonLoadError = false;
    dashboard.hasSpendComparison = false;
    dashboard.spendDate = dashboard.toDateInput(new Date(now.getFullYear(), now.getMonth(), 1));
    dashboard.isDailySpendLoading = false;
    dashboard.dailySpendLoadError = false;
    dashboard.spendOnSelectedDate = 0;
    dashboard.spendOnSelectedDateCount = 0;
    return dashboard;
  };

  it('names the full credit cycle while preserving and naming the global income month', () => {
    const dashboard = createDashboard('credit');
    dashboard.displayDate = new Date(2026, 8, 1);
    const dates = dashboard.getPeriodDates();
    dashboard.periodStartDate = dates.startDate;
    dashboard.periodEndDate = dates.endDate;

    expect(dashboard.periodSelectorLabel).toBe('19 Sep – 18 Oct 2026');
    expect(dashboard.periodContextLabel).toBe('Ciclo de facturación');
    expect(dashboard.incomePeriod).toBe('2026-09');
    expect(dashboard.incomeMonthLabel).toBe('septiembre 2026');
  });

  it('includes Pasquilu on the configured start day and excludes dates outside the 19–18 window', () => {
    const dashboard = createDashboard('credit', 19);
    dashboard.displayDate = new Date(2026, 8, 1);
    dashboard.chartColors = ['#876656'];
    dashboard.prefs = { savingsRate: 20, variableRate: 50 };
    dashboard.loadRequests$ = new Subject();
    let loadRequest: any;
    dashboard.loadRequests$.subscribe((request: any) => loadRequest = request);
    dashboard.loadData();
    const { startDate, endDate } = loadRequest;
    const records = [
      { uid: 'before', title: 'Antes', amount: '1', category: 'Alimentación', comment: '', createdAt: new Date(2026, 8, 18, 23, 59, 59, 999) },
      { uid: 'pasquilu', title: 'Pasquilu', amount: '10500', category: 'Alimentación', comment: '', createdAt: new Date(2026, 8, 19, 12) },
      { uid: 'last-day', title: 'Último día', amount: '1', category: 'Alimentación', comment: '', createdAt: new Date(2026, 9, 18, 23, 59, 59, 999) },
      { uid: 'next-cycle', title: 'Ciclo siguiente', amount: '2', category: 'Alimentación', comment: '', createdAt: new Date(2026, 9, 19) }
    ];
    const queried = records.filter(record => record.createdAt >= startDate && record.createdAt <= endDate);

    expect(startDate).toEqual(new Date(2026, 8, 19));
    expect(endDate).toEqual(new Date(2026, 9, 18, 23, 59, 59, 999));
    expect(queried.map(record => record.uid)).toEqual(['pasquilu', 'last-day']);
    expect(startDate).toEqual(new Date(2026, 8, 19));
    expect(endDate).toEqual(new Date(2026, 9, 18, 23, 59, 59, 999));
    dashboard.applyLoadedData([queried as any, [], [], [], [], []], loadRequest);
    expect(dashboard.totalVariable).toBe(10501);
    expect(dashboard.categoryBreakdown[0].category).toBe('Alimentación');
    expect(dashboard.categoryBreakdown[0].amount).toBe(10501);
    expect(dashboard.adjustedChartTotal).toBe(10501);
  });

  it('includes both years for a credit cycle crossing the new year', () => {
    const dashboard = createDashboard('credit');
    dashboard.displayDate = new Date(2026, 11, 1);
    const dates = dashboard.getPeriodDates();
    dashboard.periodStartDate = dates.startDate;
    dashboard.periodEndDate = dates.endDate;
    expect(dashboard.periodSelectorLabel).toBe('19 Dic 2026 – 18 Ene 2027');
    expect(dashboard.incomePeriod).toBe('2026-12');
  });

  it('switches the active credit cycle on its start day and respects a clipped month boundary', () => {
    const dashboard = createDashboard('credit', 19);
    jasmine.clock().install();
    try {
      jasmine.clock().mockDate(new Date(2026, 8, 18));
      expect(dashboard.getCurrentPeriodReferenceDate()).toEqual(new Date(2026, 7, 1));
      jasmine.clock().mockDate(new Date(2026, 8, 19));
      expect(dashboard.getCurrentPeriodReferenceDate()).toEqual(new Date(2026, 8, 1));

      dashboard.selectedPaymentMethod.billingCycleDay = 31;
      jasmine.clock().mockDate(new Date(2025, 1, 28));
      expect(dashboard.getCurrentPeriodReferenceDate()).toEqual(new Date(2025, 1, 1));
    } finally {
      jasmine.clock().uninstall();
    }
  });

  it('clips cycle start dates independently for days beyond February length', () => {
    const dashboard = createDashboard('credit', 31);
    dashboard.displayDate = new Date(2025, 0, 1);
    const january = dashboard.getPeriodDates();
    const february = dashboard.getPeriodDates(new Date(2025, 1, 1));
    const leapFebruary = dashboard.getPeriodDates(new Date(2024, 1, 1));
    expect(january.startDate).toEqual(new Date(2025, 0, 31));
    expect(january.endDate).toEqual(new Date(2025, 1, 27, 23, 59, 59, 999));
    expect(february.startDate).toEqual(new Date(2025, 1, 28));
    expect(february.endDate).toEqual(new Date(2025, 2, 30, 23, 59, 59, 999));
    expect(leapFebruary.startDate).toEqual(new Date(2024, 1, 29));
    expect(leapFebruary.endDate).toEqual(new Date(2024, 2, 30, 23, 59, 59, 999));
  });

  it('labels debit and cash as calendar months without applying a credit cycle', () => {
    for (const type of ['debit', 'cash'] as const) {
      const dashboard = createDashboard(type);
      dashboard.displayDate = new Date(2026, 9, 1);
      expect(dashboard.periodSelectorLabel).toBe('Octubre 2026');
      expect(dashboard.periodContextLabel).toBe('Mes calendario');
      expect(dashboard.incomeMonthLabel).toBe('octubre 2026');
      expect(dashboard.incomePeriod).toBe('2026-10');
    }
  });

  it('uses month boundaries for debit and clamps January/February comparison dates', () => {
    const dashboard = createDashboard('debit');
    const january = dashboard.getPeriodDates(new Date(2025, 0, 1));
    const february = dashboard.getPeriodDates(new Date(2025, 1, 1));
    const leapFebruary = dashboard.getPeriodDates(new Date(2024, 1, 1));

    expect(january.startDate).toEqual(new Date(2025, 0, 1));
    expect(january.endDate).toEqual(new Date(2025, 0, 31, 23, 59, 59, 999));
    expect(february.endDate.getDate()).toBe(28);
    expect(leapFebruary.endDate.getDate()).toBe(29);
    expect(dashboard.getPreviousComparableDate(new Date(2025, 2, 31)).toDateString()).toBe(new Date(2025, 1, 28).toDateString());
    expect(dashboard.getPreviousComparableDate(new Date(2024, 2, 31)).toDateString()).toBe(new Date(2024, 1, 29).toDateString());
  });

  it('keeps the prior year when comparing January with the previous calendar month', () => {
    const dashboard = createDashboard('debit');
    expect(dashboard.getPreviousComparableDate(new Date(2025, 0, 1)).toDateString())
      .toBe(new Date(2024, 11, 1).toDateString());
  });

  it('uses adjacent billing windows without gaps for configured start days', () => {
    const dashboard = createDashboard('credit', 19);
    const octoberCycle = dashboard.getPeriodDates(new Date(2026, 8, 1));
    expect(octoberCycle.startDate).toEqual(new Date(2026, 8, 19));
    expect(octoberCycle.endDate).toEqual(new Date(2026, 9, 18, 23, 59, 59, 999));

    dashboard.selectedPaymentMethod.billingCycleDay = 31;
    const februaryCycle = dashboard.getPeriodDates(new Date(2025, 1, 1));
    expect(februaryCycle.startDate).toEqual(new Date(2025, 1, 28));
    expect(februaryCycle.endDate).toEqual(new Date(2025, 2, 30, 23, 59, 59, 999));

    dashboard.selectedPaymentMethod.billingCycleDay = 30;
    dashboard.displayDate = new Date(2025, 2, 1);
    let marchComparison: any;
    dashboard.comparisonRequests$.subscribe((request: any) => marchComparison = request);
    const marchCycle = dashboard.getPeriodDates();
    jasmine.clock().install();
    jasmine.clock().mockDate(new Date(2025, 2, 31));
    dashboard.loadSpendComparison(marchCycle.startDate, marchCycle.endDate);
    jasmine.clock().uninstall();
    expect(marchComparison.previousEnd).toEqual(new Date(2025, 1, 28, 23, 59, 59, 999));
  });

  it('assigns credit installments to the cycle ending on their charge date', () => {
    const schedule = Object.create(InstallmentPurchasesService.prototype);
    const sep19 = { startDate: { toDate: () => new Date(2026, 8, 19) }, paymentDay: 19, totalInstallments: 3 };
    const sep20 = { startDate: { toDate: () => new Date(2026, 8, 20) }, paymentDay: 19, totalInstallments: 3 };
    const oct19 = { startDate: { toDate: () => new Date(2026, 9, 19) }, paymentDay: 19, totalInstallments: 3 };
    const current = { start: new Date(2026, 8, 19), end: new Date(2026, 9, 18, 23, 59, 59, 999) };
    const next = { start: new Date(2026, 9, 19), end: new Date(2026, 10, 18, 23, 59, 59, 999) };

    expect(schedule.getInstallmentInCycle(sep19, current.start, current.end, 'billing-cycle')).toBe(1);
    expect(schedule.getInstallmentInCycle(sep20, current.start, current.end, 'billing-cycle')).toBe(1);
    expect(schedule.getInstallmentInCycle(sep20, next.start, next.end, 'billing-cycle')).toBe(2);
    expect(schedule.getFirstPaymentDate(oct19.startDate.toDate(), 19)).toEqual(new Date(2026, 10, 19));
    expect(schedule.getInstallmentInCycle(oct19, next.start, next.end, 'billing-cycle')).toBe(1);
  });

  it('uses complete ranges for a closed month and aligned cutoffs for an open credit cycle', () => {
    const dashboard = createDashboard('debit');
    const oldPeriod = dashboard.getPeriodDates(new Date(2020, 0, 1));
    let comparison: any;
    dashboard.comparisonRequests$.subscribe((request: any) => comparison = request);
    dashboard.displayDate = new Date(2020, 0, 1);
    dashboard.loadSpendComparison(oldPeriod.startDate, oldPeriod.endDate);
    expect(comparison.currentStart).toEqual(oldPeriod.startDate);
    expect(comparison.currentEnd).toEqual(oldPeriod.endDate);
    expect(comparison.previousStart).toEqual(new Date(2019, 11, 1));
    expect(comparison.previousEnd).toEqual(new Date(2019, 11, 31, 23, 59, 59, 999));

    dashboard.selectedPaymentMethod = { uid: 'synthetic-credit', type: 'credit', billingCycleDay: 19 };
    jasmine.clock().install();
    try {
      jasmine.clock().mockDate(new Date(2026, 9, 1));
      dashboard.displayDate = dashboard.getCurrentPeriodReferenceDate();
      const active = dashboard.getPeriodDates();
      dashboard.loadSpendComparison(active.startDate, active.endDate);
      expect(comparison.currentStart).toEqual(new Date(2026, 8, 19));
      expect(comparison.currentEnd).toEqual(new Date(2026, 9, 1, 23, 59, 59, 999));
      expect(comparison.previousStart).toEqual(new Date(2026, 7, 19));
      expect(comparison.previousEnd).toEqual(new Date(2026, 8, 1, 23, 59, 59, 999));
      expect(comparison.currentPeriodEnd).toEqual(new Date(2026, 9, 18, 23, 59, 59, 999));
      expect(comparison.previousPeriodEnd).toEqual(new Date(2026, 8, 18, 23, 59, 59, 999));

      jasmine.clock().mockDate(new Date(2026, 9, 20));
      dashboard.displayDate = dashboard.getCurrentPeriodReferenceDate();
      const nextCycle = dashboard.getPeriodDates();
      dashboard.loadSpendComparison(nextCycle.startDate, nextCycle.endDate);
      expect(comparison.currentStart).toEqual(new Date(2026, 9, 19));
      expect(comparison.currentEnd).toEqual(new Date(2026, 9, 20, 23, 59, 59, 999));
      expect(comparison.previousEnd).toEqual(new Date(2026, 8, 20, 23, 59, 59, 999));
    } finally {
      jasmine.clock().uninstall();
    }
  });

  it('changing the selected day requests only the daily snapshot and preserves comparison state', () => {
    const dashboard = createDashboard();
    let dailyRequest: any;
    let comparisonRequests = 0;
    dashboard.dailySpendRequests$.subscribe((request: any) => dailyRequest = request);
    dashboard.comparisonRequests$.subscribe(() => comparisonRequests++);
    dashboard.monthToDateSpend = 1200;
    dashboard.previousMonthToDateSpend = 900;
    dashboard.isComparisonLoading = true;
    dashboard.comparisonLoadError = true;
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);

    dashboard.onSpendDateChange(dashboard.toDateInput(yesterday));

    expect(dailyRequest.paymentMethodId).toBe('synthetic-method');
    expect(dailyRequest.date.toDateString()).toBe(yesterday.toDateString());
    expect(comparisonRequests).toBe(0);
    expect(dashboard.monthToDateSpend).toBe(1200);
    expect(dashboard.previousMonthToDateSpend).toBe(900);
    expect(dashboard.isComparisonLoading).toBeTrue();
    expect(dashboard.comparisonLoadError).toBeTrue();
  });

  it('replaces a fixed estimate with its monthly snapshot without changing historical amounts', () => {
    const dashboard = createDashboard('debit');
    dashboard.chartColors = ['#876656'];
    dashboard.prefs = { savingsRate: 20, variableRate: 50 };
    const request = {
      startDate: new Date(2026, 7, 1), endDate: new Date(2026, 7, 31, 23, 59, 59, 999),
      paymentMethodId: 'synthetic-method', incomePeriod: '2026-08'
    };
    const template = { uid: 'light', title: 'Luz', amount: '110000', paymentMethodId: 'synthetic-method' };
    const charge = {
      fixedExpenseId: 'light', title: 'Luz', amount: '100000', period: '2026-08',
      chargeDate: '2026-08-15', paymentMethodId: 'synthetic-method', status: 'confirmed'
    };
    dashboard.applyLoadedData([[], [template], [], [], [], [charge]], request);
    expect(dashboard.total).toBe(100000);
    expect(dashboard.estimatedFixedAmount).toBe(0);
    expect(dashboard.categoryBreakdown[0].amount).toBe(100000);
    dashboard.applyLoadedData([[], [template], [], [], [], [charge]], {
      ...request, incomePeriod: '2026-09', startDate: new Date(2026, 8, 1), endDate: new Date(2026, 8, 30, 23, 59, 59, 999)
    });
    expect(dashboard.total).toBe(110000);
    expect(dashboard.estimatedFixedAmount).toBe(110000);
  });

  it('uses the ending calendar month for fixed estimates in a credit cycle', () => {
    const dashboard = createDashboard('credit');
    dashboard.chartColors = ['#876656'];
    dashboard.prefs = { savingsRate: 20, variableRate: 50 };
    dashboard.periodEndDate = new Date(2026, 8, 19, 23, 59, 59, 999);
    const request = {
      startDate: new Date(2026, 7, 20), endDate: dashboard.periodEndDate,
      paymentMethodId: 'synthetic-method', incomePeriod: '2026-08'
    };
    const templates = [
      { uid: 'light', title: 'Luz', amount: '835399', paymentMethodId: 'synthetic-method' },
      { uid: 'water', title: 'Agua', amount: '40000', paymentMethodId: 'synthetic-method' },
    ];
    const charges = [
      { fixedExpenseId: 'light', title: 'Luz', amount: '752480', period: '2026-09', chargeDate: '2026-09-05', paymentMethodId: 'synthetic-method', status: 'confirmed' },
      { fixedExpenseId: 'water', title: 'Agua', amount: '40000', period: '2026-09', chargeDate: '2026-09-01', paymentMethodId: 'synthetic-method', status: 'skipped' },
    ];

    dashboard.applyLoadedData([[], templates, [], [], [], charges], request);

    expect(dashboard.total).toBe(752480);
    expect(dashboard.estimatedFixedAmount).toBe(0);
    expect(dashboard.fixedExpenseEstimateMonthLabel).toBe('septiembre 2026');
  });

  it('uses the ending calendar year for estimates when a credit cycle crosses New Year', () => {
    const dashboard = createDashboard('credit');
    dashboard.chartColors = ['#876656'];
    dashboard.prefs = { savingsRate: 20, variableRate: 50 };
    const request = {
      startDate: new Date(2026, 11, 20), endDate: new Date(2027, 0, 19, 23, 59, 59, 999),
      paymentMethodId: 'synthetic-method', incomePeriod: '2026-12'
    };
    dashboard.periodEndDate = request.endDate;
    const template = { uid: 'light', title: 'Luz', amount: '100000', paymentMethodId: 'synthetic-method' };
    const charge = {
      fixedExpenseId: 'light', title: 'Luz', amount: '95000', period: '2027-01',
      chargeDate: '2027-01-05', paymentMethodId: 'synthetic-method', status: 'confirmed'
    };

    dashboard.applyLoadedData([[], [template], [], [], [], [charge]], request);

    expect(dashboard.total).toBe(95000);
    expect(dashboard.estimatedFixedAmount).toBe(0);
    expect(dashboard.fixedExpenseEstimateMonthLabel).toBe('enero 2027');
  });

  const createTrackingDashboard = (): any => {
    const dashboard = createDashboard('credit');
    dashboard.loadRequests$ = new Subject();
    dashboard.unsubscribe$ = new Subject();
    dashboard.prefsService = { getPreferences: () => EMPTY };
    dashboard.expensesService = { getAll: jasmine.createSpy('expenses').and.returnValue(of([{ amount: '100' }])) };
    dashboard.fixedExpenseChargesService = { getAll: jasmine.createSpy('charges').and.returnValue(of([])) };
    dashboard.subscriptionsService = { getAll: jasmine.createSpy('subscriptions').and.returnValue(of([{ amount: '9000' }])) };
    dashboard.installmentPurchasesService = { getInstallmentsForCycle: jasmine.createSpy('installments').and.returnValue(of([{ installmentAmount: '5000' }])) };
    dashboard.ngOnInit();
    return dashboard;
  };

  it('daily amount and count query direct expenses only, even when recurring commitments exist', () => {
    const dashboard = createTrackingDashboard();
    dashboard.fixedExpenseChargesService.getAll.and.returnValue(of([{
      fixedExpenseId: 'light', amount: '110000', chargeDate: '2026-10-02', status: 'confirmed'
    }]));
    dashboard.dailySpendRequests$.next({
      date: new Date(2026, 9, 2), paymentMethodId: 'synthetic-method', legacyPaymentMethodId: 'legacy'
    });
    expect(dashboard.spendOnSelectedDate).toBe(100);
    expect(dashboard.spendOnSelectedDateCount).toBe(1);
    expect(dashboard.expensesService.getAll).toHaveBeenCalledOnceWith(
      new Date(2026, 9, 2), new Date(2026, 9, 2, 23, 59, 59, 999), 'synthetic-method', 'legacy'
    );
    expect(dashboard.fixedExpenseChargesService.getAll).not.toHaveBeenCalled();
    expect(dashboard.subscriptionsService.getAll).not.toHaveBeenCalled();
    expect(dashboard.installmentPurchasesService.getInstallmentsForCycle).not.toHaveBeenCalled();
    dashboard.ngOnDestroy();
  });

  it('comparison cuts off direct expenses but includes recurring commitments for the full cycle', () => {
    const dashboard = createTrackingDashboard();
    const request = {
      currentStart: new Date(2026, 8, 19), currentEnd: new Date(2026, 9, 2, 23, 59, 59, 999),
      previousStart: new Date(2026, 7, 19), previousEnd: new Date(2026, 8, 2, 23, 59, 59, 999),
      currentPeriodEnd: new Date(2026, 9, 18, 23, 59, 59, 999),
      previousPeriodEnd: new Date(2026, 8, 18, 23, 59, 59, 999),
      paymentMethodId: 'synthetic-method', legacyPaymentMethodId: 'synthetic-method'
    };
    dashboard.fixedExpenseChargesService.getAll.and.returnValue(of([
      { fixedExpenseId: 'light', amount: '110000', chargeDate: '2026-10-02', status: 'confirmed', paymentMethodId: 'synthetic-method' },
      { fixedExpenseId: 'light', amount: '100000', chargeDate: '2026-09-05', status: 'confirmed' },
      { fixedExpenseId: 'future', amount: '999999', chargeDate: '2026-10-20', status: 'confirmed', paymentMethodId: 'synthetic-method' },
      { fixedExpenseId: 'other', amount: '999999', chargeDate: '2026-10-02', status: 'confirmed', paymentMethodId: 'other-card' },
      { fixedExpenseId: 'skip', amount: '999999', period: '2026-10', chargeDate: '2026-10-02', status: 'skipped', paymentMethodId: 'synthetic-method' }
    ]));
    const schedule = Object.create(InstallmentPurchasesService.prototype);
    const purchase = {
      startDate: { toDate: () => new Date(2026, 7, 25) }, paymentDay: 19,
      totalInstallments: 3, installmentAmount: '5000'
    };
    dashboard.installmentPurchasesService.getInstallmentsForCycle.and.callFake((start: Date, end: Date) =>
      of(schedule.hasPaymentInCycle(purchase, start, end) ? [purchase] : [])
    );
    expect(schedule.hasPaymentInCycle(purchase, request.previousStart, request.previousEnd)).toBeFalse();
    dashboard.comparisonRequests$.next(request);
    expect(dashboard.monthToDateSpend).toBe(124100);
    expect(dashboard.previousMonthToDateSpend).toBe(109100);
    expect(dashboard.expensesService.getAll).toHaveBeenCalledWith(
      request.currentStart, request.currentEnd, 'synthetic-method', 'synthetic-method'
    );
    expect(dashboard.expensesService.getAll).toHaveBeenCalledWith(
      request.previousStart, request.previousEnd, 'synthetic-method', 'synthetic-method'
    );
    expect(dashboard.subscriptionsService.getAll).toHaveBeenCalledOnceWith('synthetic-method', 'synthetic-method');
    expect(dashboard.installmentPurchasesService.getInstallmentsForCycle).toHaveBeenCalledWith(
      request.currentStart, request.currentPeriodEnd, 'synthetic-method', 'synthetic-method', jasmine.any(Date), 'billing-cycle'
    );
    expect(dashboard.installmentPurchasesService.getInstallmentsForCycle).toHaveBeenCalledWith(
      request.previousStart, request.previousPeriodEnd, 'synthetic-method', 'synthetic-method', jasmine.any(Date), 'billing-cycle'
    );
    dashboard.spendDate = '2026-10-01';
    dashboard.loadDailySpend();
    expect(dashboard.monthToDateSpend).toBe(124100);
    expect(dashboard.previousMonthToDateSpend).toBe(109100);
    dashboard.ngOnDestroy();
  });
});
