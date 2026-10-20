import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';

import { DashboardRoutingModule } from './dashboard-routing.module';
import { DashboardComponent } from './dashboard.component';
import { BaseChartDirective, provideCharts, withDefaultRegisterables } from 'ng2-charts';
import { SavingsSummaryModule } from '@shared/components/savings-summary/savings-summary.module';


@NgModule({
  declarations: [
    DashboardComponent
  ],
  imports: [
    CommonModule,
    DashboardRoutingModule,
    BaseChartDirective,
    SavingsSummaryModule
  ],
  providers: [provideCharts(withDefaultRegisterables())]
})
export class DashboardModule { }
