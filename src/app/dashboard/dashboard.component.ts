import { Component, OnDestroy, OnInit, ViewChild, inject } from '@angular/core';
import { Expense, ExpenseCategory } from '@core/models/expense';
import { UserPreferences, DEFAULT_PREFERENCES } from '@core/models/user-preferences';
import { ExpensesService } from '@core/services/expenses.service';
import { FixedExpensesService } from '@core/services/fixed-expenses.service';
import { IncomesService } from '@core/services/incomes.service';
import { SubscriptionsService } from '@core/services/subscriptions.service';
import { UserPreferencesService } from '@core/services/user-preferences.service';
import { ChartData, ChartType } from 'chart.js';
import { BaseChartDirective } from 'ng2-charts';
import { Subject, combineLatest, take } from 'rxjs';

interface CategoryBreakdownItem {
  category: string;
  amount: number;
  percentage: number;
  color: string;
}

export interface DashboardInsights {
  netBalance: number;
  savingsRate: number;
  burnRate: number;
  projectedExpenses: number;
  safeToSpend: number;
  dailySafeToSpend: number;
  budgetPct: number;
  alertLevel: 'ok' | 'warn' | 'danger';
  alertMessage: string;
  daysRemaining: number;
  savingsTarget: number;
  variablesBudget: number;
  hasIncome: boolean;
}

@Component({
  selector: 'app-dashboard',
  templateUrl: './dashboard.component.html',
  styleUrls: ['./dashboard.component.scss']
})
export class DashboardComponent implements OnInit, OnDestroy {
  @ViewChild(BaseChartDirective) chart: BaseChartDirective | undefined;

  private expensesService = inject(ExpensesService);
  private fixedExpensesService = inject(FixedExpensesService);
  private subscriptionsService = inject(SubscriptionsService);
  private incomesService = inject(IncomesService);
  private prefsService = inject(UserPreferencesService);
  private unsubscribe$ = new Subject<boolean>();

