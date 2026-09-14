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
  public maxCommentLength = 120;
  readonly categoryIcons: Record<string, string> = {
    'Supermercado':    'fa-cart-shopping',
    'Subscripciones':  'fa-tv',
    'Transporte':      'fa-car',
    'Casa':            'fa-house',
    'Cuentas':         'fa-receipt',
    'Entretenimiento': 'fa-film',
    'Otros':           'fa-tag',
    'Ropa':            'fa-shirt',
    'Auto cuidado':    'fa-heart',
    'Gasto Fijo':      'fa-thumbtack',
  };
  @Output() newExpense$ = new EventEmitter<Expense>();
  private fb: FormBuilder = inject(FormBuilder);
  constructor() {
    this.addExpenseForm = this.fb.group({
      title: ['', Validators.required],
      amount: ['', Validators.required],
      category: ['', Validators.required],
      comment: ['', Validators.maxLength(120)]
    })

  }

  ngOnInit(): void {

  }

  submit(): void {
    if (this.addExpenseForm.invalid || this.loading) {
      this.addExpenseForm.markAllAsTouched();
      return;
    }

    this.loading = true;
    const newExpense: Expense = this.addExpenseForm.value;
    this.newExpense$.emit(newExpense)
    this.activeModal.close();
  }

  getCategoryClass(key: string): string {
    return 'category--' + key.toLowerCase().replace(/\s+/g, '-');
  }

  selectCategory(key: string): void {
    this.addExpenseForm.patchValue({ category: key });
    this.category?.markAsTouched();
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
