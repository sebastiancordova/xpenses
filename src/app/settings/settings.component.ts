import { Component, inject, OnDestroy, OnInit } from '@angular/core';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { Subject, takeUntil } from 'rxjs';
import { UserPreferencesService } from '@core/services/user-preferences.service';

@Component({
  selector: 'app-settings',
  templateUrl: './settings.component.html',
  styleUrls: ['./settings.component.scss']
})
export class SettingsComponent implements OnInit, OnDestroy {
  private fb = inject(FormBuilder);
  private prefsService = inject(UserPreferencesService);
  private unsubscribe$ = new Subject<boolean>();

  public form!: FormGroup;
  public loading = false;
  public saved = false;

  ngOnInit(): void {
    this.form = this.fb.group({
      billingCycleDay: [19, [Validators.required, Validators.min(1), Validators.max(28)]],
      savingsRate: [20, [Validators.required, Validators.min(0), Validators.max(100)]],
      variableRate: [50, [Validators.required, Validators.min(0), Validators.max(100)]],
    });

    this.prefsService.getPreferences()
      .pipe(takeUntil(this.unsubscribe$))
      .subscribe(prefs => this.form.patchValue(prefs));
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

  async submit(): Promise<void> {
    if (this.form.invalid || this.allocationWarning) return;
    this.loading = true;
    this.saved = false;
    try {
      await this.prefsService.savePreferences(this.form.value);
      this.saved = true;
      setTimeout(() => this.saved = false, 3000);
    } finally {
      this.loading = false;
    }
  }

  ngOnDestroy(): void {
    this.unsubscribe$.next(true);
    this.unsubscribe$.unsubscribe();
  }
}
