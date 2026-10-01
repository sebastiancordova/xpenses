import { CommonModule } from '@angular/common';
import { NgModule } from '@angular/core';
import { SharedModule } from '@shared/shared.module';
import { SavingsGoalsRoutingModule } from './savings-goals-routing.module';
import { SavingsGoalsComponent } from './savings-goals.component';
import { GoalFormComponent } from './goal-form/goal-form.component';
import { TransactionFormComponent } from './transaction-form/transaction-form.component';
import { ConfirmActionComponent } from './confirm-action/confirm-action.component';

@NgModule({
  declarations: [
    SavingsGoalsComponent,
    GoalFormComponent,
    TransactionFormComponent,
    ConfirmActionComponent
  ],
  imports: [CommonModule, SharedModule, SavingsGoalsRoutingModule]
})
export class SavingsGoalsModule { }
