import { Component, OnDestroy, TemplateRef, ViewChild, inject } from '@angular/core';
import { AbstractControl, FormBuilder, FormGroup, Validators } from '@angular/forms';
import { IUser } from '@core/models/user';
import { NgbModal, NgbModalRef } from '@ng-bootstrap/ng-bootstrap';
import { ToastrService } from 'ngx-toastr';
import { Subject, combineLatest, debounceTime, take, takeUntil, tap } from 'rxjs';
import { FixedExpense } from '@core/models/expense';
import { AddFixedExpenseComponent } from './add-fixed-expense/add-fixed-expense.component';
import { FixedExpensesService } from '@core/services/fixed-expenses.service';
import { EditFixedExpenseComponent } from './edit-fixed-expense/edit-fixed-expense.component';
import { FixedExpenseCharge, FixedExpenseChargeInput } from '@core/models/fixed-expense-charge';
import { FixedExpenseChargesService } from '@core/services/fixed-expense-charges.service';
import { PaymentMethodsService } from '@core/services/payment-methods.service';
import { PaymentMethod } from '@core/models/payment-method';
import { getFixedExpenseChargeId, getFixedExpenseChargeMonth, isFixedExpenseChargeDate, isFixedExpenseChargePeriod } from '@core/utils/fixed-expense-charges.utils';

interface MonthlyFixedExpenseRow {
  fixedExpenseId: string;
  title: string;
  amount: string;
  template?: FixedExpense;
  charge?: FixedExpenseCharge;
}

@Component({
  selector: 'app-fixed-expenses',
  templateUrl: './fixed-expenses.component.html',
  styleUrls: ['./fixed-expenses.component.scss']
})
export class FixedExpensesComponent implements OnDestroy {
  @ViewChild('chargeModal') chargeModal!: TemplateRef<unknown>;
  public filtersForm: FormGroup;
  public chargeForm: FormGroup;
  public selectedPeriod = this.localDate(new Date()).slice(0, 7);
  public rows: MonthlyFixedExpenseRow[] = [];
  public charges: FixedExpenseCharge[] = [];
  public paymentMethods: PaymentMethod[] = [];
  public confirmedAmount = 0;
  public estimatedAmount = 0;
  public loadError = false;
  public savingCharge = false;
  public chargeError = '';
  public activeRow?: MonthlyFixedExpenseRow;
  public resetRequested = false;
  private chargeModalRef?: NgbModalRef;
  private chargesService = inject(FixedExpenseChargesService);
  private paymentMethodsService = inject(PaymentMethodsService);
  private unsubscribe$ = new Subject<boolean>();
  public loadingPage = true;
  public currentUser!: IUser;
  public page = 1;
  public pageSize = 8;
  public collectionSize = 1;
  public fireFixedExpenses: FixedExpense[] = [];
  private fixedExpensesService: FixedExpensesService = inject(FixedExpensesService);
  private fb: FormBuilder = inject(FormBuilder);
  private toastr: ToastrService = inject(ToastrService);
  private modalService: NgbModal = inject(NgbModal);
  public totalAmountFiltered = 0;

  constructor() {
    this.filtersForm = this.fb.group({
      search: '',
      category: ''
    });
    this.chargeForm = this.fb.group({
      amount: ['', [Validators.required, Validators.pattern(/^\d+$/), (control: AbstractControl) => {
        const value = Number(control.value);
        return Number.isSafeInteger(value) && value > 0 ? null : { amount: true };
      }]],
      chargeDate: ['', [Validators.required, (control: AbstractControl) => isFixedExpenseChargeDate(control.value) ? null : { date: true }]],
      paymentMethodId: ['', [Validators.required, (control: AbstractControl) =>
        this.paymentMethods.some(method => method.uid === control.value) ? null : { method: true }]]
    });
  }

  ngOnInit(): void {
    this.loadMonthlyExpenses();
    this.filtersForm.valueChanges
      .pipe(takeUntil(this.unsubscribe$), debounceTime(200), tap(() => this.filter()))
      .subscribe();

  }

  loadMonthlyExpenses(): void {
    this.loadingPage = true;
    this.loadError = false;
    combineLatest([this.fixedExpensesService.getAll(), this.chargesService.getAll(), this.paymentMethodsService.getAll()])
      .pipe(takeUntil(this.unsubscribe$)).subscribe({
        next: ([templates, charges, methods]) => {
          this.fireFixedExpenses = templates;
          this.charges = charges;
          this.paymentMethods = methods;
          this.filter();
        },
        error: () => { this.loadingPage = false; this.loadError = true; }
      });
  }

