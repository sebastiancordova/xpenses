import { Component, EventEmitter, inject, Output, ViewEncapsulation } from '@angular/core';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { Expense, EXPENSE_CATEGORY_OPTIONS } from '@core/models/expense';
import { NgbActiveModal } from '@ng-bootstrap/ng-bootstrap';
import { PaymentMethod } from '@core/models/payment-method';
import { PaymentMethodsService } from '@core/services/payment-methods.service';
import { UserPreferencesService } from '@core/services/user-preferences.service';
import { firstValueFrom } from 'rxjs';

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
  public categoryOptions = EXPENSE_CATEGORY_OPTIONS;
  public maxCommentLength = 120;
  public paymentMethods: PaymentMethod[] = [];
  @Output() newExpense$ = new EventEmitter<Expense>();
  private fb: FormBuilder = inject(FormBuilder);
  private paymentMethodsService = inject(PaymentMethodsService);
  private preferencesService = inject(UserPreferencesService);
  constructor() {
    this.addExpenseForm = this.fb.group({
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
    this.paymentMethods = (await firstValueFrom(this.paymentMethodsService.getAll())).filter(method => method.isActive);
    this.addExpenseForm.patchValue({ paymentMethodId: defaultMethod.uid });
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
    this.addExpenseForm.patchValue({ category: key, subcategory: '' });
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
  get subcategory() { return this.addExpenseForm.get('subcategory'); }
  get selectedCategory() { return this.categoryOptions.find(option => option.category === this.category?.value); }
  get comment() {
    return this.addExpenseForm.get('comment');
  }
  get paymentMethodId() { return this.addExpenseForm.get('paymentMethodId'); }

}
