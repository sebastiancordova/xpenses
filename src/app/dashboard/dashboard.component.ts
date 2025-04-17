import { Component, ViewChild, inject } from '@angular/core';
import { Expense, ExpenseCategory } from '@core/models/expense';
import { ExpensesService } from '@core/services/expenses.service';
import { FixedExpensesService } from '@core/services/fixed-expenses.service';
import { IncomesService } from '@core/services/incomes.service';
import { SubscriptionsService } from '@core/services/subscriptions.service';
import { ChartData, ChartType } from 'chart.js';
import { BaseChartDirective } from 'ng2-charts';
import { Subject, takeUntil, combineLatestWith } from 'rxjs';

@Component({
  selector: 'app-dashboard',
  templateUrl: './dashboard.component.html',
  styleUrls: ['./dashboard.component.scss']
})
export class DashboardComponent {
  @ViewChild(BaseChartDirective) chart: BaseChartDirective | undefined;
  private expensesService: ExpensesService = inject(ExpensesService);
  private fixedExpensesService: FixedExpensesService = inject(FixedExpensesService);
  private incomesService: IncomesService = inject(IncomesService);
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
  ngOnInit(): void {
    const combined = this.expensesService.getAll().pipe(combineLatestWith(this.fixedExpensesService.getAll(), this.subscriptionsService.getAll()));
    combined.pipe(takeUntil(this.unsubscribe$))
      .subscribe(([expenses, fixedExpenses, subscriptions]) => {
        console.log(subscriptions)
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

  ngOnDestroy() {
    this.unsubscribe$.next(true);
    this.unsubscribe$.unsubscribe();
  }
}
