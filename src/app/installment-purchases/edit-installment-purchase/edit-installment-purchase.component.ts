import { Component, EventEmitter, inject, Input, OnInit, Output, ViewEncapsulation } from '@angular/core';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { Timestamp } from '@angular/fire/firestore';
import { NgbActiveModal } from '@ng-bootstrap/ng-bootstrap';
import { InstallmentPurchase } from '@core/models/installment-purchase';
import { ExpenseCategory } from '@core/models/expense';
import { InstallmentPurchasesService } from '@core/services/installment-purchases.service';

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
  public activeModal = inject(NgbActiveModal);
  public expenseCategory = ExpenseCategory;
  private fb = inject(FormBuilder);
  private service = inject(InstallmentPurchasesService);

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

  constructor() {
    this.form = this.fb.group({
      title: ['', Validators.required],
      installmentAmount: ['', Validators.required],
      totalInstallments: [12, [Validators.required, Validators.min(2), Validators.max(120)]],
      category: ['', Validators.required],
      startDate: ['', Validators.required],
    });
  }

  ngOnInit(): void {
    const startDate = this.purchase.startDate?.toDate();
    this.form.patchValue({
      title: this.purchase.title,
      installmentAmount: this.purchase.installmentAmount,
      totalInstallments: this.purchase.totalInstallments,
      category: this.purchase.category,
      startDate: startDate ? this.formatDateForInput(startDate) : '',
    });
  }

  getCategoryClass(key: string): string {
    return 'category--' + key.toLowerCase().replace(/\s+/g, '-');
  }

  selectCategory(key: string): void {
    this.form.patchValue({ category: key });
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
  get startDate() { return this.form.get('startDate'); }

  get startDateDisplay(): string {
    const value = this.startDate?.value;
    return value ? this.toLocalDate(value).toLocaleDateString('es-CL') : '';
  }

  get upcomingInstallmentDisplay(): number {
    const value = this.startDate?.value;
    if (!value) return 0;
    return this.service.getUpcomingInstallment(
      this.toLocalDate(value), this.purchase.paymentDay, +this.totalInstallments?.value
    );
  }

  get remainingInstallmentsDisplay(): number {
    const value = this.startDate?.value;
    if (!value) return 0;
    return this.service.getRemainingInstallments(
      this.toLocalDate(value), this.purchase.paymentDay, +this.totalInstallments?.value
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
