import { Component, Input, OnChanges, OnDestroy, inject } from '@angular/core';
import { BehaviorSubject, Subject, catchError, combineLatest, map, of, switchMap, takeUntil, tap } from 'rxjs';
import { AuthService } from '@core/services/auth.service';
import { IncomesService } from '@core/services/incomes.service';
import { SavingsGoalsService } from '@core/services/savings-goals.service';
import { SavingsGoal, SavingsTransaction } from '@core/models/savings-goal';
import { Income } from '@core/models/income';
import { getSavingsOverview } from '@core/utils/savings-goals.utils';

export function getPeriodSavings(transactions: SavingsTransaction[], period: string): number {
  return transactions.filter(transaction => transaction.date.slice(0, 7) === period)
    .reduce((total, transaction) => total + (transaction.type === 'contribution' ? transaction.amount : -transaction.amount), 0);
}

@Component({
  selector: 'app-savings-summary',
  templateUrl: './savings-summary.component.html',
  styleUrls: ['./savings-summary.component.scss']
})
export class SavingsSummaryComponent implements OnChanges, OnDestroy {
  @Input() period = '';
  goals: SavingsGoal[] = [];
  balance = 0;
  netContributions = 0;
  suggested = 0;
  isLoading = true;
  loadError = false;
  private savingsService = inject(SavingsGoalsService);
  private incomesService = inject(IncomesService);
  private authService = inject(AuthService);
  private selectedPeriod$ = new BehaviorSubject<string>('');
  private destroyed$ = new Subject<void>();

  constructor() {
    this.selectedPeriod$.pipe(
      switchMap(period => {
        this.isLoading = true;
        this.loadError = false;
        this.goals = [];
        this.balance = this.netContributions = this.suggested = 0;
        return this.authService.isAuthenticated().pipe(
          tap(() => {
            this.isLoading = true;
            this.goals = [];
            this.balance = this.netContributions = this.suggested = 0;
          }),
          switchMap(user => user ? combineLatest([
            this.savingsService.getGoals(),
            this.savingsService.getTransactions(),
            this.incomesService.getForPeriod(period)
          ]) : of<[SavingsGoal[], SavingsTransaction[], Income[]]>([[], [], []])),
          map(([goals, transactions, incomes]) => ({
            goals,
            net: getPeriodSavings(transactions, period),
            overview: getSavingsOverview(goals, incomes.reduce((total, income) => total + (Number(income.amount) || 0), 0))
          })),
          catchError(() => { this.loadError = true; return of(null); })
        );
      }),
      takeUntil(this.destroyed$)
    ).subscribe(result => {
      this.isLoading = false;
      if (!result) return;
      this.goals = result.goals;
      this.balance = result.overview.balance;
      this.suggested = result.overview.suggestedMonthly;
      this.netContributions = result.net;
    });
  }

  ngOnChanges(): void { this.selectedPeriod$.next(this.period); }
  retry(): void { this.selectedPeriod$.next(this.period); }

  get monthLabel(): string {
    const [year, month] = this.period.split('-').map(Number);
    return year && month ? new Date(year, month - 1, 1).toLocaleDateString('es-CL', { month: 'long', year: 'numeric' }) : 'este mes';
  }

  ngOnDestroy(): void {
    this.destroyed$.next();
    this.destroyed$.complete();
  }
}
