import { Component, OnDestroy, OnInit, ViewChild, inject } from '@angular/core';
import { Expense, ExpenseCategory, FixedExpense } from '@core/models/expense';
import { Income } from '@core/models/income';
import { InstallmentPurchase } from '@core/models/installment-purchase';
import { Subscription as SubscriptionModel } from '@core/models/subscriptions';
import { UserPreferences, DEFAULT_PREFERENCES } from '@core/models/user-preferences';
import { ExpensesService } from '@core/services/expenses.service';
import { FixedExpensesService } from '@core/services/fixed-expenses.service';
import { IncomesService } from '@core/services/incomes.service';
import { InstallmentPurchasesService } from '@core/services/installment-purchases.service';
import { SubscriptionsService } from '@core/services/subscriptions.service';
import { UserPreferencesService } from '@core/services/user-preferences.service';
import { ChartData, ChartType } from 'chart.js';
import { BaseChartDirective } from 'ng2-charts';
import { EMPTY, Subject, catchError, combineLatest, defer, firstValueFrom, map, of, switchMap, take, takeUntil, timeout } from 'rxjs';
import { PaymentMethod } from '@core/models/payment-method';
import { PaymentMethodsService } from '@core/services/payment-methods.service';

interface CategoryBreakdownItem {
  category: string;
  amount: number;
  percentage: number;
  color: string;
  subcategories: Array<{ name: string; amount: number; installmentAmount: number }>;
}

interface CategoryChartItem {
  category: string;
  amount: number;
  installmentAmount: number;
}

interface DashboardLoadRequest {
  startDate: Date;
  endDate: Date;
  paymentMethodId: string;
  legacyPaymentMethodId?: string;
  incomePeriod: string;
}

type DashboardLoadResult = {
  request: DashboardLoadRequest;
  data: [Expense[], FixedExpense[], SubscriptionModel[], Income[], InstallmentPurchase[]] | null;
};

interface SpendComparisonRequest {
  currentStart: Date; currentEnd: Date; previousStart: Date; previousEnd: Date;
  paymentMethodId: string; legacyPaymentMethodId?: string;
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
  private paymentMethodsService = inject(PaymentMethodsService);
  private unsubscribe$ = new Subject<boolean>();
  private loadRequests$ = new Subject<DashboardLoadRequest | null>();
  private comparisonRequests$ = new Subject<SpendComparisonRequest | null>();
  private dailySpendRequests$ = new Subject<{ date: Date; paymentMethodId: string; legacyPaymentMethodId?: string } | null>();

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
  public adjustedChartTotal = 0;
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
  public paymentMethods: PaymentMethod[] = [];
  public selectedPaymentMethod?: PaymentMethod;
  public excludedCategories: string[] = [];
  public installmentsExcluded = false;
  /** Date used by the daily spending snapshot, stored as YYYY-MM-DD for the native input. */
  public spendDate = this.toDateInput(new Date());
  public spendOnSelectedDate = 0;
  public spendOnSelectedDateCount = 0;
  public monthToDateSpend = 0;
  public previousMonthToDateSpend = 0;
  public isDailySpendLoading = false;
  public dailySpendLoadError = false;
  public isComparisonLoading = false;
  public comparisonLoadError = false;
  public hasSpendComparison = false;
  public comparisonNotStarted = false;
  public comparisonCurrentEnd: Date = new Date();
  public comparisonPreviousEnd: Date = new Date();
  private unfilteredTotal = 0;
  private chartItems: CategoryChartItem[] = [];
  public expandedCategory = '';

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
    this.loadRequests$.pipe(
      switchMap(request => {
        if (!request) return EMPTY;

        return defer(() => combineLatest([
          this.expensesService.getAll(request.startDate, request.endDate, request.paymentMethodId, request.legacyPaymentMethodId),
          this.fixedExpensesService.getAll(request.paymentMethodId, request.legacyPaymentMethodId),
          this.subscriptionsService.getAll(request.paymentMethodId, request.legacyPaymentMethodId),
          this.incomesService.getForPeriod(request.incomePeriod),
          this.installmentPurchasesService.getInstallmentsForCycle(request.startDate, request.endDate, request.paymentMethodId, request.legacyPaymentMethodId),
        ])).pipe(
          take(1),
          timeout(10000),
          map(data => ({ request, data } as DashboardLoadResult)),
          catchError(() => of({ request, data: null } as DashboardLoadResult))
        );
      }),
      takeUntil(this.unsubscribe$)
    ).subscribe(result => {
      if (!result) return;
      if (!result.data) {
        this.isLoading = false;
        this.loadError = true;
        return;
      }

      this.applyLoadedData(result.data, result.request);
    });

