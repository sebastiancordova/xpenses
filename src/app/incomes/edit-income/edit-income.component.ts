import { CommonModule } from '@angular/common';
import { ChangeDetectionStrategy, Component, EventEmitter, Input, Output, ViewEncapsulation, inject } from '@angular/core';
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
      amount: ['', Validators.required]
    })

  }

  ngOnInit(): void {
    this.title?.setValue(this.income.title);
    this.amount?.setValue(this.income.amount);
  }

  submit() {
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
}
