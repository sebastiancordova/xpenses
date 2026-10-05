import { Component, EventEmitter, inject, Output, ViewEncapsulation } from '@angular/core';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { Expense } from '@core/models/expense';
import { NgbActiveModal } from '@ng-bootstrap/ng-bootstrap';
import { PaymentMethod } from '@core/models/payment-method';
import { PaymentMethodsService } from '@core/services/payment-methods.service';
import { UserPreferencesService } from '@core/services/user-preferences.service';
import { firstValueFrom } from 'rxjs';

@Component({
  selector: 'app-add-fixed-expense',
  templateUrl: './add-fixed-expense.component.html',
  styleUrls: ['./add-fixed-expense.component.scss'],
  encapsulation: ViewEncapsulation.None
})
export class AddFixedExpenseComponent {
  public addFixedExpenseForm!: FormGroup;
  public loading = false
  public activeModal: NgbActiveModal = inject(NgbActiveModal);
  public paymentMethods: PaymentMethod[] = [];
  @Output() newFixedExpense$ = new EventEmitter<Expense>();
  private fb: FormBuilder = inject(FormBuilder);
  private paymentMethodsService = inject(PaymentMethodsService);
  private preferencesService = inject(UserPreferencesService);
  constructor() {
    this.addFixedExpenseForm = this.fb.group({
      title: ['', Validators.required],
      amount: ['', [Validators.required, Validators.pattern(/^\d+$/), Validators.min(1), Validators.max(Number.MAX_SAFE_INTEGER)]],
      paymentMethodId: ['', Validators.required]
    })

  }

  async ngOnInit(): Promise<void> {
    const preferences = await firstValueFrom(this.preferencesService.getPreferences());
    const defaultMethod = await this.paymentMethodsService.ensureDefault(preferences.billingCycleDay);
    this.paymentMethods = (await firstValueFrom(this.paymentMethodsService.getAll())).filter(method => method.isActive);
    this.addFixedExpenseForm.patchValue({ paymentMethodId: defaultMethod.uid });
  }

  submit(): void {
    if (this.addFixedExpenseForm.invalid || this.loading) {
      this.addFixedExpenseForm.markAllAsTouched();
      return;
    }

    this.loading = true;
    const newExpense: Expense = this.addFixedExpenseForm.value;
    this.newFixedExpense$.emit(newExpense)
    this.activeModal.close();
  }

  get title() {
    return this.addFixedExpenseForm.get('title');
  }
  get amount() {
    return this.addFixedExpenseForm.get('amount');
  }
  get paymentMethodId() { return this.addFixedExpenseForm.get('paymentMethodId'); }
}
