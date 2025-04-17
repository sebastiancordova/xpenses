import { Component, EventEmitter, inject, Output, ViewEncapsulation } from '@angular/core';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { Expense } from '@core/models/expense';
import { NgbActiveModal } from '@ng-bootstrap/ng-bootstrap';

@Component({
  selector: 'app-add-fixed-expense',
  templateUrl: './add-fixed-expense.component.html',
  styleUrls: ['./add-fixed-expense.component.scss'],
  encapsulation: ViewEncapsulation.None
})
export class AddFixedExpenseComponent {
  public addFixedExpenseForm!: FormGroup;
  public loading = false
  public activeModal: NgbActiveModal = inject(NgbActiveModal);
  @Output() newFixedExpense$ = new EventEmitter<Expense>();
  private fb: FormBuilder = inject(FormBuilder);
  constructor() {
    this.addFixedExpenseForm = this.fb.group({
      title: ['', Validators.required],
      amount: ['', Validators.required]
    })

  }

  ngOnInit(): void {

  }

  submit() {
    this.loading = true;
    const newExpense: Expense = this.addFixedExpenseForm.value;
    this.newFixedExpense$.emit(newExpense)
    this.activeModal.close();
  }

  get title() {
    return this.addFixedExpenseForm.get('title');
  }
  get amount() {
    return this.addFixedExpenseForm.get('amount');
  }
}
