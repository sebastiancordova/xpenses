import { Component, EventEmitter, Input, Output, ViewEncapsulation, inject } from '@angular/core';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { Income } from '@core/models/income';
import { NgbActiveModal } from '@ng-bootstrap/ng-bootstrap';

@Component({
  selector: 'app-edit-income',
  templateUrl: './edit-income.component.html',
  styleUrls: ['./edit-income.component.scss'],
  encapsulation: ViewEncapsulation.None
})
export class EditIncomeComponent {
  @Output() editIncome$ = new EventEmitter<Income>();
  @Output() deleteIncome$ = new EventEmitter<string>();
  @Input() income!: Income
  public editIncomeForm!: FormGroup;
  public loading = false
  public activeModal: NgbActiveModal = inject(NgbActiveModal);

  private fb: FormBuilder = inject(FormBuilder);
  constructor() {
    this.editIncomeForm = this.fb.group({
      title: ['', Validators.required],
      amount: ['', Validators.required],
      period: ['', Validators.required],
      type: ['fixed', Validators.required]
    })

  }

  ngOnInit(): void {
    this.title?.setValue(this.income.title);
    this.amount?.setValue(this.income.amount);
    this.editIncomeForm.get('period')?.setValue(this.income.period || this.periodFromCreatedAt());
    this.editIncomeForm.get('type')?.setValue(this.income.type || 'fixed');
  }

  submit() {
    if (this.editIncomeForm.invalid || this.loading) {
      this.editIncomeForm.markAllAsTouched();
      return;
    }

    this.loading = true;
    const editIncome: Income = { ...this.income, ...this.editIncomeForm.value };
    this.editIncome$.emit(editIncome)
    this.activeModal.close();
  }

  delete() {
    this.loading = true;
    this.deleteIncome$.emit(this.income.uid);
    this.activeModal.close();
  }

  get title() {
    return this.editIncomeForm.get('title');
  }
  get amount() {
    return this.editIncomeForm.get('amount');
  }

  selectType(type: 'fixed' | 'variable'): void {
    this.editIncomeForm.get('type')?.setValue(type);
  }

  private periodFromCreatedAt(): string {
    const date = this.income.createdAt?.toDate?.() || new Date();
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
  }
}
