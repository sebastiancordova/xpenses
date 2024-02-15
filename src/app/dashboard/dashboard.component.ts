import { Component, ViewChild, inject } from '@angular/core';
import { Expense, ExpenseCategory } from '@core/models/expense';
import { ExpensesService } from '@core/services/expenses.service';
import { ChartData, ChartType } from 'chart.js';
import { BaseChartDirective } from 'ng2-charts';
import { Subject, takeUntil } from 'rxjs';

@Component({
  selector: 'app-dashboard',
  templateUrl: './dashboard.component.html',
  styleUrls: ['./dashboard.component.scss']
})
export class DashboardComponent {
  @ViewChild(BaseChartDirective) chart: BaseChartDirective | undefined;
  private expensesService: ExpensesService = inject(ExpensesService);
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

    this.expensesService.getAll().pipe(takeUntil(this.unsubscribe$))
      .subscribe((expenses) => {
        this.total = expenses.reduce((acc, expense) => acc + +expense.amount, 0);

        const graphData = this.getTotalAmountperCategory(expenses)
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