  public doughnutChartData: ChartData<'doughnut'> = {
    labels: [],
    datasets: [{ data: [], backgroundColor: [] }]
  };
  public doughnutChartType: ChartType = 'doughnut';
  public chartOptions: any = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { display: false },
      tooltip: {
        callbacks: {
          label: (ctx: any) => ` ${ctx.label}: $${ctx.parsed.toLocaleString('es-CL')}`
        }
      }
    },
    cutout: '65%'
  };

  // Core totals
  public total = 0;
  public totalVariable = 0;
  public totalFixedAndSubs = 0;
  public totalIncome = 0;
  public variableExpensesCount = 0;
  public isLoading = false;
  public categoryBreakdown: CategoryBreakdownItem[] = [];
  public insights: DashboardInsights | null = null;
  public prefs: UserPreferences = { ...DEFAULT_PREFERENCES };

  private readonly chartColors = [
    '#876656', '#BD9988', '#00C9AA', '#e8a87c',
    '#a8d8ea', '#aa96da', '#fcbad3', '#f7c59f',
    '#6d9fe0', '#c8d0d7'
  ];

  private readonly months = [
    'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
    'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'
  ];

  public displayMonthName = this.months[new Date().getMonth()];
  public displayYear: number = new Date().getFullYear();
  private displayDate: Date = new Date();

  ngOnInit(): void {
    this.prefsService.getPreferences()
      .pipe(take(1))
      .subscribe(prefs => {
        this.prefs = prefs;
        console.log('Loaded preferences:', prefs);
        this.loadData();
      });
  }

  private getPeriodDates(): { startDate: Date; endDate: Date } {
    const year = this.displayDate.getFullYear();
    const month = this.displayDate.getMonth();
    const currentDay = this.displayDate.getDate();
    const cycleDay = this.prefs.billingCycleDay ?? 19;

    const startDate = currentDay >= cycleDay
      ? new Date(year, month, cycleDay, 0, 0, 0, 0)
      : new Date(year, month - 1, cycleDay, 0, 0, 0, 0);
    const endDate = currentDay >= cycleDay
      ? new Date(year, month + 1, cycleDay - 1, 23, 59, 59, 999)
      : new Date(year, month, cycleDay - 1, 23, 59, 59, 999);

    return { startDate, endDate };
  }

  loadData(): void {
    const { startDate, endDate } = this.getPeriodDates();
    this.isLoading = true;

    combineLatest([
      this.expensesService.getAll(startDate, endDate),
      this.fixedExpensesService.getAll(),
      this.subscriptionsService.getAll(),
      this.incomesService.getAll(),
    ]).pipe(take(1)).subscribe(([expenses, fixedExpenses, subscriptions, incomes]) => {
      const totalFixed = fixedExpenses.reduce((acc, e) => acc + +e.amount, 0);
      const totalSubs = subscriptions.reduce((acc, s) => acc + +s.amount, 0);
      const totalVar = expenses.reduce((acc, e) => acc + +e.amount, 0);
      const totalInc = incomes.reduce((acc, i) => acc + +i.amount, 0);

      this.totalVariable = totalVar;
      this.totalFixedAndSubs = totalFixed + totalSubs;
      this.variableExpensesCount = expenses.length;
      this.total = totalVar + totalFixed + totalSubs;
      this.totalIncome = totalInc;

      // Compute insights
      this.insights = this.computeInsights(totalInc, totalVar, totalFixed + totalSubs, startDate, endDate);

      // Build chart data
      const graphData = this.getTotalAmountPerCategory(expenses);
      if (totalSubs > 0) graphData.push({ category: ExpenseCategory.Subscripciones, amount: String(totalSubs) });
      if (totalFixed > 0) graphData.push({ category: ExpenseCategory['Gasto Fijo'], amount: String(totalFixed) });
      const nonZero = graphData.filter(d => +d.amount > 0);

      this.doughnutChartData = {
        labels: nonZero.map(d => d.category),
        datasets: [{
          data: nonZero.map(d => +d.amount),
          backgroundColor: this.chartColors.slice(0, nonZero.length),
          borderWidth: 3,
          borderColor: '#f9fafc',
          hoverBorderColor: '#f9fafc'
        }]
      };

      this.categoryBreakdown = nonZero
        .map((d, i) => ({
          category: d.category,
          amount: +d.amount,
          percentage: this.total > 0 ? (+d.amount / this.total) * 100 : 0,
          color: this.chartColors[i % this.chartColors.length]
        }))
        .sort((a, b) => b.amount - a.amount);

      this.isLoading = false;
      this.chart?.update();
    });
  }

  private computeInsights(
    totalIncome: number,
    totalVariable: number,
    totalRecurring: number,
    periodStart: Date,
    periodEnd: Date
  ): DashboardInsights {
    const periodMs = periodEnd.getTime() - periodStart.getTime();
    const daysInPeriod = Math.max(Math.round(periodMs / (1000 * 60 * 60 * 24)), 1);
    const today = new Date();
    const msElapsed = Math.max(today.getTime() - periodStart.getTime(), 0);
    const daysElapsed = Math.max(Math.floor(msElapsed / (1000 * 60 * 60 * 24)), 1);
    const daysRemaining = Math.max(daysInPeriod - daysElapsed, 0);
    const totalExpenses = totalVariable + totalRecurring;
    const burnRate = daysElapsed > 0 ? totalVariable / daysElapsed : 0;
    const projectedExpenses = (burnRate * daysInPeriod) + totalRecurring;
    const hasIncome = totalIncome > 0;

    const netBalance = totalIncome - totalExpenses;
    const savingsTarget = totalIncome * (this.prefs.savingsRate / 100);
    const variablesBudget = totalIncome * (this.prefs.variableRate / 100);
    const safeToSpend = Math.max(0, variablesBudget - totalVariable);
    const dailySafeToSpend = daysRemaining > 0 ? safeToSpend / daysRemaining : 0;
    const budgetPct = totalIncome > 0 ? (totalExpenses / totalIncome) * 100 : 0;

    let savingsRate = 0;
    let alertLevel: 'ok' | 'warn' | 'danger' = 'ok';
    let alertMessage = '';

    if (totalIncome > 0) {
      savingsRate = Math.max(0, Math.min(100, (netBalance / totalIncome) * 100));

      if (projectedExpenses > totalIncome * 1.05) {
        alertLevel = 'danger';
        const overage = Math.round(projectedExpenses - totalIncome).toLocaleString('es-CL');
        alertMessage = `Al ritmo actual proyectas gastar $${overage} más que tu ingreso este período`;
      } else if (projectedExpenses > totalIncome * 0.85) {
        alertLevel = 'warn';
        alertMessage = `Proyección cercana a tu ingreso — queda poco margen para ahorro`;
      } else if (netBalance >= savingsTarget && savingsTarget > 0) {
        alertMessage = `¡Vas bien! Ya superaste tu meta de ahorro del ${this.prefs.savingsRate}%`;
      }
    }

    return {
      netBalance, savingsRate, burnRate, projectedExpenses,
      safeToSpend, dailySafeToSpend, budgetPct,
      alertLevel, alertMessage, daysRemaining,
      savingsTarget, variablesBudget, hasIncome
    };
  }

  get isCurrentMonth(): boolean {
    const now = new Date();
    return this.displayDate.getFullYear() === now.getFullYear() &&
           this.displayDate.getMonth() === now.getMonth();
  }

  get budgetBarClass(): string {
    const pct = this.insights?.budgetPct ?? 0;
    if (pct >= 90) return 'budget-bar__fill--danger';
    if (pct >= 70) return 'budget-bar__fill--warn';
    return 'budget-bar__fill--ok';
  }

  get netBalanceClass(): string {
    const nb = this.insights?.netBalance ?? 0;
    return nb >= 0 ? 'stat-card__value--positive' : 'stat-card__value--negative';
  }

  private getTotalAmountPerCategory(expenses: Expense[]): { category: ExpenseCategory; amount: string }[] {
    const graphData: { category: ExpenseCategory; amount: string }[] = [];
    for (const [key] of Object.entries(ExpenseCategory)) {
      for (const expense of expenses) {
        if (key === expense.category) {
          const index = graphData.findIndex(d => d.category === key);
          if (index >= 0) {
            graphData[index].amount = String(+graphData[index].amount + +expense.amount);
          } else {
            graphData.push({ category: key as ExpenseCategory, amount: expense.amount });
          }
        }
      }
    }
    return graphData;
  }

  private updateDisplayInfo(): void {
    this.displayMonthName = this.months[this.displayDate.getMonth()];
    this.displayYear = this.displayDate.getFullYear();
  }

  goToPreviousMonth(): void {
    this.displayDate = new Date(this.displayDate.getFullYear(), this.displayDate.getMonth() - 1, 1);
    this.updateDisplayInfo();
    this.loadData();
  }

  goToNextMonth(): void {
    if (this.isCurrentMonth) return;
    this.displayDate = new Date(this.displayDate.getFullYear(), this.displayDate.getMonth() + 1, 1);
    this.updateDisplayInfo();
    this.loadData();
  }

  ngOnDestroy(): void {
    this.unsubscribe$.next(true);
    this.unsubscribe$.unsubscribe();
  }
}
