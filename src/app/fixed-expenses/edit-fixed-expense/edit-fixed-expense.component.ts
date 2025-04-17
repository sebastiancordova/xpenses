import { Component, EventEmitter, inject, Input, Output, ViewEncapsulation } from '@angular/core';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { Expense, FixedExpense } from '@core/models/expense';
import { NgbActiveModal } from '@ng-bootstrap/ng-bootstrap';

@Component({
  selector: 'app-edit-fixed-expense',
  templateUrl: './edit-fixed-expense.component.html',
  styleUrls: ['./edit-fixed-expense.component.scss'],
  encapsulation: ViewEncapsulation.None
})
export class EditFixedExpenseComponent {
  @Output() editFixedExpense$ = new EventEmitter<FixedExpense>();
  @Output() deleteFixedExpense$ = new EventEmitter<string>();
  @Input() fixedExpense!: FixedExpense
  public editFixedExpenseForm!: FormGroup;
  public loading = false
  public activeModal: NgbActiveModal = inject(NgbActiveModal);

  private fb: FormBuilder = inject(FormBuilder);
  constructor() {
    this.editFixedExpenseForm = this.fb.group({
      title: ['', Validators.required],
      amount: ['', Validators.required]
    })

  }

  ngOnInit(): void {
    this.title?.setValue(this.fixedExpense.title);
    this.amount?.setValue(this.fixedExpense.amount);
  }

  submit() {
    this.loading = true;
    const editFixedExpense: Expense = { ...this.fixedExpense, ...this.editFixedExpenseForm.value };
    this.editFixedExpense$.emit(editFixedExpense)
    this.activeModal.close();
  }

  delete() {
    this.loading = true;
    this.deleteFixedExpense$.emit(this.fixedExpense.uid);
    this.activeModal.close();
  }

  get title() {
    return this.editFixedExpenseForm.get('title');
  }
  get amount() {
    return this.editFixedExpenseForm.get('amount');
  }
}
