import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';

import { IncomesRoutingModule } from './incomes-routing.module';
import { AddIncomesComponent } from './add-incomes/add-incomes.component';
import { IncomesComponent } from './incomes.component';
import { SharedModule } from '@shared/shared.module';


@NgModule({
  declarations: [
    AddIncomesComponent,
    IncomesComponent
  ],
  imports: [
    CommonModule,
    IncomesRoutingModule,
    SharedModule
  ]
})
export class IncomesModule { }
