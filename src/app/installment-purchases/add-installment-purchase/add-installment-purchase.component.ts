import { Component, EventEmitter, inject, OnInit, Output, ViewEncapsulation } from '@angular/core';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { Timestamp } from '@angular/fire/firestore';
import { NgbActiveModal } from '@ng-bootstrap/ng-bootstrap';
import { InstallmentPurchase } from '@core/models/installment-purchase';
import { EXPENSE_CATEGORY_OPTIONS } from '@core/models/expense';
import { UserPreferencesService } from '@core/services/user-preferences.service';
import { firstValueFrom } from 'rxjs';
import { PaymentMethod } from '@core/models/payment-method';
import { PaymentMethodsService } from '@core/services/payment-methods.service';

@Component({
  selector: 'app-add-installment-purchase',
  templateUrl: './add-installment-purchase.component.html',
  styleUrls: ['./add-installment-purchase.component.scss'],
  encapsulation: ViewEncapsulation.None
})
export class AddInstallmentPurchaseComponent implements OnInit {
  public form!: FormGroup;
  public loading = false;
  public billingCycleDay = 19;
  public paymentMethods: PaymentMethod[] = [];
  public activeModal = inject(NgbActiveModal);
  public categoryOptions = EXPENSE_CATEGORY_OPTIONS;
  @Output() newInstallmentPurchase$ = new EventEmitter<InstallmentPurchase>();
  private fb = inject(FormBuilder);
  private preferences = inject(UserPreferencesService);
  private paymentMethodsService = inject(PaymentMethodsService);


  constructor() {
    const today = new Date();
    const todayStr = today.toISOString().split('T')[0];
    this.form = this.fb.group({
      title: ['', Validators.required],
      installmentAmount: ['', Validators.required],
      totalInstallments: [12, [Validators.required, Validators.min(2), Validators.max(120)]],
      category: ['', Validators.required],
      subcategory: [''],
      startDate: [todayStr, Validators.required],
      paymentMethodId: ['', Validators.required],
    });
  }

  async ngOnInit(): Promise<void> {
    const preferences = await firstValueFrom(this.preferences.getPreferences());
    const defaultMethod = await this.paymentMethodsService.ensureDefault(preferences.billingCycleDay);
    this.paymentMethods = (await firstValueFrom(this.paymentMethodsService.getAll())).filter(method => method.isActive && method.type === 'credit');
    const selected = this.paymentMethods.find(method => method.uid === defaultMethod.uid) || this.paymentMethods[0];
    if (selected) {
      this.form.patchValue({ paymentMethodId: selected.uid });
      this.billingCycleDay = selected.billingCycleDay || preferences.billingCycleDay;
    }
  }

  getCategoryClass(key: string): string {
    return 'category--' + key.toLowerCase().replace(/\s+/g, '-');
  }

  selectCategory(key: string): void {
    this.form.patchValue({ category: key, subcategory: '' });
    this.category?.markAsTouched();
  }

  updatePaymentMethod(): void {
    const selected = this.paymentMethods.find(method => method.uid === this.paymentMethodId?.value);
    if (selected?.billingCycleDay) this.billingCycleDay = selected.billingCycleDay;
  }

  submit(): void {
    if (this.form.invalid || this.loading) {
      this.form.markAllAsTouched();
      return;
    }
    this.loading = true;
    const val = this.form.value;
    const [y, m, d] = (val.startDate as string).split('-').map(Number);
    const purchase: InstallmentPurchase = {
      title: val.title,
      installmentAmount: String(val.installmentAmount),
      totalInstallments: +val.totalInstallments,
      currentInstallment: 1,
      startDate: Timestamp.fromDate(new Date(y, m - 1, d)),
      paymentDay: this.billingCycleDay,
      paymentMethodId: val.paymentMethodId,
      category: val.category,
      subcategory: val.subcategory || undefined,
      status: 'active',
      createdAt: Timestamp.now(),
      updatedAt: Timestamp.now(),
    };
    this.newInstallmentPurchase$.emit(purchase);
    this.activeModal.close();
  }

  get title() { return this.form.get('title'); }
  get installmentAmount() { return this.form.get('installmentAmount'); }
  get totalInstallments() { return this.form.get('totalInstallments'); }
  get category() { return this.form.get('category'); }
  get subcategory() { return this.form.get('subcategory'); }
  get selectedCategory() { return this.categoryOptions.find(option => option.category === this.category?.value); }
  get startDate() { return this.form.get('startDate'); }
  get paymentMethodId() { return this.form.get('paymentMethodId'); }
}
