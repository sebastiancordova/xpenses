import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ExpensesComponent } from './expenses.component';
import { ExpensesRoutingModule } from './expenses-routing.module';
import { SharedModule } from '@shared/shared.module';
import { AddExpenseComponent } from './add-expense/add-expense.component';



@NgModule({
  declarations: [
    ExpensesComponent,
    AddExpenseComponent
  ],
  imports: [
    CommonModule,
    ExpensesRoutingModule,
    SharedModule
  ]
})
export class ExpensesModule { }
