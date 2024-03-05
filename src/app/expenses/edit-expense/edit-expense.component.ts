import { ChangeDetectionStrategy, Component, EventEmitter, inject, Input, Output, ViewEncapsulation } from '@angular/core';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { Expense, ExpenseCategory } from '@core/models/expense';
import { NgbActiveModal } from '@ng-bootstrap/ng-bootstrap';

@Component({
  selector: 'app-edit-expense',
  templateUrl: './edit-expense.component.html',
  styleUrls: ['./edit-expense.component.scss'],
  encapsulation: ViewEncapsulation.None,
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class EditExpenseComponent {
  @Output() editExpense$ = new EventEmitter<Expense>();
  @Output() deleteExpense$ = new EventEmitter<string>();
  @Input() expense!: Expense
  public editExpenseForm!: FormGroup;
  public loading = false
  public activeModal: NgbActiveModal = inject(NgbActiveModal);
  public expenseCategory = ExpenseCategory;
  private fb: FormBuilder = inject(FormBuilder);

  constructor() {
    this.editExpenseForm = this.fb.group({
      title: ['', Validators.required],
      amount: ['', Validators.required],
      category: ['', Validators.required],
      comment: ['']
    })

  }

  ngOnInit(): void {
    console.log(this.expense);
    this.title?.setValue(this.expense.title);
    this.amount?.setValue(this.expense.amount);
    this.category?.setValue(this.expense.category);
    this.comment?.setValue(this.expense.comment);
  }

  submit() {
    this.loading = true;
    const editExpense: Expense = { ...this.expense, ...this.editExpenseForm.value };
    this.editExpense$.emit(editExpense)
    this.activeModal.close();
  }

  delete() {
    this.loading = true;
    this.deleteExpense$.emit(this.expense.uid);
    this.activeModal.close();
  }

  get title() {
    return this.editExpenseForm.get('title');
  }
  get amount() {
    return this.editExpenseForm.get('amount');
  }
  get category() {
    return this.editExpenseForm.get('category');
  }
  get comment() {
    return this.editExpenseForm.get('comment');
  }

}