  setPeriod(period: string): void {
    if (!isFixedExpenseChargePeriod(period)) return;
    this.selectedPeriod = period;
    this.page = 1;
    this.filter();
  }

  moveMonth(offset: number): void {
    const [year, month] = this.selectedPeriod.split('-').map(Number);
    this.setPeriod(this.localDate(new Date(year, month - 1 + offset, 1)).slice(0, 7));
  }

  get periodLabel(): string {
    const [year, month] = this.selectedPeriod.split('-').map(Number);
    return new Date(year, month - 1, 1).toLocaleDateString('es-CL', { month: 'long', year: 'numeric' });
  }

  periodName(period: string): string {
    const [year, month] = period.split('-').map(Number);
    return new Date(year, month - 1, 1).toLocaleDateString('es-CL', { month: 'long', year: 'numeric' });
  }

  get accountPeriodLabel(): string {
    return this.periodName(this.activeRow?.charge?.period ?? this.selectedPeriod);
  }

  get chargeDisplayPeriod(): string | undefined {
    const date = this.chargeForm.value.chargeDate;
    return isFixedExpenseChargeDate(date) ? this.periodName(date.slice(0, 7)) : undefined;
  }

  private localDate(date: Date): string {
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
  }

  filter() {
    const monthlyCharges = this.charges.filter(charge => getFixedExpenseChargeMonth(charge) === this.selectedPeriod);
    let rows: MonthlyFixedExpenseRow[] = monthlyCharges.map(charge => ({
      fixedExpenseId: charge.fixedExpenseId, title: charge.title, amount: charge.amount, charge,
      template: this.fireFixedExpenses.find(template => template.uid === charge.fixedExpenseId)
    }));
    this.fireFixedExpenses.filter(template => !!template.uid).forEach(template => {
      const hasVisibleCharge = monthlyCharges.some(charge => charge.fixedExpenseId === template.uid);
      if (!hasVisibleCharge) {
        rows.push({ fixedExpenseId: template.uid!, title: template.title, amount: template.amount, template });
      }
    });
    const { search } = this.filtersForm.value;
    if (search) rows = rows.filter(row => row.title.toLowerCase().includes(search.toLowerCase()) || row.amount.includes(search));
    this.confirmedAmount = rows.filter(row => row.charge?.status === 'confirmed').reduce((total, row) => total + +row.amount, 0);
    this.estimatedAmount = rows.filter(row => !row.charge).reduce((total, row) => total + +row.amount, 0);
    this.totalAmountFiltered = this.confirmedAmount + this.estimatedAmount;
    this.collectionSize = rows.length;
    this.page = Math.min(this.page, Math.max(1, Math.ceil(this.collectionSize / this.pageSize)));
    this.rows = rows.slice((this.page - 1) * this.pageSize, this.page * this.pageSize);
    this.loadingPage = false;
  }

  openCharge(row: MonthlyFixedExpenseRow): void {
    this.activeRow = row;
    this.chargeError = '';
    this.resetRequested = false;
    const defaultMethod = this.paymentMethods.find(method => method.isDefault) ?? this.paymentMethods.find(method => method.isActive);
    const today = this.localDate(new Date());
    this.chargeForm.reset({
      amount: row.amount,
      chargeDate: row.charge?.chargeDate ?? (today.startsWith(this.selectedPeriod) ? today : ''),
      paymentMethodId: row.charge?.paymentMethodId ?? row.template?.paymentMethodId ?? defaultMethod?.uid ?? ''
    });
    this.chargeModalRef = this.modalService.open(this.chargeModal, {
      size: 'sm', centered: true, scrollable: true, backdrop: 'static', ariaLabelledBy: 'monthly-charge-title',
      windowClass: 'monthly-fixed-charge-modal', beforeDismiss: () => !this.savingCharge
    });
    this.chargeModalRef.result.catch(() => undefined);
  }

