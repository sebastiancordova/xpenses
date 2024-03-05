import { Component, EventEmitter, inject, Output, ViewEncapsulation } from '@angular/core';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { Expense, ExpenseCategory } from '@core/models/expense';
import { NgbActiveModal } from '@ng-bootstrap/ng-bootstrap';

@Component({
  selector: 'app-add-expense',
  templateUrl: './add-expense.component.html',
  styleUrls: ['./add-expense.component.scss'],
  encapsulation: ViewEncapsulation.None
})
export class AddExpenseComponent {
  public addExpenseForm!: FormGroup;
  public loading = false
  public activeModal: NgbActiveModal = inject(NgbActiveModal);
  public expenseCategory = ExpenseCategory;
  @Output() newExpense$ = new EventEmitter<Expense>();
  private fb: FormBuilder = inject(FormBuilder);
  constructor() {
    this.addExpenseForm = this.fb.group({
      title: ['', Validators.required],
      amount: ['', Validators.required],
      category: ['', Validators.required],
      comment: ['']
    })

  }

  ngOnInit(): void {

  }

  submit() {
    this.loading = true;
    const newExpense: Expense = this.addExpenseForm.value;
    this.newExpense$.emit(newExpense)
    this.activeModal.close();
  }

  get title() {
    return this.addExpenseForm.get('title');
  }
  get amount() {
    return this.addExpenseForm.get('amount');
  }
  get category() {
    return this.addExpenseForm.get('category');
  }
  get comment() {
    return this.addExpenseForm.get('comment');
  }

}
