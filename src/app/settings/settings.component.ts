import { Component, inject, OnDestroy, OnInit } from '@angular/core';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { firstValueFrom, take } from 'rxjs';
import { UserPreferencesService } from '@core/services/user-preferences.service';
import { DEFAULT_PREFERENCES, UserPreferences } from '@core/models/user-preferences';
import { PAYMENT_METHOD_TYPE_LABELS, PaymentMethod, PaymentMethodType } from '@core/models/payment-method';
import { PaymentMethodsService } from '@core/services/payment-methods.service';

@Component({
  selector: 'app-settings',
  templateUrl: './settings.component.html',
  styleUrls: ['./settings.component.scss']
})
export class SettingsComponent implements OnInit, OnDestroy {
  private fb = inject(FormBuilder);
  private prefsService = inject(UserPreferencesService);
  private paymentMethodsService = inject(PaymentMethodsService);
  private savedFeedbackTimer?: ReturnType<typeof setTimeout>;
  private savedPreferences: UserPreferences = { ...DEFAULT_PREFERENCES };

  public form!: FormGroup;
  public preferencesLoading = true;
  public loading = false;
  public saved = false;
  public loadError = false;
  public saveError = false;
  public paymentMethods: PaymentMethod[] = [];
  public paymentMethodsLoading = true;
  public paymentMethodSaving = false;
  public paymentMethodError = '';
  public showPaymentMethodForm = false;
  public editingPaymentMethod?: PaymentMethod;
  public paymentMethodTypeLabels = PAYMENT_METHOD_TYPE_LABELS;
  public paymentMethodForm!: FormGroup;

  ngOnInit(): void {
    this.form = this.fb.group({
      billingCycleDay: [19, [Validators.required, Validators.min(1), Validators.max(28)]],
      savingsRate: [20, [Validators.required, Validators.min(0), Validators.max(100)]],
      variableRate: [50, [Validators.required, Validators.min(0), Validators.max(100)]],
    });
    this.paymentMethodForm = this.fb.group({
      name: ['', [Validators.required, Validators.maxLength(40)]],
      type: ['credit' as PaymentMethodType, Validators.required],
      billingCycleDay: [19, [Validators.required, Validators.min(1), Validators.max(28)]],
    });

    this.loadPreferences();
  }

  get billingCycleDay() { return this.form.get('billingCycleDay'); }
  get savingsRate() { return this.form.get('savingsRate'); }
  get variableRate() { return this.form.get('variableRate'); }
  get paymentMethodName() { return this.paymentMethodForm.get('name'); }
  get paymentMethodType() { return this.paymentMethodForm.get('type'); }
  get paymentMethodBillingDay() { return this.paymentMethodForm.get('billingCycleDay'); }

  get isCreditPaymentMethod(): boolean {
    return this.paymentMethodType?.value === 'credit';
  }

  get totalAllocated(): number {
    const savings = +(this.savingsRate?.value ?? 0);
    const variable = +(this.variableRate?.value ?? 0);
    return savings + variable;
  }

  get allocationWarning(): boolean {
    return this.totalAllocated > 100;
  }

  get fixedRate(): number {
    return Math.max(0, 100 - this.totalAllocated);
  }

  get hasUnsavedChanges(): boolean {
    return this.billingCycleDay?.value !== this.savedPreferences.billingCycleDay
      || this.savingsRate?.value !== this.savedPreferences.savingsRate
      || this.variableRate?.value !== this.savedPreferences.variableRate;
  }

  get billingCycleDescription(): string {
    const day = Number(this.billingCycleDay?.value);
    if (!Number.isFinite(day) || day < 1 || day > 28) return 'Elige un día entre 1 y 28.';
    if (day === 1) return 'El Dashboard analiza del día 1 al último día del mes; el cargo de cuota queda programado para el día 1.';
    return `El Dashboard analiza del día ${day} hasta la víspera del mismo día el mes siguiente; los cargos de cuotas quedan programados para el día ${day}.`;
  }

  changeRate(controlName: 'savingsRate' | 'variableRate', change: number): void {
    const control = this.form.get(controlName);
    if (!control) return;
    const next = Math.min(100, Math.max(0, Number(control.value || 0) + change));
    control.setValue(next);
    control.markAsDirty();
    control.markAsTouched();
    this.saved = false;
    this.saveError = false;
  }

  useRecommendedAllocation(): void {
    this.form.patchValue({ savingsRate: 20, variableRate: 50 });
    this.savingsRate?.markAsDirty();
    this.variableRate?.markAsDirty();
    this.saved = false;
    this.saveError = false;
  }

  retryLoad(): void {
    if (!this.preferencesLoading) this.loadPreferences();
  }

