import { Component, EventEmitter, inject, Output, ViewEncapsulation } from '@angular/core';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { Income } from '@core/models/income';
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
  @Output() newIncome$ = new EventEmitter<Income>();
  private fb: FormBuilder = inject(FormBuilder);
  constructor() {
    this.addIncomeForm = this.fb.group({
      title: ['', Validators.required],
      amount: ['', Validators.required]
    })

  }

  ngOnInit(): void {

  }

  submit(): void {
    if (this.addIncomeForm.invalid || this.loading) {
      this.addIncomeForm.markAllAsTouched();
      return;
    }

    this.loading = true;
    const newExpense: Income = this.addIncomeForm.value;
    this.newIncome$.emit(newExpense)
    this.activeModal.close();
  }

  get title() {
    return this.addIncomeForm.get('title');
  }
  get amount() {
    return this.addIncomeForm.get('amount');
  }
}
