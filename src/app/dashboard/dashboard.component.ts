import { Component, ViewChild, inject } from '@angular/core';
import { Expense, ExpenseCategory } from '@core/models/expense';
import { ExpensesService } from '@core/services/expenses.service';
import { FixedExpensesService } from '@core/services/fixed-expenses.service';
import { SubscriptionsService } from '@core/services/subscriptions.service';
import { ChartData, ChartType } from 'chart.js';
import { BaseChartDirective } from 'ng2-charts';
import { Subject, combineLatestWith, take } from 'rxjs';

@Component({
  selector: 'app-dashboard',
  templateUrl: './dashboard.component.html',
  styleUrls: ['./dashboard.component.scss']
})
export class DashboardComponent {
  @ViewChild(BaseChartDirective) chart: BaseChartDirective | undefined;
  private expensesService: ExpensesService = inject(ExpensesService);
  private fixedExpensesService: FixedExpensesService = inject(FixedExpensesService);
  private subscriptionsService: SubscriptionsService = inject(SubscriptionsService);
  private unsubscribe$ = new Subject<boolean>();
  public doughnutChartLabels!: string[];
  public doughnutChartData: ChartData<'doughnut'> = {
    labels: [],
    datasets: [
      { data: [] }
    ]
  };
  public doughnutChartType: ChartType = 'doughnut';
  public barChartOptions: any = {
    scaleShowVerticalLines: false,
    responsive: true,
    scaleShowValues: true,
    maintainAspectRatio: false
  };
  public total = 0;
  private months = ["Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio",
    "Julio", "Agosto", "Septiembere", "Octubre", "Noviembre", "Diciembre"];
  public selectedMonth = new Date().getMonth();
  public displayMonthName = this.months[this.selectedMonth];
  public displayYear: number = new Date().getFullYear();
  private displayDate: Date = new Date();

  ngOnInit(): void {
    this.loadExpenses();
  }

  loadExpenses() {
    const year = this.displayDate.getFullYear();
    const month = this.displayDate.getMonth();
    const currentDay = this.displayDate.getDate();
    let startDate: Date;
    let endDate: Date;

    if (currentDay >= 19) {
      startDate = new Date(year, month, 19, 0, 0, 0, 0);
      endDate = new Date(year, month + 1, 18, 23, 59, 59, 999);
    } else {
      startDate = new Date(year, month - 1, 19, 0, 0, 0, 0);
      endDate = new Date(year, month, 18, 23, 59, 59, 999);
    }

    const combined = this.expensesService.getAll(startDate, endDate).pipe(combineLatestWith(this.fixedExpensesService.getAll(), this.subscriptionsService.getAll()));
    combined.pipe(take(1))
      .subscribe(([expenses, fixedExpenses, subscriptions]) => {
        const totalFixedExpenses = fixedExpenses.reduce((acc, expense) => acc + +expense.amount, 0);
        const totalSubscriptions = subscriptions.reduce((acc, subscription) => acc + +subscription.amount, 0);
        this.total = expenses.reduce((acc, expense) => acc + +expense.amount, 0) + totalFixedExpenses + totalSubscriptions;

        const graphData = this.getTotalAmountperCategory(expenses)
        graphData.push({ category: ExpenseCategory.Subscripciones, amount: '' + totalSubscriptions })
        graphData.push({ category: ExpenseCategory['Gasto Fijo'], amount: '' + totalFixedExpenses })
        this.doughnutChartData.labels = graphData.map(expense => expense.category);
        this.doughnutChartData.datasets[0].data = graphData.map(expense => +expense.amount);
        this.chart?.update();
      });
  }

  getTotalAmountperCategory(expenses: Expense[]) {
    const categories = Object.entries(ExpenseCategory);
    const graphData: {
      category: ExpenseCategory;
      amount: string;
    }[] = [];
    for (const category of categories) {
      for (const expense of expenses) {
        if (category[0] === expense.category) {
          let index = graphData.findIndex(data => data.category === category[0]);
          if (index >= 0) {
            graphData[index].amount = +graphData[index].amount + +expense.amount + ' ';
          } else
            graphData.push({ category: category[0], amount: expense.amount });
        }
      }

    }
    return graphData;
  }

  private updateDisplayInfo() {
    const monthIndex = this.displayDate.getMonth();
    this.displayMonthName = this.months[monthIndex];
    this.displayYear = this.displayDate.getFullYear();
  }

  goToPreviousMonth() {
    this.displayDate.setMonth(this.displayDate.getMonth() - 1);
    this.displayDate = new Date(this.displayDate);
    this.updateDisplayInfo();
    this.loadExpenses();
  }

  goToNextMonth() {
    this.displayDate.setMonth(this.displayDate.getMonth() + 1);
    this.displayDate = new Date(this.displayDate);
    this.updateDisplayInfo();
    this.loadExpenses();
  }

  ngOnDestroy() {
    this.unsubscribe$.next(true);
    this.unsubscribe$.unsubscribe();
  }
}