  startPaymentMethod(): void {
    this.editingPaymentMethod = undefined;
    this.paymentMethodForm.reset({ name: '', type: 'credit', billingCycleDay: this.billingCycleDay?.value || 19 });
    this.showPaymentMethodForm = true;
    this.paymentMethodError = '';
  }

  editPaymentMethod(method: PaymentMethod): void {
    this.editingPaymentMethod = method;
    this.paymentMethodForm.reset({
      name: method.name,
      type: method.type,
      billingCycleDay: method.billingCycleDay || this.billingCycleDay?.value || 19,
    });
    this.showPaymentMethodForm = true;
    this.paymentMethodError = '';
  }

  cancelPaymentMethod(): void {
    this.showPaymentMethodForm = false;
    this.editingPaymentMethod = undefined;
    this.paymentMethodError = '';
  }

  async savePaymentMethod(): Promise<void> {
    if (this.paymentMethodForm.invalid || this.paymentMethodSaving) {
      this.paymentMethodForm.markAllAsTouched();
      return;
    }
    this.paymentMethodSaving = true;
    this.paymentMethodError = '';
    const values = this.paymentMethodForm.value;
    try {
      if (this.editingPaymentMethod) {
        await this.paymentMethodsService.update({
          ...this.editingPaymentMethod,
          name: values.name.trim(),
          type: values.type,
          billingCycleDay: values.type === 'credit' ? Number(values.billingCycleDay) : undefined,
        });
      } else {
        await this.paymentMethodsService.save({
          name: values.name.trim(),
          type: values.type,
          billingCycleDay: values.type === 'credit' ? Number(values.billingCycleDay) : undefined,
          isActive: true,
          isDefault: false,
        });
      }
      this.cancelPaymentMethod();
      await this.loadPaymentMethods(Number(this.billingCycleDay?.value || 19));
    } catch (error: any) {
      this.paymentMethodError = error?.code === 'permission-denied'
        ? 'Firestore rechazó el guardado. Despliega las reglas actualizadas para permitir métodos de pago.'
        : 'No se pudo guardar el método. Inténtalo nuevamente.';
    } finally {
      this.paymentMethodSaving = false;
    }
  }

  async togglePaymentMethod(method: PaymentMethod): Promise<void> {
    if (method.isDefault || this.paymentMethodSaving) return;
    this.paymentMethodSaving = true;
    this.paymentMethodError = '';
    try {
      await this.paymentMethodsService.setActive(method, !method.isActive);
      await this.loadPaymentMethods(Number(this.billingCycleDay?.value || 19));
    } catch (error: any) {
      this.paymentMethodError = error?.code === 'permission-denied'
        ? 'Firestore rechazó el cambio. Despliega las reglas actualizadas.'
        : 'No se pudo actualizar el método. Inténtalo nuevamente.';
    } finally {
      this.paymentMethodSaving = false;
    }
  }

  async submit(): Promise<void> {
    if (this.form.invalid || this.allocationWarning || !this.hasUnsavedChanges) {
      this.form.markAllAsTouched();
      return;
    }
    this.loading = true;
    this.saved = false;
    this.saveError = false;
    try {
      await this.prefsService.savePreferences(this.form.value);
      this.savedPreferences = {
        billingCycleDay: Number(this.billingCycleDay?.value),
        savingsRate: Number(this.savingsRate?.value),
        variableRate: Number(this.variableRate?.value),
      };
      this.form.markAsPristine();
      this.saved = true;
      this.savedFeedbackTimer = setTimeout(() => this.saved = false, 3500);
    } catch {
      this.saveError = true;
    } finally {
      this.loading = false;
    }
  }

  ngOnDestroy(): void {
    if (this.savedFeedbackTimer) clearTimeout(this.savedFeedbackTimer);
  }

  private loadPreferences(): void {
    this.preferencesLoading = true;
    this.loadError = false;
    this.prefsService.getPreferences().pipe(take(1)).subscribe({
      next: preferences => {
        this.form.patchValue(preferences, { emitEvent: false });
        this.savedPreferences = {
          billingCycleDay: Number(preferences.billingCycleDay),
          savingsRate: Number(preferences.savingsRate),
          variableRate: Number(preferences.variableRate),
        };
        this.form.markAsPristine();
        this.preferencesLoading = false;
        this.loadPaymentMethods(preferences.billingCycleDay);
      },
      error: () => {
        this.preferencesLoading = false;
        this.loadError = true;
      }
    });
  }

  private async loadPaymentMethods(billingCycleDay: number): Promise<void> {
    this.paymentMethodsLoading = true;
    try {
      await this.paymentMethodsService.ensureDefault(billingCycleDay);
      this.paymentMethods = await firstValueFrom(this.paymentMethodsService.getAll());
      this.paymentMethodsLoading = false;
    } catch {
      this.paymentMethodsLoading = false;
      this.paymentMethodError = 'No se pudieron cargar los métodos de pago.';
    }
  }
}
