import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { NgbModalModule, NgbPaginationModule, NgbPopoverModule, NgbDatepickerModule } from '@ng-bootstrap/ng-bootstrap';
import { ReactiveFormsModule } from '@angular/forms';
import { RangeDateSelectorComponent } from './components/range-date-selector/range-date-selector.component';



@NgModule({
  declarations: [RangeDateSelectorComponent],
  imports: [
    CommonModule,
    NgbModalModule,
    NgbPaginationModule,
    ReactiveFormsModule,
    NgbDatepickerModule
  ],
  exports: [
    NgbModalModule,
    NgbPaginationModule,
    NgbPopoverModule,
    ReactiveFormsModule,
    NgbDatepickerModule,
    RangeDateSelectorComponent
  ]
})
export class SharedModule { }
