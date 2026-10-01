import { getPeriodSavings, SavingsSummaryComponent } from './savings-summary.component';
import { SavingsTransaction } from '@core/models/savings-goal';
import { TestBed } from '@angular/core/testing';
import { BehaviorSubject, of, throwError } from 'rxjs';
import { AuthService } from '@core/services/auth.service';
import { IncomesService } from '@core/services/incomes.service';
import { SavingsGoalsService } from '@core/services/savings-goals.service';
import { Income } from '@core/models/income';

describe('Dashboard savings period', () => {
  const ledger = [
    { date: '2026-09-01', type: 'contribution', amount: 10000 },
    { date: '2026-09-30', type: 'withdrawal', amount: 2000 },
    { date: '2026-10-01', type: 'contribution', amount: 5000 }
  ] as SavingsTransaction[];
  it('uses the selected calendar month, not the current month or card cycle', () => {
    expect(getPeriodSavings(ledger, '2026-09')).toBe(8000);
    expect(getPeriodSavings(ledger, '2026-10')).toBe(5000);
  });
  it('does not invent contributions for an empty month', () => {
    expect(getPeriodSavings(ledger, '2026-08')).toBe(0);
  });
});

describe('Global dashboard savings summary', () => {
  let component: SavingsSummaryComponent;
  let authenticated$: BehaviorSubject<{ uid: string } | null>;
  let incomeReads: jasmine.Spy;
  let goalReads: jasmine.Spy;

  beforeEach(() => {
    authenticated$ = new BehaviorSubject<{ uid: string } | null>({ uid: 'synthetic-owner' });
    incomeReads = jasmine.createSpy().and.callFake((period: string) =>
      of([{ amount: period === '2026-09' ? '100000' : '200000' }] as Income[]));
    goalReads = jasmine.createSpy().and.returnValue(of([]));
    TestBed.configureTestingModule({
      providers: [
        { provide: AuthService, useValue: { isAuthenticated: () => authenticated$ } },
        { provide: IncomesService, useValue: { getForPeriod: incomeReads } },
        { provide: SavingsGoalsService, useValue: {
          getGoals: goalReads,
          getTransactions: () => of([
            { date: '2026-09-01', type: 'contribution', amount: 15000 },
            { date: '2026-10-01', type: 'withdrawal', amount: 2000 }
          ] as SavingsTransaction[])
        } }
      ]
    });
    component = TestBed.runInInjectionContext(() => new SavingsSummaryComponent());
  });

  afterEach(() => component.ngOnDestroy());

  it('recalculates selected month without a payment-method input', () => {
    component.period = '2026-09';
    component.ngOnChanges();
    expect(component.netContributions).toBe(15000);
    component.period = '2026-10';
    component.ngOnChanges();
    expect(component.netContributions).toBe(-2000);
    expect(incomeReads).toHaveBeenCalledWith('2026-10');
  });

  it('clears savings after signout', () => {
    component.period = '2026-09';
    component.ngOnChanges();
    authenticated$.next(null);
    expect(component.netContributions).toBe(0);
    expect(component.balance).toBe(0);
    expect(component.goals).toEqual([]);
  });

  it('shows an error instead of stale results and supports retry', () => {
    goalReads.and.returnValue(throwError(() => new Error('synthetic offline')));
    component.retry();
    expect(component.loadError).toBeTrue();
    expect(component.isLoading).toBeFalse();
    expect(component.netContributions).toBe(0);
    goalReads.and.returnValue(of([]));
    component.retry();
    expect(component.loadError).toBeFalse();
  });
});
