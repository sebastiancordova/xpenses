import { Component, EventEmitter, inject, OnInit, Output, ViewEncapsulation } from '@angular/core';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { Timestamp } from '@angular/fire/firestore';
import { NgbActiveModal } from '@ng-bootstrap/ng-bootstrap';
import { InstallmentPurchase } from '@core/models/installment-purchase';
import { ExpenseCategory } from '@core/models/expense';
import { UserPreferencesService } from '@core/services/user-preferences.service';
import { take } from 'rxjs';

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
  public activeModal = inject(NgbActiveModal);
  public expenseCategory = ExpenseCategory;
  @Output() newInstallmentPurchase$ = new EventEmitter<InstallmentPurchase>();
  private fb = inject(FormBuilder);
  private preferences = inject(UserPreferencesService);

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
    const today = new Date();
    const todayStr = today.toISOString().split('T')[0];
    this.form = this.fb.group({
      title: ['', Validators.required],
      installmentAmount: ['', Validators.required],
      totalInstallments: [12, [Validators.required, Validators.min(2), Validators.max(120)]],
      category: ['', Validators.required],
      startDate: [todayStr, Validators.required],
    });
  }

  ngOnInit(): void {
    this.preferences.getPreferences().pipe(take(1)).subscribe(preferences => {
      this.billingCycleDay = preferences.billingCycleDay;
    });
  }

  getCategoryClass(key: string): string {
    return 'category--' + key.toLowerCase().replace(/\s+/g, '-');
  }

  selectCategory(key: string): void {
    this.form.patchValue({ category: key });
    this.category?.markAsTouched();
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
      category: val.category as ExpenseCategory,
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
  get startDate() { return this.form.get('startDate'); }
}
