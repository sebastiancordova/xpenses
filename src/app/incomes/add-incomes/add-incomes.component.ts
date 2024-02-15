import { Component, inject, ViewEncapsulation } from '@angular/core';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { NgbActiveModal } from '@ng-bootstrap/ng-bootstrap';

@Component({
  selector: 'app-add-incomes',
  templateUrl: './add-incomes.component.html',
  styleUrls: ['./add-incomes.component.scss'],
  encapsulation: ViewEncapsulation.None
})
export class AddIncomesComponent {
  public addIncomeForm!: FormGroup;
  public loading = false
  public activeModal: NgbActiveModal = inject(NgbActiveModal);
  private fb: FormBuilder = inject(FormBuilder);
  constructor() {
      this.addIncomeForm = this.fb.group({
          start: ['', Validators.required],
          end: ['', Validators.required],
          guard: ['', Validators.required]
      })

  }

  ngOnInit(): void {

  }

  submit() {

      this.activeModal.close();
  }

  get start() {
      return this.addIncomeForm.get('start');
  }
  get end() {
      return this.addIncomeForm.get('end');
  }
  get guard() {
      return this.addIncomeForm.get('guard');
  }
}
