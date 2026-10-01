import { Component, EventEmitter, inject, Input, Output, ViewEncapsulation } from '@angular/core';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { Expense, EXPENSE_CATEGORY_OPTIONS } from '@core/models/expense';
import { NgbActiveModal } from '@ng-bootstrap/ng-bootstrap';
import { PaymentMethod } from '@core/models/payment-method';
import { PaymentMethodsService } from '@core/services/payment-methods.service';
import { UserPreferencesService } from '@core/services/user-preferences.service';
import { firstValueFrom } from 'rxjs';

@Component({
  selector: 'app-edit-expense',
  templateUrl: './edit-expense.component.html',
  styleUrls: ['./edit-expense.component.scss'],
  encapsulation: ViewEncapsulation.None
})
export class EditExpenseComponent {
  @Output() editExpense$ = new EventEmitter<Expense>();
  @Output() deleteExpense$ = new EventEmitter<string>();
  @Input() expense!: Expense
  public editExpenseForm!: FormGroup;
  public loading = false
  public activeModal: NgbActiveModal = inject(NgbActiveModal);
  public categoryOptions = EXPENSE_CATEGORY_OPTIONS;
  public confirmingDelete = false;
  public maxCommentLength = 120;
  public paymentMethods: PaymentMethod[] = [];
  private fb: FormBuilder = inject(FormBuilder);
  private paymentMethodsService = inject(PaymentMethodsService);
  private preferencesService = inject(UserPreferencesService);

  constructor() {
    this.editExpenseForm = this.fb.group({
      title: ['', Validators.required],
      amount: ['', Validators.required],
      category: ['', Validators.required],
      subcategory: [''],
      comment: ['', Validators.maxLength(120)],
      paymentMethodId: ['', Validators.required]
    })

  }

  async ngOnInit(): Promise<void> {
    const preferences = await firstValueFrom(this.preferencesService.getPreferences());
    const defaultMethod = await this.paymentMethodsService.ensureDefault(preferences.billingCycleDay);
    const methods = await firstValueFrom(this.paymentMethodsService.getAll());
    // Records created before the migration may have no id; tolerate an old name
    // too, then normalize the form to the Firestore document id on save.
    const selectedMethod = methods.find(method => method.uid === this.expense.paymentMethodId)
      || methods.find(method => method.name === this.expense.paymentMethodId)
      || defaultMethod;
    this.paymentMethods = methods.filter(method => method.isActive || method.uid === selectedMethod.uid);
    this.title?.setValue(this.expense.title);
    this.amount?.setValue(this.expense.amount);
    this.category?.setValue(this.expense.category);
    this.subcategory?.setValue(this.expense.subcategory || '');
    this.comment?.setValue(this.expense.comment);
    this.paymentMethodId?.setValue(selectedMethod.uid);
  }

  submit(): void {
    if (this.editExpenseForm.invalid || this.loading) {
      this.editExpenseForm.markAllAsTouched();
      return;
    }
    this.loading = true;
    const editExpense: Expense = { ...this.expense, ...this.editExpenseForm.value };
    this.editExpense$.emit(editExpense)
    this.activeModal.close();
  }

  delete() {
    if (!this.confirmingDelete) {
      this.confirmingDelete = true;
      return;
    }
    this.loading = true;
    this.deleteExpense$.emit(this.expense.uid);
    this.activeModal.close();
  }

  getCategoryClass(key: string): string {
    return 'category--' + key.toLowerCase().replace(/\s+/g, '-');
  }

  selectCategory(key: string): void {
    this.editExpenseForm.patchValue({ category: key, subcategory: '' });
    this.category?.markAsTouched();
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
  get subcategory() { return this.editExpenseForm.get('subcategory'); }
  get selectedCategory() { return this.categoryOptions.find(option => option.category === this.category?.value); }
  get comment() {
    return this.editExpenseForm.get('comment');
  }
  get paymentMethodId() { return this.editExpenseForm.get('paymentMethodId'); }

}