    this.comparisonRequests$.pipe(
      switchMap(request => {
        if (!request) return EMPTY;
        return this.expensesService.getAll(request.currentStart, request.currentEnd, request.paymentMethodId, request.legacyPaymentMethodId).pipe(
          take(1), timeout(10000),
          switchMap(current => this.expensesService.getAll(request.previousStart, request.previousEnd, request.paymentMethodId, request.legacyPaymentMethodId).pipe(
            take(1), timeout(10000), map(previous => ({ current, previous }))
          )),
          map(data => ({ data, error: false })), catchError(() => of({ data: null, error: true }))
        );
      }), takeUntil(this.unsubscribe$)
    ).subscribe(result => {
      if (!result) return;
      this.isComparisonLoading = false;
      this.comparisonLoadError = result.error;
      this.hasSpendComparison = !!result.data;
      if (result.data) {
        this.monthToDateSpend = this.sumExpenseAmounts(result.data.current);
        this.previousMonthToDateSpend = this.sumExpenseAmounts(result.data.previous);
      }
    });

    this.dailySpendRequests$.pipe(
      switchMap(request => {
        if (!request) return EMPTY;
        return this.expensesService.getAll(this.startOfDay(request.date), this.endOfDay(request.date), request.paymentMethodId, request.legacyPaymentMethodId).pipe(
          take(1), timeout(10000), map(expenses => ({ expenses, error: false })),
          catchError(() => of({ expenses: null, error: true }))
        );
      }), takeUntil(this.unsubscribe$)
    ).subscribe(result => {
      if (!result) return;
      this.isDailySpendLoading = false;
      this.dailySpendLoadError = result.error;
      if (result.expenses) {
        this.spendOnSelectedDate = this.sumExpenseAmounts(result.expenses);
        this.spendOnSelectedDateCount = result.expenses.length;
      }
    });

