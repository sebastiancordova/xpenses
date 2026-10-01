import { Component, EventEmitter, inject, Input, OnInit, Output, ViewEncapsulation } from '@angular/core';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { Timestamp } from '@angular/fire/firestore';
import { NgbActiveModal } from '@ng-bootstrap/ng-bootstrap';
import { InstallmentPurchase } from '@core/models/installment-purchase';
import { EXPENSE_CATEGORY_OPTIONS } from '@core/models/expense';
import { InstallmentPurchasesService } from '@core/services/installment-purchases.service';
import { PaymentMethod } from '@core/models/payment-method';
import { PaymentMethodsService } from '@core/services/payment-methods.service';
import { UserPreferencesService } from '@core/services/user-preferences.service';
import { firstValueFrom } from 'rxjs';

@Component({
  selector: 'app-edit-installment-purchase',
  templateUrl: './edit-installment-purchase.component.html',
  styleUrls: ['./edit-installment-purchase.component.scss'],
  encapsulation: ViewEncapsulation.None
})
export class EditInstallmentPurchaseComponent implements OnInit {
  @Input() purchase!: InstallmentPurchase;
  @Output() editInstallmentPurchase$ = new EventEmitter<InstallmentPurchase>();
  @Output() deleteInstallmentPurchase$ = new EventEmitter<string>();

  public form!: FormGroup;
  public loading = false;
  public confirmingDelete = false;
  public paymentMethods: PaymentMethod[] = [];
  public activeModal = inject(NgbActiveModal);
  public categoryOptions = EXPENSE_CATEGORY_OPTIONS;
  private fb = inject(FormBuilder);
  private service = inject(InstallmentPurchasesService);
  private paymentMethodsService = inject(PaymentMethodsService);
  private preferencesService = inject(UserPreferencesService);


  constructor() {
    this.form = this.fb.group({
      title: ['', Validators.required],
      installmentAmount: ['', Validators.required],
      totalInstallments: [12, [Validators.required, Validators.min(2), Validators.max(120)]],
      category: ['', Validators.required],
      subcategory: [''],
      startDate: ['', Validators.required],
      paymentMethodId: ['', Validators.required],
    });
  }

  async ngOnInit(): Promise<void> {
    const preferences = await firstValueFrom(this.preferencesService.getPreferences());
    const defaultMethod = await this.paymentMethodsService.ensureDefault(preferences.billingCycleDay);
    this.paymentMethods = (await firstValueFrom(this.paymentMethodsService.getAll())).filter(method => method.type === 'credit' && (method.isActive || method.uid === this.purchase.paymentMethodId));
    const startDate = this.purchase.startDate?.toDate();
    this.form.patchValue({
      title: this.purchase.title,
      installmentAmount: this.purchase.installmentAmount,
      totalInstallments: this.purchase.totalInstallments,
      category: this.purchase.category,
      subcategory: this.purchase.subcategory || '',
      startDate: startDate ? this.formatDateForInput(startDate) : '',
      paymentMethodId: this.purchase.paymentMethodId || defaultMethod.uid,
    });
  }

  getCategoryClass(key: string): string {
    return 'category--' + key.toLowerCase().replace(/\s+/g, '-');
  }

  selectCategory(key: string): void {
    this.form.patchValue({ category: key, subcategory: '' });
    this.category?.markAsTouched();
  }

  toggleStatus(): void {
    if (this.form.invalid || this.loading) {
      this.form.markAllAsTouched();
      return;
    }
    const newStatus = this.purchase.status === 'active' ? 'completed' : 'active';
    const updated = this.buildUpdatedPurchase(newStatus);
    this.editInstallmentPurchase$.emit(updated);
    this.activeModal.close();
  }

  submit(): void {
    if (this.form.invalid || this.loading) {
      this.form.markAllAsTouched();
      return;
    }
    this.loading = true;
    const updated = this.buildUpdatedPurchase();
    this.editInstallmentPurchase$.emit(updated);
    this.activeModal.close();
  }

  delete(): void {
    if (!this.confirmingDelete) {
      this.confirmingDelete = true;
      return;
    }
    this.loading = true;
    this.deleteInstallmentPurchase$.emit(this.purchase.uid);
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

  get selectedPaymentDay(): number {
    return this.paymentMethods.find(method => method.uid === this.paymentMethodId?.value)?.billingCycleDay || this.purchase.paymentDay;
  }

  get startDateDisplay(): string {
    const value = this.startDate?.value;
    return value ? this.toLocalDate(value).toLocaleDateString('es-CL') : '';
  }

  get upcomingInstallmentDisplay(): number {
    const value = this.startDate?.value;
    if (!value) return 0;
    return this.service.getUpcomingInstallment(
      this.toLocalDate(value), this.selectedPaymentDay, +this.totalInstallments?.value
    );
  }

  get remainingInstallmentsDisplay(): number {
    const value = this.startDate?.value;
    if (!value) return 0;
    return this.service.getRemainingInstallments(
      this.toLocalDate(value), this.selectedPaymentDay, +this.totalInstallments?.value
    );
  }

  private buildUpdatedPurchase(status = this.purchase.status): InstallmentPurchase {
    const { startDate, ...values } = this.form.value;
    return {
      ...this.purchase,
      ...values,
      totalInstallments: +values.totalInstallments,
      installmentAmount: String(values.installmentAmount),
      startDate: Timestamp.fromDate(this.toLocalDate(startDate)),
      status,
    };
  }

  private formatDateForInput(date: Date): string {
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${date.getFullYear()}-${month}-${day}`;
  }

  private toLocalDate(value: string): Date {
    const [year, month, day] = value.split('-').map(Number);
    return new Date(year, month - 1, day);
  }
}
