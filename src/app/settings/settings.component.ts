import { Component, inject, OnDestroy, OnInit } from '@angular/core';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { take } from 'rxjs';
import { UserPreferencesService } from '@core/services/user-preferences.service';
import { DEFAULT_PREFERENCES, UserPreferences } from '@core/models/user-preferences';

@Component({
  selector: 'app-settings',
  templateUrl: './settings.component.html',
  styleUrls: ['./settings.component.scss']
})
export class SettingsComponent implements OnInit, OnDestroy {
  private fb = inject(FormBuilder);
  private prefsService = inject(UserPreferencesService);
  private savedFeedbackTimer?: ReturnType<typeof setTimeout>;
  private savedPreferences: UserPreferences = { ...DEFAULT_PREFERENCES };

  public form!: FormGroup;
  public preferencesLoading = true;
  public loading = false;
  public saved = false;
  public loadError = false;
  public saveError = false;

  ngOnInit(): void {
    this.form = this.fb.group({
      billingCycleDay: [19, [Validators.required, Validators.min(1), Validators.max(28)]],
      savingsRate: [20, [Validators.required, Validators.min(0), Validators.max(100)]],
      variableRate: [50, [Validators.required, Validators.min(0), Validators.max(100)]],
    });

    this.loadPreferences();
  }

  get billingCycleDay() { return this.form.get('billingCycleDay'); }
  get savingsRate() { return this.form.get('savingsRate'); }
  get variableRate() { return this.form.get('variableRate'); }

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
    if (day === 1) return 'Tu período cierra el día 1; el siguiente comienza el día 2.';
    return `Tu período va del día ${day + 1} al ${day} del mes siguiente.`;
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
      },
      error: () => {
        this.preferencesLoading = false;
        this.loadError = true;
      }
    });
  }
}
