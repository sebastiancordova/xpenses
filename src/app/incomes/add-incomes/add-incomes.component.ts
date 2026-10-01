import { Component, EventEmitter, inject, Input, Output, ViewEncapsulation } from '@angular/core';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { Income } from '@core/models/income';
import { NgbActiveModal } from '@ng-bootstrap/ng-bootstrap';

@Component({
  selector: 'app-add-incomes',
  templateUrl: './add-incomes.component.html',
  styleUrls: ['./add-incomes.component.scss'],
  encapsulation: ViewEncapsulation.None
})
export class AddIncomesComponent {
  public addIncomeForm!: FormGroup;
  public loading = false
  public activeModal: NgbActiveModal = inject(NgbActiveModal);
  @Input() period = this.currentPeriod();
  @Output() newIncome$ = new EventEmitter<Income>();
  private fb: FormBuilder = inject(FormBuilder);
  constructor() {
    this.addIncomeForm = this.fb.group({
      title: ['', Validators.required],
      amount: ['', Validators.required],
      period: [this.currentPeriod(), Validators.required],
      type: ['fixed', Validators.required]
    })

  }

  ngOnInit(): void {
    this.addIncomeForm.get('period')?.setValue(this.period || this.currentPeriod());
  }

  submit(): void {
    if (this.addIncomeForm.invalid || this.loading) {
      this.addIncomeForm.markAllAsTouched();
      return;
    }

    this.loading = true;
    const newIncome: Income = this.addIncomeForm.value;
    this.newIncome$.emit(newIncome)
    this.activeModal.close();
  }

  get title() {
    return this.addIncomeForm.get('title');
  }
  get amount() {
    return this.addIncomeForm.get('amount');
  }

  selectType(type: 'fixed' | 'variable'): void {
    this.addIncomeForm.get('type')?.setValue(type);
  }

  private currentPeriod(): string {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  }
}
