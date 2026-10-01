import { Component, EventEmitter, Output, ViewEncapsulation, inject } from '@angular/core';
import { NgbActiveModal } from '@ng-bootstrap/ng-bootstrap';

@Component({
  selector: 'app-savings-confirm-action',
  templateUrl: './confirm-action.component.html',
  styleUrls: ['./confirm-action.component.scss'],
  encapsulation: ViewEncapsulation.None
})
export class ConfirmActionComponent {
  public readonly activeModal = inject(NgbActiveModal);
  public title = 'Confirmar acción';
  public message = '';
  public confirmLabel = 'Confirmar';
  public loading = false;
  public error = '';
  @Output() confirmed = new EventEmitter<void>();
}
