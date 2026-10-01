import { Subject } from 'rxjs';
import { DashboardComponent } from './dashboard.component';

describe('DashboardComponent period comparison', () => {
  const createDashboard = (type: 'credit' | 'debit' = 'debit', billingCycleDay = 19): any => {
    const dashboard = Object.create(DashboardComponent.prototype);
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

  it('uses adjacent billing cycles and avoids day overflow for a closing day of 31', () => {
    const dashboard = createDashboard('credit', 19);
    const octoberCycle = dashboard.getPeriodDates(new Date(2026, 8, 1));
    expect(octoberCycle.startDate).toEqual(new Date(2026, 8, 20));
    expect(octoberCycle.endDate).toEqual(new Date(2026, 9, 19, 23, 59, 59, 999));

    dashboard.selectedPaymentMethod.billingCycleDay = 31;
    const februaryCycle = dashboard.getPeriodDates(new Date(2025, 1, 1));
    expect(februaryCycle.startDate).toEqual(new Date(2025, 2, 1));
    expect(februaryCycle.endDate).toEqual(new Date(2025, 2, 31, 23, 59, 59, 999));

    dashboard.selectedPaymentMethod.billingCycleDay = 30;
    dashboard.displayDate = new Date(2025, 2, 1);
    let marchComparison: any;
    dashboard.comparisonRequests$.subscribe((request: any) => marchComparison = request);
    const marchCycle = dashboard.getPeriodDates();
    jasmine.clock().install();
    jasmine.clock().mockDate(new Date(2025, 2, 31));
    dashboard.loadSpendComparison(marchCycle.startDate, marchCycle.endDate);
    jasmine.clock().uninstall();
    expect(marchComparison.previousEnd).toEqual(new Date(2025, 2, 1, 23, 59, 59, 999));
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
      expect(comparison.currentStart).toEqual(new Date(2026, 8, 20));
      expect(comparison.currentEnd).toEqual(new Date(2026, 9, 1, 23, 59, 59, 999));
      expect(comparison.previousStart).toEqual(new Date(2026, 7, 20));
      expect(comparison.previousEnd).toEqual(new Date(2026, 8, 1, 23, 59, 59, 999));

      jasmine.clock().mockDate(new Date(2026, 9, 20));
      dashboard.displayDate = dashboard.getCurrentPeriodReferenceDate();
      const nextCycle = dashboard.getPeriodDates();
      dashboard.loadSpendComparison(nextCycle.startDate, nextCycle.endDate);
      expect(comparison.currentStart).toEqual(new Date(2026, 9, 20));
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
});
