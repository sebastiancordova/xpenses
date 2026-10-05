import { Component, EventEmitter, inject, Input, Output, ViewEncapsulation } from '@angular/core';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { FixedExpense } from '@core/models/expense';
import { NgbActiveModal } from '@ng-bootstrap/ng-bootstrap';
import { PaymentMethod } from '@core/models/payment-method';
import { PaymentMethodsService } from '@core/services/payment-methods.service';
import { UserPreferencesService } from '@core/services/user-preferences.service';
import { firstValueFrom } from 'rxjs';

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
  public confirmDelete = false;
  public activeModal: NgbActiveModal = inject(NgbActiveModal);
  public paymentMethods: PaymentMethod[] = [];

  private fb: FormBuilder = inject(FormBuilder);
  private paymentMethodsService = inject(PaymentMethodsService);
  private preferencesService = inject(UserPreferencesService);
  constructor() {
    this.editFixedExpenseForm = this.fb.group({
      title: ['', Validators.required],
      amount: ['', [Validators.required, Validators.pattern(/^\d+$/), Validators.min(1), Validators.max(Number.MAX_SAFE_INTEGER)]],
      paymentMethodId: ['', Validators.required]
    })

  }

  async ngOnInit(): Promise<void> {
    const preferences = await firstValueFrom(this.preferencesService.getPreferences());
    const defaultMethod = await this.paymentMethodsService.ensureDefault(preferences.billingCycleDay);
    const methods = await firstValueFrom(this.paymentMethodsService.getAll());
    const selectedMethod = methods.find(method => method.uid === this.fixedExpense.paymentMethodId)
      || methods.find(method => method.name === this.fixedExpense.paymentMethodId)
      || defaultMethod;
    this.paymentMethods = methods.filter(method => method.isActive || method.uid === selectedMethod.uid);
    this.title?.setValue(this.fixedExpense.title);
    this.amount?.setValue(this.fixedExpense.amount);
    this.paymentMethodId?.setValue(selectedMethod.uid);
  }

  submit(): void {
    if (this.editFixedExpenseForm.invalid || this.loading) {
      this.editFixedExpenseForm.markAllAsTouched();
      return;
    }
    this.loading = true;
    const editFixedExpense: FixedExpense = { ...this.fixedExpense, ...this.editFixedExpenseForm.value };
    this.editFixedExpense$.emit(editFixedExpense)
    this.activeModal.close();
  }

  delete() {
    if (!this.confirmDelete) { this.confirmDelete = true; return; }
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
  get paymentMethodId() { return this.editFixedExpenseForm.get('paymentMethodId'); }
}
