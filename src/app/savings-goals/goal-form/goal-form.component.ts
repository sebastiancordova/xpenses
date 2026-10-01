import { Component, EventEmitter, Input, Output, ViewEncapsulation, inject } from '@angular/core';
import { FormBuilder, FormGroup, ValidationErrors, ValidatorFn, Validators } from '@angular/forms';
import { SavingsGoal, SavingsGoalInput } from '@core/models/savings-goal';
import { isSavingsDate } from '@core/utils/savings-goals.utils';
import { NgbActiveModal } from '@ng-bootstrap/ng-bootstrap';

@Component({
  selector: 'app-savings-goal-form',
  templateUrl: './goal-form.component.html',
  styleUrls: ['./goal-form.component.scss'],
  encapsulation: ViewEncapsulation.None
})
export class GoalFormComponent {
  @Input() goal?: SavingsGoal;
  @Input() maxPercentage = 100;
  @Output() submitted = new EventEmitter<SavingsGoalInput>();

  public readonly activeModal = inject(NgbActiveModal);
  public readonly form: FormGroup;
  public loading = false;
  public error = '';
  private readonly fb = inject(FormBuilder);

  constructor() {
    this.form = this.fb.group({
      name: ['', [Validators.required, Validators.maxLength(60), this.nonWhitespaceValidator]],
      targetAmount: ['', [Validators.required, Validators.pattern(/^\d+$/), Validators.min(1), this.safeIntegerValidator()]],
      targetDate: ['', this.dateValidator],
      allocationType: ['percentage', Validators.required],
      allocationValue: ['', [Validators.required, Validators.min(0.01)]],
      status: ['active', Validators.required]
    });
  }

  ngOnInit(): void {
    if (this.goal) {
      this.form.patchValue({
        name: this.goal.name,
        targetAmount: this.goal.targetAmount,
        targetDate: this.goal.targetDate || '',
        allocationType: this.goal.allocationType,
        allocationValue: this.goal.allocationValue,
        status: this.goal.status
      });
    }
    this.updateAllocationValidators();
  }

  submit(): void {
    if (this.loading) return;
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }
    const value = this.form.getRawValue();
    const input: SavingsGoalInput = {
      name: String(value.name).trim(),
      targetAmount: Number(value.targetAmount),
      ...(value.targetDate ? { targetDate: String(value.targetDate) } : {}),
      allocationType: value.allocationType,
      allocationValue: Number(value.allocationValue),
      status: value.status
    };
    this.submitted.emit(input);
  }

  updateAllocationValidators(): void {
    const control = this.form.get('allocationValue');
    if (!control) return;
    const validators = [Validators.required, Validators.min(this.allocationType === 'percentage' ? 0.01 : 1)];
    if (this.allocationType === 'percentage') {
      validators.push(Validators.pattern(/^\d+(\.\d{1,2})?$/));
      validators.push(Validators.max(this.form.get('status')?.value === 'active' ? this.maxPercentage : 100));
    } else {
      validators.push(Validators.pattern(/^\d+$/), this.safeIntegerValidator());
    }
    control.setValidators(validators);
    control.updateValueAndValidity();
  }

  updateStatusValidators(): void {
    this.updateAllocationValidators();
  }

  get allocationType(): 'percentage' | 'fixed' {
    return this.form.get('allocationType')?.value === 'fixed' ? 'fixed' : 'percentage';
  }

  get fieldErrors(): Record<string, string> {
    const errors: Record<string, string> = {};
    const name = this.form.get('name');
    const target = this.form.get('targetAmount');
    const allocation = this.form.get('allocationValue');
    if (name?.touched && name.invalid) errors['name'] = name.hasError('required') || name.hasError('whitespace')
      ? 'Escribe un nombre para tu meta.' : 'Usa hasta 60 caracteres.';
    if (target?.touched && target.invalid) errors['targetAmount'] = 'Ingresa un monto entero mayor que cero.';
    if (allocation?.touched && allocation.invalid) {
      errors['allocationValue'] = this.allocationType === 'percentage'
        ? (allocation.hasError('max') && this.form.get('status')?.value === 'active'
          ? `El máximo disponible en metas activas es ${this.maxPercentage}%.` : 'Usa un porcentaje entre 0,01 y 100, con hasta 2 decimales.')
        : 'Ingresa un monto entero mayor que cero.';
    }
    return errors;
  }

  private safeIntegerValidator(): ValidatorFn {
    return (control): ValidationErrors | null => {
      if (control.value === '' || control.value === null) return null;
      return Number.isSafeInteger(Number(control.value)) ? null : { safeInteger: true };
    };
  }

  private readonly nonWhitespaceValidator: ValidatorFn = (control): ValidationErrors | null =>
    typeof control.value === 'string' && control.value.trim().length > 0 ? null : { whitespace: true };

  private readonly dateValidator: ValidatorFn = (control): ValidationErrors | null =>
    !control.value || isSavingsDate(control.value) ? null : { invalidDate: true };
}
