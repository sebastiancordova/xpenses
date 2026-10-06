import { Component, inject } from '@angular/core';
import { FormBuilder, FormGroup } from '@angular/forms';
import { NgbModal } from '@ng-bootstrap/ng-bootstrap';
import { ToastrService } from 'ngx-toastr';
import { Subject, debounceTime, take, takeUntil, tap } from 'rxjs';
import { AddIncomesComponent } from './add-incomes/add-incomes.component';
import { Income } from '@core/models/income';
import { IncomesService } from '../core/services/incomes.service';
import { EditIncomeComponent } from './edit-income/edit-income.component';

@Component({
  selector: 'app-incomes',
  templateUrl: './incomes.component.html',
  styleUrls: ['./incomes.component.scss']
})
export class IncomesComponent {
  public filtersForm: FormGroup;
  private unsubscribe$ = new Subject<boolean>();
  public loadingPage = true;
  public page = 1;
  public pageSize = 8;
  public collectionSize = 1;
  private incomesService: IncomesService = inject(IncomesService);
  private fb: FormBuilder = inject(FormBuilder);
  private toastr: ToastrService = inject(ToastrService);
  private modalService: NgbModal = inject(NgbModal);
  public fireIncomes: Income[] = [];
  public incomes: Income[] = [];
  public totalAmountFiltered = 0;
  private readonly monthNames = [
    'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
    'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'
  ];
  private readonly incomeCreatedAtFormatter = new Intl.DateTimeFormat('es-CL', {
    day: '2-digit',
    month: 'long',
    year: 'numeric'
  });

  constructor() {
    this.filtersForm = this.fb.group({
      search: '',
      period: this.currentPeriod()
    });
  }

  ngOnInit(): void {
    this.incomesService.getAll().pipe(takeUntil(this.unsubscribe$)).subscribe((incomes) => {
      this.fireIncomes = incomes;
      this.filter();
    });
    this.filtersForm.valueChanges
      .pipe(takeUntil(this.unsubscribe$), debounceTime(200), tap(() => {
        this.page = 1;
        this.filter();
      }))
      .subscribe();

  }

  filter() {
    let incomes = this.fireIncomes;
    // filters
    const { search, period } = this.filtersForm.value;

    incomes = incomes.filter(income => this.incomesService.getIncomePeriod(income) === period);

    if (search !== '') {
      incomes = incomes.filter(expense => expense.title.toLowerCase().includes(search.toLowerCase()) || expense.amount.toLowerCase().includes(search.toLowerCase()));
    }

    this.collectionSize = incomes.length;
    this.totalAmountFiltered = incomes.reduce((acc, income) => acc + +income.amount, 0);
    // paginate
    incomes = incomes.slice((this.page - 1) * this.pageSize, (this.page - 1) * this.pageSize + this.pageSize);
    this.incomes = incomes;
    this.loadingPage = false;
  }

  openCreateModal() {
    const modalRef = this.modalService.open(AddIncomesComponent, {
      size: 'sm',
      centered: true,
      windowClass: 'add-income-modal',
    })
    modalRef.componentInstance.period = this.selectedPeriod;
    modalRef.componentInstance.newIncome$.pipe(take(1)).subscribe((income: Income) => {
      this.incomesService.save(income).then(() => {
        this.toastr.success('Ingreso añadido');
      }).catch(() => {
        this.toastr.error('Ocurrió un error, por favor intenta de nuevo');
      })
    })
  }

  openEditModal(income: Income) {
    const modalRef = this.modalService.open(EditIncomeComponent, {
      size: 'sm',
      centered: true,
      windowClass: 'edit-income-modal'
    })
    modalRef.componentInstance.income = income;
    modalRef.componentInstance.editIncome$.pipe(take(1)).subscribe((income: Income) => {
      this.incomesService.update(income).then(() => {
        this.toastr.success('Ingreso editado');
      }).catch(() => {
        this.toastr.error('Ocurrió un error, por favor intenta de nuevo');
      })
    })
    modalRef.componentInstance.deleteIncome$.pipe(take(1)).subscribe((id: string) => {
      this.delete(id);
    })
  }

  delete(id: string) {
    this.incomesService.delete(id).then(() => {
      this.toastr.success('Ingreso eliminado');
    }).catch(() => {
      this.toastr.error('Ocurrió un error, por favor intenta de nuevo');
    })
  }

  get search() {
    return this.filtersForm.get('search');
  }

  get isSearchActive(): boolean {
    return Boolean(this.search?.value);
  }

  clearSearch(): void {
    this.filtersForm.patchValue({ search: '' });
  }

  get selectedPeriod(): string {
    return this.filtersForm.get('period')?.value || this.currentPeriod();
  }

  get selectedPeriodLabel(): string {
    const [year, month] = this.selectedPeriod.split('-').map(Number);
    return `${this.monthNames[month - 1]} ${year}`;
  }

  get isCurrentMonth(): boolean {
    return this.selectedPeriod === this.currentPeriod();
  }

  getIncomeTypeLabel(income: Income): string {
    return income.type === 'variable' ? 'Ingreso variable' : 'Sueldo fijo';
  }

  getIncomeCreatedAtLabel(income: Income): string | null {
    if (!income.createdAt || typeof income.createdAt.toDate !== 'function') return null;

    return this.incomeCreatedAtFormatter.format(income.createdAt.toDate());
  }

  previousMonth(): void {
    this.changeMonth(-1);
  }

  nextMonth(): void {
    if (!this.isCurrentMonth) {
      this.changeMonth(1);
    }
  }

  private changeMonth(offset: number): void {
    const [year, month] = this.selectedPeriod.split('-').map(Number);
    const nextDate = new Date(year, month - 1 + offset, 1);
    const period = `${nextDate.getFullYear()}-${String(nextDate.getMonth() + 1).padStart(2, '0')}`;
    this.filtersForm.get('period')?.setValue(period);
  }

  private currentPeriod(): string {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  }

  ngOnDestroy() {
    this.unsubscribe$.next(true);
    this.unsubscribe$.unsubscribe();
  }
}
