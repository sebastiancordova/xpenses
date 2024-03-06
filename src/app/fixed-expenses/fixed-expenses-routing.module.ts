import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { FixedExpensesComponent } from './fixed-expenses.component';

const routes: Routes = [
  {
    path: '',
    component: FixedExpensesComponent
  }
];

@NgModule({
  imports: [RouterModule.forChild(routes)],
  exports: [RouterModule]
})
export class FixedExpensesRoutingModule { }
