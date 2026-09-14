import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { InstallmentPurchasesComponent } from './installment-purchases.component';
import { InstallmentPurchasesRoutingModule } from './installment-purchases-routing.module';
import { SharedModule } from '@shared/shared.module';
import { AddInstallmentPurchaseComponent } from './add-installment-purchase/add-installment-purchase.component';
import { EditInstallmentPurchaseComponent } from './edit-installment-purchase/edit-installment-purchase.component';

@NgModule({
  declarations: [
    InstallmentPurchasesComponent,
    AddInstallmentPurchaseComponent,
    EditInstallmentPurchaseComponent
  ],
  imports: [
    InstallmentPurchasesRoutingModule,
    CommonModule,
    SharedModule
  ]
})
export class InstallmentPurchasesModule { }
