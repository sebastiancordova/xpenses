import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { InstallmentPurchasesComponent } from './installment-purchases.component';

const routes: Routes = [
  {
    path: '',
    component: InstallmentPurchasesComponent
  }
];

@NgModule({
  imports: [RouterModule.forChild(routes)],
  exports: [RouterModule]
})
export class InstallmentPurchasesRoutingModule { }
