import { Component, OnDestroy, OnInit, ViewChild, inject } from '@angular/core';
import { Expense, ExpenseCategory } from '@core/models/expense';
import { InstallmentPurchase } from '@core/models/installment-purchase';
import { UserPreferences, DEFAULT_PREFERENCES } from '@core/models/user-preferences';
import { ExpensesService } from '@core/services/expenses.service';
import { FixedExpensesService } from '@core/services/fixed-expenses.service';
import { IncomesService } from '@core/services/incomes.service';
import { InstallmentPurchasesService } from '@core/services/installment-purchases.service';
import { SubscriptionsService } from '@core/services/subscriptions.service';
import { UserPreferencesService } from '@core/services/user-preferences.service';
import { ChartData, ChartType } from 'chart.js';
import { BaseChartDirective } from 'ng2-charts';
import { Subject, catchError, combineLatest, of, take, timeout } from 'rxjs';

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
  private installmentPurchasesService = inject(InstallmentPurchasesService);
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
  public loadError = false;
  public categoryBreakdown: CategoryBreakdownItem[] = [];
  public insights: DashboardInsights | null = null;
  public prefs: UserPreferences = { ...DEFAULT_PREFERENCES };
  public activeInstallments: InstallmentPurchase[] = [];
  public totalInstallmentsAmount = 0;
  public periodStartDate: Date = new Date();
  public periodEndDate: Date = new Date();

  private readonly chartColors = [
    '#876656', '#00a98f', '#3b82f6', '#b45309',
    '#7c3aed', '#0f766e', '#be123c', '#475569',
    '#c2410c', '#64748b'
  ];

  private readonly months = [
    'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
    'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'
  ];
  private readonly shortMonths = [
    'Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun',
    'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'
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

    // The billing day closes the current statement, so it is included in the
    // period. With a 19th closing date, the current statement runs 20 Aug–19 Sep.
    const isCurrentStatementBeforeClosing = currentDay <= cycleDay;
    const startDate = isCurrentStatementBeforeClosing
      ? new Date(year, month - 1, cycleDay + 1, 0, 0, 0, 0)
      : new Date(year, month, cycleDay + 1, 0, 0, 0, 0);
    const endDate = isCurrentStatementBeforeClosing
      ? new Date(year, month, cycleDay, 23, 59, 59, 999)
      : new Date(year, month + 1, cycleDay, 23, 59, 59, 999);

    return { startDate, endDate };
  }

  loadData(): void {
    const { startDate, endDate } = this.getPeriodDates();
    this.isLoading = true;
    this.loadError = false;
    this.periodStartDate = startDate;
    this.periodEndDate = endDate;

    combineLatest([
      this.expensesService.getAll(startDate, endDate),
      this.fixedExpensesService.getAll(),
      this.subscriptionsService.getAll(),
      this.incomesService.getAll(),
      this.installmentPurchasesService.getInstallmentsForCycle(startDate, endDate),
    ]).pipe(
      take(1),
      timeout(10000),
      catchError(() => {
        this.isLoading = false;
        this.loadError = true;
        return of(null);
      })
    ).subscribe(data => {
      if (!data) return;
      const [expenses, fixedExpenses, subscriptions, incomes, installments] = data;
      const totalFixed = fixedExpenses.reduce((acc, e) => acc + +e.amount, 0);
      const totalSubs = subscriptions.reduce((acc, s) => acc + +s.amount, 0);
      const totalInstall = installments.reduce((acc, p) => acc + +p.installmentAmount, 0);
      const totalVar = expenses.reduce((acc, e) => acc + +e.amount, 0);
      const totalInc = incomes.reduce((acc, i) => acc + +i.amount, 0);

      this.totalVariable = totalVar;
      this.totalFixedAndSubs = totalFixed + totalSubs + totalInstall;
      this.variableExpensesCount = expenses.length;
      this.total = totalVar + totalFixed + totalSubs + totalInstall;
      this.totalIncome = totalInc;
      this.activeInstallments = installments;
      this.totalInstallmentsAmount = totalInstall;

      // Compute insights
      this.insights = this.computeInsights(totalInc, totalVar, totalFixed + totalSubs + totalInstall, startDate, endDate);

      // Build chart data
      const graphData = this.getTotalAmountPerCategory(expenses);
      if (totalSubs > 0) graphData.push({ category: ExpenseCategory.Subscripciones, amount: String(totalSubs) });
      if (totalFixed > 0) graphData.push({ category: ExpenseCategory['Gasto Fijo'], amount: String(totalFixed) });
      if (totalInstall > 0) graphData.push({ category: 'Compras en cuotas' as ExpenseCategory, amount: String(totalInstall) });
      const nonZero = graphData.filter(d => +d.amount > 0);

      this.doughnutChartData = {
        labels: nonZero.map(d => d.category),
        datasets: [{
          data: nonZero.map(d => +d.amount),
          backgroundColor: this.chartColors.slice(0, nonZero.length),
          borderWidth: 4,
          borderColor: '#ffffff',
          hoverBorderColor: '#ffffff'
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

  retryLoadData(): void {
    this.loadData();
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

  getInstallmentNumber(p: InstallmentPurchase): number {
    if (!p.startDate) return 1;
    return this.installmentPurchasesService.getInstallmentInCycle(
      p, this.periodStartDate, this.periodEndDate
    ) ?? 1;
  }

  getRemainingInstallments(p: InstallmentPurchase): number {
    if (!p.startDate) return p.totalInstallments;
    return this.installmentPurchasesService.getRemainingInstallments(
      p.startDate.toDate(), p.paymentDay, p.totalInstallments
    );
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

  get budgetPctClass(): string {
    return this.budgetBarClass.replace('fill', 'pct');
  }

  get netBalanceClass(): string {
    const nb = this.insights?.netBalance ?? 0;
    return nb >= 0 ? 'stat-card__value--positive' : 'stat-card__value--negative';
  }

  get dashboardToneClass(): string {
    return `dashboard-summary--${this.insights?.alertLevel ?? 'ok'}`;
  }

  get periodRangeLabel(): string {
    return `${this.formatShortDate(this.periodStartDate)} - ${this.formatShortDate(this.periodEndDate, true)}`;
  }

  get primaryInsightText(): string {
    if (!this.insights?.hasIncome) {
      return 'Registra ingresos para activar metas, proyecciones y presupuesto disponible.';
    }

    if (this.insights.alertMessage) {
      return this.insights.alertMessage;
    }

    return 'Tu período se mantiene dentro del presupuesto planificado.';
  }

  get topCategory(): CategoryBreakdownItem | null {
    return this.categoryBreakdown[0] ?? null;
  }

  get variableExpensePct(): number {
    return this.total > 0 ? (this.totalVariable / this.total) * 100 : 0;
  }

  get recurringExpensePct(): number {
    return this.total > 0 ? (this.totalFixedAndSubs / this.total) * 100 : 0;
  }

  get safeToSpendProgress(): number {
    const budget = this.insights?.variablesBudget ?? 0;
    if (budget <= 0) return 0;
    return Math.min(100, (this.totalVariable / budget) * 100);
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

  private formatShortDate(date: Date, includeYear = false): string {
    const label = `${date.getDate()} ${this.shortMonths[date.getMonth()]}`;
    return includeYear ? `${label} ${date.getFullYear()}` : label;
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