  async saveCharge(status: 'confirmed' | 'skipped'): Promise<void> {
    if (!this.activeRow || this.savingCharge) return;
    if (status === 'confirmed' && this.chargeForm.invalid) { this.chargeForm.markAllAsTouched(); return; }
    this.savingCharge = true;
    this.chargeError = '';
    const input: FixedExpenseChargeInput = {
      amount: status === 'confirmed' ? String(Number(this.chargeForm.value.amount)) : this.activeRow.amount,
      chargeDate: status === 'confirmed' ? this.chargeForm.value.chargeDate : this.activeRow.charge?.chargeDate ?? `${this.selectedPeriod}-01`,
      ...(this.chargeForm.value.paymentMethodId ? { paymentMethodId: this.chargeForm.value.paymentMethodId } : {}),
      fixedExpenseId: this.activeRow.fixedExpenseId, period: this.activeRow.charge?.period ?? this.selectedPeriod,
      title: this.activeRow.title, status
    };
    try {
      await this.chargesService.save(input, this.activeRow.charge?.uid);
      this.chargeModalRef?.close();
      if (status === 'confirmed') this.setPeriod(input.chargeDate.slice(0, 7));
      else this.setPeriod(input.period);
      this.toastr.success(status === 'confirmed' ? 'Cargo mensual registrado' : 'Gasto omitido este mes');
    } catch {
      this.chargeError = 'No pudimos guardar el cargo. Revisa tu conexión e intenta nuevamente.';
    } finally { this.savingCharge = false; }
  }

  async resetCharge(): Promise<void> {
    if (!this.activeRow?.charge || this.savingCharge) return;
    if (!this.resetRequested) { this.resetRequested = true; return; }
    this.savingCharge = true;
    this.chargeError = '';
    try {
      await this.chargesService.delete(this.activeRow.charge.uid ?? getFixedExpenseChargeId(this.activeRow.fixedExpenseId, this.activeRow.charge.period));
      this.chargeModalRef?.close();
      this.toastr.success('Registro mensual restablecido');
    } catch { this.chargeError = 'No pudimos restablecer el registro. Intenta nuevamente.'; }
    finally { this.savingCharge = false; }
  }

  get selectableMethods(): PaymentMethod[] {
    return this.paymentMethods.filter(method => method.isActive || method.uid === this.chargeForm.value.paymentMethodId);
  }

  paymentMethodName(row: MonthlyFixedExpenseRow): string {
    const id = row.charge?.paymentMethodId ?? row.template?.paymentMethodId;
    return this.paymentMethods.find(method => method.uid === id)?.name ?? this.paymentMethods.find(method => method.isDefault)?.name ?? 'Método sin asignar';
  }


  openCreateModal() {
    const modalRef = this.modalService.open(AddFixedExpenseComponent, {
      size: 'sm',
      centered: true,
      windowClass: 'add-fixed-expense-modal'
    })
    modalRef.componentInstance.newFixedExpense$.pipe(take(1)).subscribe((fixedExpense: FixedExpense) => {
      this.fixedExpensesService.save(fixedExpense).then(() => {
        this.toastr.success('Gasto fijo añadido');
      }).catch(() => {
        this.toastr.error('Ocurrió un error, por favor intenta de nuevo');
      })
    })
  }

  openEditModal(fixedExpense: FixedExpense) {
    const modalRef = this.modalService.open(EditFixedExpenseComponent, {
      size: 'sm',
      centered: true,
      windowClass: 'edit-fixed-expense-modal'
    })
    modalRef.componentInstance.fixedExpense = fixedExpense;
    modalRef.componentInstance.editFixedExpense$.pipe(take(1)).subscribe((fixedExpense: FixedExpense) => {
      this.fixedExpensesService.update(fixedExpense).then(() => {
        this.toastr.success('Gasto fijo editado');
      }).catch(() => {
        this.toastr.error('Ocurrió un error, por favor intenta de nuevo');
      })
    })
    modalRef.componentInstance.deleteFixedExpense$.pipe(take(1)).subscribe((id: string) => {
      this.delete(id);
    })
  }

  delete(id: string) {
    this.fixedExpensesService.delete(id).then(() => {
      this.toastr.success('Gasto fijo eliminado');
    }).catch(() => {
      this.toastr.error('Ocurrió un error, por favor intenta de nuevo');
    })
  }


  get search() {
    return this.filtersForm.get('search');
  }

  ngOnDestroy() {
    this.chargeModalRef?.close();
    this.unsubscribe$.next(true);
    this.unsubscribe$.unsubscribe();
  }
}
