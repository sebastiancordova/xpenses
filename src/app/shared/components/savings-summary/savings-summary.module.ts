import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { SavingsSummaryComponent } from './savings-summary.component';

@NgModule({
  declarations: [SavingsSummaryComponent],
  imports: [CommonModule, RouterModule],
  exports: [SavingsSummaryComponent]
})
export class SavingsSummaryModule {}
