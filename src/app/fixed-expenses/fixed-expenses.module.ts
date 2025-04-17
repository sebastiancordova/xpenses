import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FixedExpensesComponent } from './fixed-expenses.component';
import { FixedExpensesRoutingModule } from './fixed-expenses-routing.module';
import { SharedModule } from '@shared/shared.module';
import { AddFixedExpenseComponent } from './add-fixed-expense/add-fixed-expense.component';
import { EditFixedExpenseComponent } from './edit-fixed-expense/edit-fixed-expense.component';



@NgModule({
  declarations: [
    FixedExpensesComponent,
    AddFixedExpenseComponent,
    EditFixedExpenseComponent
  ],
  imports: [
    FixedExpensesRoutingModule,
    CommonModule,
    SharedModule
  ]
})
export class FixedExpensesModule { }
