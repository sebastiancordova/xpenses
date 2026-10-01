import { Component, ElementRef, EventEmitter, Input, Output, ViewChild, ViewEncapsulation, inject } from '@angular/core';
import { AbstractControl, FormBuilder, FormGroup, ValidationErrors, Validators } from '@angular/forms';
import { SavingsGoal, SavingsTransactionType } from '@core/models/savings-goal';
import { isSavingsDate } from '@core/utils/savings-goals.utils';
import { NgbActiveModal } from '@ng-bootstrap/ng-bootstrap';

export interface TransactionSubmission {
  type: SavingsTransactionType;
  amount: number;
  date: string;
  note?: string;
  requestId: string;
}

@Component({
  selector: 'app-savings-transaction-form',
  templateUrl: './transaction-form.component.html',
  styleUrls: ['./transaction-form.component.scss'],
  encapsulation: ViewEncapsulation.None
})
export class TransactionFormComponent {
  private initialFocusApplied = false;
  @ViewChild('transactionAmount') set transactionAmountInput(input: ElementRef<HTMLInputElement> | undefined) {
    if (!input || this.initialFocusApplied) return;
    this.initialFocusApplied = true;
    input.nativeElement.focus();
  }
  private goalValue?: SavingsGoal;
  private typeValue: SavingsTransactionType = 'contribution';
  @Input() set goal(value: SavingsGoal | undefined) {
    this.goalValue = value;
    this.refreshAmountValidation();
  }
  get goal(): SavingsGoal | undefined { return this.goalValue; }
  @Input() set type(value: SavingsTransactionType) {
    this.typeValue = value;
    this.refreshAmountValidation();
  }
  get type(): SavingsTransactionType { return this.typeValue; }
  @Output() submitted = new EventEmitter<TransactionSubmission>();

  public readonly activeModal = inject(NgbActiveModal);
  public readonly form: FormGroup;
  public loading = false;
  public error = '';
  public readonly today = this.localDate(new Date());
  private readonly fb = inject(FormBuilder);
  private requestId = this.createRequestId();
  private requestFingerprint = '';

  constructor() {
    this.form = this.fb.group({
      amount: ['', [Validators.required, Validators.pattern(/^\d+$/), Validators.min(1), this.safeIntegerValidator, this.withdrawalBalanceValidator]],
      date: [this.localDate(new Date()), [Validators.required, this.notFutureDateValidator]],
      note: ['', Validators.maxLength(120)]
    });
  }

  submit(): void {
    if (this.loading || !this.goal) return;
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }
    const amount = Number(this.form.value.amount);
    if (this.type === 'withdrawal' && amount > this.goal.balance) {
      this.form.get('amount')?.setErrors({ exceedsBalance: true });
      this.form.get('amount')?.markAsTouched();
      return;
    }
    const note = String(this.form.value.note || '').trim();
    const date = String(this.form.value.date);
    const fingerprint = JSON.stringify([this.type, amount, date, note]);
    if (fingerprint !== this.requestFingerprint) {
      this.requestId = this.createRequestId();
      this.requestFingerprint = fingerprint;
    }
    this.submitted.emit({
      type: this.type,
      amount,
      date,
      ...(note ? { note } : {}),
      requestId: this.requestId
    });
  }

  get title(): string { return this.type === 'contribution' ? 'Registrar aporte' : 'Registrar retiro'; }
  get amountError(): string {
    const control = this.form.get('amount');
    if (!control?.touched || !control.errors) return '';
    if (control.hasError('exceedsBalance') && this.goal) return `El retiro no puede superar el saldo disponible (${this.formatMoney(this.goal.balance)}).`;
    return 'Ingresa un monto entero mayor que cero.';
  }

  formatMoney(amount: number): string {
    return new Intl.NumberFormat('es-CL', { style: 'currency', currency: 'CLP', maximumFractionDigits: 0 }).format(amount);
  }

  private readonly safeIntegerValidator = (control: AbstractControl): ValidationErrors | null => {
    if (control.value === '' || control.value === null) return null;
    return Number.isSafeInteger(Number(control.value)) ? null : { safeInteger: true };
  };

  private readonly withdrawalBalanceValidator = (control: AbstractControl): ValidationErrors | null => {
    if (this.type !== 'withdrawal' || !this.goal || control.value === '' || control.value === null) return null;
    return Number(control.value) <= this.goal.balance ? null : { exceedsBalance: true };
  };

  private refreshAmountValidation(): void {
    this.form?.get('amount')?.updateValueAndValidity();
  }

  private readonly notFutureDateValidator = (control: AbstractControl): ValidationErrors | null =>
    !control.value || (isSavingsDate(control.value) && control.value <= this.today)
      ? null : { futureDate: true };

  private createRequestId(): string {
    try {
      return globalThis.crypto.randomUUID();
    } catch {
      return `savings-${Date.now()}-${Math.random().toString(36).slice(2)}`;
    }
  }

  private localDate(date: Date): string {
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
  }
}