    this.prefsService.getPreferences()
      .pipe(take(1))
      .subscribe(async prefs => {
        this.prefs = prefs;
        await this.initializePaymentMethods();
      });
  }

  private getPeriodDates(referenceDate = this.displayDate): { startDate: Date; endDate: Date } {
    const year = referenceDate.getFullYear();
    const month = referenceDate.getMonth();
    if (this.selectedPaymentMethod?.type !== 'credit') {
      return {
        startDate: new Date(year, month, 1, 0, 0, 0, 0),
        endDate: new Date(year, month + 1, 0, 23, 59, 59, 999)
      };
    }
    const cycleDay = this.selectedPaymentMethod.billingCycleDay ?? this.prefs.billingCycleDay ?? 19;

    // The selected month identifies when the statement begins. It must not
    // depend on displayDate's day, because navigation intentionally uses day 1.
    // With a 19th closing date, September is always 20 Sep–19 Oct.
    const daysInStartMonth = new Date(year, month + 1, 0).getDate();
    const startDate = cycleDay >= daysInStartMonth
      ? new Date(year, month + 1, 1, 0, 0, 0, 0)
      : new Date(year, month, cycleDay + 1, 0, 0, 0, 0);
    const endMonthDays = new Date(year, month + 2, 0).getDate();
    const endDate = new Date(year, month + 1, Math.min(cycleDay, endMonthDays), 23, 59, 59, 999);

    return { startDate, endDate };
  }

  loadData(): void {
    if (!this.selectedPaymentMethod?.uid) {
      this.loadRequests$.next(null);
      this.comparisonRequests$.next(null);
      this.isLoading = false;
      this.isComparisonLoading = false;
      this.hasSpendComparison = false;
      this.monthToDateSpend = 0;
      this.previousMonthToDateSpend = 0;
      return;
    }
    const { startDate, endDate } = this.getPeriodDates();
    this.isLoading = true;
    this.loadError = false;
    this.periodStartDate = startDate;
    this.periodEndDate = endDate;
    this.loadRequests$.next({
      startDate,
      endDate,
      paymentMethodId: this.selectedPaymentMethod.uid,
      legacyPaymentMethodId: this.legacyPaymentMethodId,
      incomePeriod: this.incomePeriod
    });
    this.loadSpendComparison(startDate, endDate);
  }

  private applyLoadedData(
    data: NonNullable<DashboardLoadResult['data']>,
    request: DashboardLoadRequest
  ): void {
    const [expenses, fixedExpenses, subscriptions, incomes, installments] = data;
    const totalFixed = fixedExpenses.reduce((acc, e) => acc + +e.amount, 0);
    const totalSubs = subscriptions.reduce((acc, s) => acc + +s.amount, 0);
    const totalInstall = installments.reduce((acc, p) => acc + +p.installmentAmount, 0);
    const totalVar = expenses.reduce((acc, e) => acc + +e.amount, 0);
    const totalInc = incomes.reduce((acc, i) => acc + +i.amount, 0);

    this.totalVariable = totalVar;
    this.totalFixedAndSubs = totalFixed + totalSubs + totalInstall;
    this.variableExpensesCount = expenses.length;
    this.unfilteredTotal = totalVar + totalFixed + totalSubs + totalInstall;
    this.total = this.unfilteredTotal;
    this.totalIncome = totalInc;
    this.activeInstallments = installments;
    this.totalInstallmentsAmount = totalInstall;

    // Compute insights
    this.insights = this.computeInsights(totalInc, totalVar, totalFixed + totalSubs + totalInstall, request.startDate, request.endDate);

    // Build chart data
    const graphData = this.getTotalAmountPerCategory(expenses);
    this.addInstallmentAmounts(graphData, installments);
    if (totalSubs > 0) this.addCategoryAmount(graphData, ExpenseCategory.Subscripciones, totalSubs);
    if (totalFixed > 0) this.addCategoryAmount(graphData, ExpenseCategory['Gasto Fijo'], totalFixed);
    const nonZero = graphData.filter(d => +d.amount > 0);
    const installmentAmounts = this.getInstallmentAmountsByCategory(installments);

    const grouped = new Map<string, { amount: number; installmentAmount: number; subcategories: Map<string, number> }>();
    for (const entry of nonZero) {
      const [category, subcategory] = entry.category.split(' · ', 2);
      const amount = +entry.amount;
      const group = grouped.get(category) || { amount: 0, installmentAmount: 0, subcategories: new Map<string, number>() };
      group.amount += amount;
      group.installmentAmount += installmentAmounts.get(entry.category) || 0;
      const detailName = subcategory || 'Sin subcategoría';
      group.subcategories.set(detailName, (group.subcategories.get(detailName) || 0) + amount);
      grouped.set(category, group);
    }
    this.chartItems = Array.from(grouped, ([category, group]) => ({
      category, amount: group.amount, installmentAmount: group.installmentAmount
    })).sort((a, b) => b.amount - a.amount);
    this.excludedCategories = [];
    this.installmentsExcluded = false;
    this.expandedCategory = '';
    this.updateChartData();

    this.categoryBreakdown = this.chartItems.map((item, i) => ({
      category: item.category,
      amount: item.amount,
      percentage: this.unfilteredTotal > 0 ? (item.amount / this.unfilteredTotal) * 100 : 0,
      color: this.chartColors[i % this.chartColors.length],
      subcategories: Array.from(grouped.get(item.category)?.subcategories ?? [], ([name, amount]) => {
        const label = name === 'Sin subcategoría' ? item.category : `${item.category} · ${name}`;
        return { name, amount, installmentAmount: installmentAmounts.get(label) || 0 };
      })
        .sort((a, b) => b.amount - a.amount)
    }));
    this.updateAdjustedTotal();

    this.isLoading = false;
    this.chart?.update();
  }

  retryLoadData(): void {
    this.loadData();
  }

  onPaymentMethodChange(methodId: string): void {
    const method = this.paymentMethods.find(item => item.uid === methodId);
    if (!method) return;
    this.selectedPaymentMethod = method;
    this.displayDate = this.getCurrentPeriodReferenceDate();
    this.updateDisplayInfo();
    this.loadData();
    this.loadDailySpend();
  }

  get paymentMethodIcon(): string {
    switch (this.selectedPaymentMethod?.type) {
      case 'cash':
        return 'fa-money-bill-wave';
      case 'debit':
        return 'fa-building-columns';
      default:
        return 'fa-credit-card';
    }
  }

  onChartClick(event: { active?: object[] }): void {
    const activeElement = event.active?.[0] as { index?: number } | undefined;
    const category = activeElement?.index === undefined ? undefined : this.doughnutChartData.labels?.[activeElement.index];
    if (typeof category === 'string') this.toggleCategoryDetails(category);
  }

  toggleCategoryDetails(category: string): void {
    this.expandedCategory = this.expandedCategory === category ? '' : category;
  }

  toggleCategoryExclusion(category: string): void {
    const index = this.excludedCategories.indexOf(category);
    this.excludedCategories = index >= 0
      ? this.excludedCategories.filter(item => item !== category)
      : [...this.excludedCategories, category];
    this.updateAdjustedTotal();
    this.updateChartData();
    this.chart?.update();
  }

  clearCategoryExclusion(): void {
    if (!this.hasExclusions) return;
    this.excludedCategories = [];
    this.installmentsExcluded = false;
    this.updateAdjustedTotal();
    this.updateChartData();
    this.chart?.update();
  }

  toggleInstallmentExclusion(): void {
    this.installmentsExcluded = !this.installmentsExcluded;
    this.updateAdjustedTotal();
    this.updateChartData();
    this.chart?.update();
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
        alertMessage = `Tienes margen para reservar el ${this.prefs.savingsRate}% de tus ingresos. Registra tus aportes en Mis metas para seguir el ahorro real.`;
      }
    }

    return {
      netBalance, savingsRate, burnRate, projectedExpenses,
      safeToSpend, dailySafeToSpend, budgetPct,
      alertLevel, alertMessage, daysRemaining,
      savingsTarget, variablesBudget, hasIncome
    };
  }

  /** Calendar month shown in the dashboard, used for monthly income records. */
  get incomePeriod(): string {
    return `${this.displayDate.getFullYear()}-${String(this.displayDate.getMonth() + 1).padStart(2, '0')}`;
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
    const current = this.getCurrentPeriodReferenceDate();
    return this.displayDate.getFullYear() === current.getFullYear() &&
           this.displayDate.getMonth() === current.getMonth();
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

  private getCurrentPeriodReferenceDate(): Date {
    const now = new Date();
    if (this.selectedPaymentMethod?.type !== 'credit') return new Date(now.getFullYear(), now.getMonth(), 1);
    const closingDay = this.selectedPaymentMethod.billingCycleDay ?? this.prefs.billingCycleDay ?? 19;
    const cycleStartMonth = now.getDate() <= closingDay ? now.getMonth() - 1 : now.getMonth();
    return new Date(now.getFullYear(), cycleStartMonth, 1);
  }

  get selectedSpendDateLabel(): string {
    const date = this.parseDateInput(this.spendDate);
    return date ? `${date.getDate()} de ${this.months[date.getMonth()].toLowerCase()}` : 'la fecha seleccionada';
  }

  get selectedSpendMonthLabel(): string {
    const date = this.parseDateInput(this.spendDate);
    return date ? this.months[date.getMonth()].toLowerCase() : 'este mes';
  }

  get maxSpendDate(): string {
    return this.toDateInput(new Date());
  }

  get previousMonthComparisonLabel(): string {
    const date = this.parseDateInput(this.spendDate);
    if (!date) return 'el mismo día del mes anterior';
    const previousDate = this.getPreviousComparableDate(date);
    return `${previousDate.getDate()} de ${this.months[previousDate.getMonth()].toLowerCase()}`;
  }

  get monthToDateDifference(): number {
    return this.monthToDateSpend - this.previousMonthToDateSpend;
  }

  get monthToDateDifferenceLabel(): string {
    if (this.monthToDateDifference === 0) return 'Igual que el mes anterior';
    return this.monthToDateDifference > 0 ? 'Más que el mes anterior' : 'Menos que el mes anterior';
  }

  get isTodaySpendDate(): boolean {
    return this.spendDate === this.toDateInput(new Date());
  }

  get isYesterdaySpendDate(): boolean {
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    return this.spendDate === this.toDateInput(yesterday);
  }

  private get legacyPaymentMethodId(): string | undefined {
    return this.paymentMethods.find(method => method.isDefault)?.uid || this.paymentMethods[0]?.uid;
  }

  private async initializePaymentMethods(): Promise<void> {
    try {
      const defaultMethod = await this.paymentMethodsService.ensureDefault(this.prefs.billingCycleDay);
      const methods = await firstValueFrom(this.paymentMethodsService.getAll());
      this.paymentMethods = methods.filter(method => method.isActive);
      this.selectedPaymentMethod = this.paymentMethods.find(method => method.uid === defaultMethod.uid)
        || this.paymentMethods.find(method => method.isDefault)
        || this.paymentMethods[0];
      this.displayDate = this.getCurrentPeriodReferenceDate();
      this.updateDisplayInfo();
      this.loadData();
      this.loadDailySpend();
    } catch {
      this.loadError = true;
    }
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

  /** Category figures follow the same exclusions and denominator as the chart. */
  get analysisCategoryBreakdown(): CategoryBreakdownItem[] {
    return this.categoryBreakdown.map(item => {
      const isExcluded = this.isCategoryExcluded(item.category);
      const amount = isExcluded
        ? 0
        : Math.max(0, item.amount - (this.installmentsExcluded ? item.subcategories.reduce((sum, entry) => sum + entry.installmentAmount, 0) : 0));
      const subcategories = item.subcategories.map(entry => ({
        ...entry,
        amount: isExcluded ? 0 : Math.max(0, entry.amount - (this.installmentsExcluded ? entry.installmentAmount : 0))
      }));

      return {
        ...item,
        amount,
        percentage: this.adjustedChartTotal > 0 ? (amount / this.adjustedChartTotal) * 100 : 0,
        subcategories
      };
    });
  }

  get excludedCategoryAmount(): number {
    return this.chartItems
      .filter(item => this.isCategoryExcluded(item.category))
      .reduce((total, item) => total + item.amount, 0);
  }

  get excludedInstallmentAmount(): number {
    if (!this.installmentsExcluded) return 0;
    return this.chartItems
      .filter(item => !this.isCategoryExcluded(item.category))
      .reduce((total, item) => total + item.installmentAmount, 0);
  }

  get totalExcludedAmount(): number {
    return this.excludedCategoryAmount + this.excludedInstallmentAmount;
  }

  get hasExclusions(): boolean {
    return this.excludedCategories.length > 0 || this.installmentsExcluded;
  }

  get exclusionSummary(): string {
    const items: string[] = [];
    if (this.excludedCategories.length) {
      items.push(`${this.excludedCategories.length} ${this.excludedCategories.length === 1 ? 'categoría' : 'categorías'}`);
    }
    if (this.installmentsExcluded) items.push('compras en cuotas');
    return items.join(' y ');
  }

  isCategoryExcluded(category: string): boolean {
    return this.excludedCategories.includes(category);
  }

  getCategoryToggleLabel(category: string): string {
    return this.isCategoryExcluded(category)
      ? `Volver a incluir ${category} en el total`
      : `Excluir ${category} del total`;
  }

  getInstallmentCategoryLabel(purchase: InstallmentPurchase): string {
    const category = purchase.category || 'Compras en cuotas';
    return purchase.subcategory ? `${category} · ${purchase.subcategory}` : category;
  }

  get hasExpenses(): boolean {
    return this.unfilteredTotal > 0;
  }

  get variableExpensePct(): number {
    return this.unfilteredTotal > 0 ? (this.totalVariable / this.unfilteredTotal) * 100 : 0;
  }

  get recurringExpensePct(): number {
    return this.unfilteredTotal > 0 ? (this.totalFixedAndSubs / this.unfilteredTotal) * 100 : 0;
  }

  get safeToSpendProgress(): number {
    const budget = this.insights?.variablesBudget ?? 0;
    if (budget <= 0) return 0;
    return Math.min(100, (this.totalVariable / budget) * 100);
  }

  private getTotalAmountPerCategory(expenses: Expense[]): { category: string; amount: string }[] {
    const totals = new Map<string, number>();
    for (const expense of expenses) {
      const label = expense.subcategory ? `${expense.category} · ${expense.subcategory}` : expense.category;
      totals.set(label, (totals.get(label) || 0) + +expense.amount);
    }
    return Array.from(totals, ([category, amount]) => ({ category, amount: String(amount) }));
  }

  private addCategoryAmounts(
    target: { category: string; amount: string }[],
    entries: Array<{ category: string; subcategory?: string; amount: string }>
  ): void {
    for (const entry of entries) {
      const label = entry.subcategory ? `${entry.category} · ${entry.subcategory}` : entry.category;
      this.addCategoryAmount(target, label, +entry.amount);
    }
  }

  /** Adds each due installment to the same category breakdown used by regular expenses. */
  private addInstallmentAmounts(target: { category: string; amount: string }[], purchases: InstallmentPurchase[]): void {
    this.addCategoryAmounts(target, purchases.map(purchase => ({
      // Older records can lack a category. Keep their amount visible and included.
      category: purchase.category || 'Compras en cuotas',
      subcategory: purchase.subcategory,
      amount: purchase.installmentAmount
    })));
  }

  private getInstallmentAmountsByCategory(purchases: InstallmentPurchase[]): Map<string, number> {
    const totals = new Map<string, number>();
    for (const purchase of purchases) {
      const label = this.getInstallmentCategoryLabel(purchase);
      const amount = +purchase.installmentAmount;
      if (Number.isFinite(amount)) totals.set(label, (totals.get(label) || 0) + amount);
    }
    return totals;
  }

  private addCategoryAmount(target: { category: string; amount: string }[], category: string, amount: number): void {
    if (!Number.isFinite(amount) || amount === 0) return;
    const existing = target.find(item => item.category === category);
    if (existing) {
      existing.amount = String(+existing.amount + amount);
      return;
    }
    target.push({ category, amount: String(amount) });
  }

  private updateChartData(): void {
    const visibleItems = this.chartItems.filter(item => !this.isCategoryExcluded(item.category));
    this.doughnutChartData = {
      labels: visibleItems.map(item => item.category),
      datasets: [{
        data: visibleItems.map(item => Math.max(0, item.amount - (this.installmentsExcluded ? item.installmentAmount : 0))),
        backgroundColor: visibleItems.map(item => this.chartColors[this.chartItems.indexOf(item) % this.chartColors.length]),
        borderWidth: 4,
        borderColor: '#ffffff',
        hoverBorderColor: '#ffffff'
      }]
    };
  }

  private updateAdjustedTotal(): void {
    this.adjustedChartTotal = this.chartItems.reduce((sum, item) => {
      if (this.isCategoryExcluded(item.category)) return sum;
      return sum + Math.max(0, item.amount - (this.installmentsExcluded ? item.installmentAmount : 0));
    }, 0);
  }

  onSpendDateChange(value: string): void {
    const date = this.parseDateInput(value);
    const today = this.startOfDay(new Date());
    this.spendDate = !date || date > today ? this.toDateInput(today) : value;
    this.loadDailySpend();
  }

  showTodaySpend(): void {
    this.onSpendDateChange(this.toDateInput(new Date()));
  }

  showYesterdaySpend(): void {
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    this.onSpendDateChange(this.toDateInput(yesterday));
  }

  /**
   * Loads direct expense records for the selected day only. Period comparison
   * is refreshed independently when the dashboard period or payment method changes.
   */
  private loadDailySpend(): void {
    if (!this.selectedPaymentMethod?.uid) return;
    const selectedDate = this.parseDateInput(this.spendDate);
    if (!selectedDate) return;

    this.spendOnSelectedDate = 0;
    this.spendOnSelectedDateCount = 0;
    this.isDailySpendLoading = true;
    this.dailySpendLoadError = false;
    this.dailySpendRequests$.next({ date: selectedDate, paymentMethodId: this.selectedPaymentMethod.uid, legacyPaymentMethodId: this.legacyPaymentMethodId });
  }

  private loadSpendComparison(periodStart: Date, periodEnd: Date): void {
    if (!this.selectedPaymentMethod?.uid) {
      this.comparisonRequests$.next(null);
      this.isComparisonLoading = false;
      this.hasSpendComparison = false;
      this.monthToDateSpend = 0;
      this.previousMonthToDateSpend = 0;
      return;
    }
    const today = this.startOfDay(new Date());
    const isClosedPeriod = periodEnd < today;
    const currentEnd = isClosedPeriod ? periodEnd : new Date(Math.min(today.getTime(), periodEnd.getTime()));
    const previous = this.getPeriodDates(new Date(this.displayDate.getFullYear(), this.displayDate.getMonth() - 1, 1));
    const currentStart = this.startOfDay(periodStart);
    const previousStart = this.startOfDay(previous.startDate);
    let previousEnd = previous.endDate;
    if (!isClosedPeriod) {
      const cutoff = this.getPreviousComparableDate(currentEnd);
      previousEnd = new Date(Math.min(cutoff.getTime(), previous.endDate.getTime()));
    }
    if (currentEnd < currentStart) {
      this.comparisonRequests$.next(null);
      this.isComparisonLoading = false;
      this.hasSpendComparison = false;
      this.comparisonLoadError = false;
      this.comparisonNotStarted = true;
      this.monthToDateSpend = 0;
      this.previousMonthToDateSpend = 0;
      return;
    }
    previousEnd = new Date(Math.max(previousEnd.getTime(), previousStart.getTime()));
    this.monthToDateSpend = 0;
    this.previousMonthToDateSpend = 0;
    this.hasSpendComparison = false;
    this.comparisonLoadError = false;
    this.comparisonNotStarted = false;
    this.isComparisonLoading = true;
    this.comparisonCurrentEnd = currentEnd;
    this.comparisonPreviousEnd = previousEnd;
    this.comparisonRequests$.next({
      currentStart, currentEnd: this.endOfDay(currentEnd), previousStart,
      previousEnd: this.endOfDay(previousEnd), paymentMethodId: this.selectedPaymentMethod.uid,
      legacyPaymentMethodId: this.legacyPaymentMethodId
    });
  }

  get spendComparisonLabel(): string {
    return `${this.formatShortDate(this.periodStartDate)} – ${this.formatShortDate(this.comparisonCurrentEnd, true)}`;
  }

  get previousSpendComparisonLabel(): string {
    const previous = this.getPeriodDates(new Date(this.displayDate.getFullYear(), this.displayDate.getMonth() - 1, 1));
    return `${this.formatShortDate(previous.startDate)} – ${this.formatShortDate(this.comparisonPreviousEnd, true)}`;
  }

  private sumExpenseAmounts(expenses: Expense[]): number {
    return expenses.reduce((total, expense) => total + (+expense.amount || 0), 0);
  }

  private getPreviousComparableDate(date: Date): Date {
    const year = date.getFullYear();
    const previousMonth = date.getMonth() - 1;
    const lastDayOfPreviousMonth = new Date(year, date.getMonth(), 0).getDate();
    return new Date(year, previousMonth, Math.min(date.getDate(), lastDayOfPreviousMonth));
  }

  private parseDateInput(value: string): Date | null {
    const [year, month, day] = value.split('-').map(Number);
    const date = new Date(year, month - 1, day);
    return Number.isInteger(year) && Number.isInteger(month) && Number.isInteger(day)
      && date.getFullYear() === year && date.getMonth() === month - 1 && date.getDate() === day
      ? date
      : null;
  }

  private toDateInput(date: Date): string {
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
  }

  private startOfDay(date: Date): Date {
    return new Date(date.getFullYear(), date.getMonth(), date.getDate(), 0, 0, 0, 0);
  }

  private endOfDay(date: Date): Date {
    return new Date(date.getFullYear(), date.getMonth(), date.getDate(), 23, 59, 59, 999);
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
