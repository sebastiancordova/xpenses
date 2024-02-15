import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { NgbModalModule, NgbPaginationModule, NgbPopoverModule } from '@ng-bootstrap/ng-bootstrap';
import { ReactiveFormsModule } from '@angular/forms';



@NgModule({
  declarations: [],
  imports: [
    CommonModule,
    NgbModalModule,
    NgbPaginationModule,
    ReactiveFormsModule
  ],
  exports: [
    NgbModalModule,
    NgbPaginationModule,
    NgbPopoverModule,
    ReactiveFormsModule
  ]
})
export class SharedModule { }
