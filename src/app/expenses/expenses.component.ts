import { Component, OnDestroy, ViewChild, inject } from '@angular/core';
import { FormBuilder, FormGroup } from '@angular/forms';
import { IUser } from '@core/models/user';
import { NgbModal } from '@ng-bootstrap/ng-bootstrap';
import { ToastrService } from 'ngx-toastr';
import { BehaviorSubject, Subject, debounceTime, filter, switchMap, take, takeUntil, tap } from 'rxjs';
import { AddExpenseComponent } from './add-expense/add-expense.component';
import { ExpensesService } from '@core/services/expenses.service';
import { Expense, EXPENSE_CATEGORY_OPTIONS } from '@core/models/expense';
import { EditExpenseComponent } from './edit-expense/edit-expense.component';
import { RangeDateSelectorComponent } from '@shared/components/range-date-selector/range-date-selector.component';
import { PaymentMethod } from '@core/models/payment-method';
import { PaymentMethodsService } from '@core/services/payment-methods.service';

@Component({
  selector: 'app-expenses',
  templateUrl: './expenses.component.html',
  styleUrls: ['./expenses.component.scss']
})
export class ExpensesComponent implements OnDestroy {
  @ViewChild(RangeDateSelectorComponent) private rangeDateSelector?: RangeDateSelectorComponent;
  public filtersForm: FormGroup;
  private unsubscribe$ = new Subject<boolean>();
  public loadingPage = true;
  public currentUser!: IUser;
  public page = 1;
  public pageSize = 8;
  public collectionSize = 1;
  public expenses: Expense[] = [];
  public fireExpenses: Expense[] = [];
  private expensesService: ExpensesService = inject(ExpensesService);
  private fb: FormBuilder = inject(FormBuilder);
  private toastr: ToastrService = inject(ToastrService);
  private modalService: NgbModal = inject(NgbModal);
  public totalAmountFiltered = 0;
  public categoryOptions = EXPENSE_CATEGORY_OPTIONS;
  public sortColumn = '';
  public sortAsc = false;
  public hasCustomDateRange = false;
  public paymentMethods: PaymentMethod[] = [];
  public paymentMethodsLoading = true;
  public paymentMethodsError = false;
  public readonly unassignedPaymentMethod = '__unassigned__';
  public visibleDateRange = this.getDefaultDateRange();
  private paymentMethodsService = inject(PaymentMethodsService);
  private dateFilter$ = new BehaviorSubject<{ from: Date | undefined; to: Date | undefined }>({ from: undefined, to: undefined });

  constructor() {
    this.filtersForm = this.fb.group({
      search: '',
      category: '',
      paymentMethodId: ''
    });
  }

  getCategoryClass(category: string): string {
    return 'category--' + category.toLowerCase().replace(/\s+/g, '-');
  }

  getCategoryIcon(category: string): string {
    return this.categoryOptions.find(option => option.category === category)?.icon || 'fa-tag';
  }

  get hasActiveFilters(): boolean {
    const { search, category, paymentMethodId } = this.filtersForm.value;
    return Boolean(search?.trim() || category || paymentMethodId || this.hasCustomDateRange);
  }

  get activeCategory(): string {
    return this.filtersForm.get('category')?.value || '';
  }

  get amountSortLabel(): string {
    return this.sortColumn === 'amount' && this.sortAsc ? 'Menor monto' : 'Mayor monto';
  }

  get amountSortIcon(): string {
    return this.sortColumn === 'amount' && this.sortAsc ? 'fa-arrow-up' : 'fa-arrow-down';
  }

  ngOnInit(): void {
    this.paymentMethodsService.getAll().pipe(takeUntil(this.unsubscribe$)).subscribe({
      next: methods => {
        this.paymentMethods = methods.filter(method => Boolean(method.uid));
        this.paymentMethodsLoading = false;
        this.paymentMethodsError = false;
      },
      error: () => {
        this.paymentMethodsLoading = false;
        this.paymentMethodsError = true;
      }
    });
    this.dateFilter$.pipe(
      takeUntil(this.unsubscribe$),
      switchMap(({ from, to }) => this.expensesService.getAll(from, to))
    ).subscribe((expenses) => {
      this.fireExpenses = expenses;
      this.loadingPage = false;
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
    let expenses = this.fireExpenses;
    this.totalAmountFiltered = 0;
    // filters
    const { search, category, paymentMethodId } = this.filtersForm.value;

    if (paymentMethodId) {
      expenses = expenses.filter(expense => paymentMethodId === this.unassignedPaymentMethod
        ? !expense.paymentMethodId
        : expense.paymentMethodId === paymentMethodId);
    }

    if (search !== '') {
      expenses = expenses.filter(expense => expense.title.toLowerCase().includes(search.toLowerCase()) || expense.amount.toLowerCase().includes(search.toLowerCase()));
      this.totalAmountFiltered = expenses.reduce((acc, expense) => acc + +expense.amount, 0);
    } else {
      this.totalAmountFiltered = 0;
    }

    if (category !== '') {
      expenses = expenses.filter(expense => expense.category === category);
      this.totalAmountFiltered = expenses.reduce((acc, expense) => acc + +expense.amount, 0);
    }
    this.totalAmountFiltered = expenses.reduce((acc, expense) => acc + +expense.amount, 0);
    this.collectionSize = expenses.length;

    // paginate
    expenses = expenses.slice((this.page - 1) * this.pageSize, (this.page - 1) * this.pageSize + this.pageSize);
    this.expenses = expenses;
  }

  onOrderBy(type: string) {
    if (this.sortColumn === type) {
      this.sortAsc = !this.sortAsc;
    } else {
      this.sortColumn = type;
      this.sortAsc = false;
    }
    switch (type) {
      case 'amount':
        this.fireExpenses.sort((a, b) => this.sortAsc ? +a.amount - +b.amount : +b.amount - +a.amount);
        break;
      case 'title':
        this.fireExpenses.sort((a, b) => this.sortAsc ? a.title.localeCompare(b.title) : b.title.localeCompare(a.title));
        break;
    }
    this.filter();
  }

  getSortIcon(col: string): string {
    if (this.sortColumn !== col) return 'fa-sort';
    return this.sortAsc ? 'fa-sort-up' : 'fa-sort-down';
  }

  toggleAmountSort(): void {
    this.onOrderBy('amount');
  }

  filterByDate(date: { from: Date | undefined; to: Date | undefined }) {
    this.page = 1;
    this.hasCustomDateRange = Boolean(date.from && date.to);
    this.visibleDateRange = date.from && date.to
      ? { from: new Date(date.from), to: new Date(date.to) }
      : this.getDefaultDateRange();
    this.dateFilter$.next(date);
  }

  selectCategory(category: string): void {
    this.filtersForm.patchValue({ category });
  }

  clearSearch(): void {
    this.filtersForm.patchValue({ search: '' });
  }

  clearFilters(): void {
    this.page = 1;
    this.filtersForm.reset({ search: '', category: '', paymentMethodId: '' });
    this.hasCustomDateRange = false;
    if (this.rangeDateSelector) {
      this.rangeDateSelector.goToCurrentPeriod();
      return;
    }
    this.filterByDate({ from: undefined, to: undefined });
  }

  private getDefaultDateRange(): { from: Date; to: Date } {
    const today = new Date();
    const month = today.getMonth() - (today.getDate() < 19 ? 1 : 0);
    return {
      from: new Date(today.getFullYear(), month, 19),
      to: new Date(today.getFullYear(), month + 1, 18)
    };
  }

  openCreateModal() {
    const modalRef = this.modalService.open(AddExpenseComponent, {
      size: 'sm',
      centered: true,
      windowClass: 'add-expense-modal'
    })
    modalRef.componentInstance.newExpense$.pipe(take(1)).subscribe((expense: Expense) => {
      this.expensesService.save(expense).then(() => {
        this.toastr.success('Gasto creado');
      }).catch(() => {
        this.toastr.error('Ocurrió un error, por favor intenta de nuevo');
      })
    })
  }

  openEditModal(expense: Expense) {
    const modalRef = this.modalService.open(EditExpenseComponent, {
      size: 'sm',
      centered: true,
      windowClass: 'edit-expense-modal'
    })
    modalRef.componentInstance.expense = expense;
    modalRef.componentInstance.editExpense$.pipe(take(1)).subscribe((expense: Expense) => {
      this.expensesService.update(expense).then(() => {
        this.toastr.success('Gasto editado');
      }).catch(() => {
        this.toastr.error('Ocurrió un error, por favor intenta de nuevo');
      })
    })
    modalRef.componentInstance.deleteExpense$.pipe(take(1)).subscribe((id: string) => {
      this.delete(id);
    })
  }

  delete(id: string) {
    this.expensesService.delete(id).then(() => {
      this.toastr.success('Gasto eliminado');
    }).catch(() => {
      this.toastr.error('Ocurrió un error, por favor intenta de nuevo');
    })
  }


  get search() {
    return this.filtersForm.get('search');
  }

  ngOnDestroy() {
    this.unsubscribe$.next(true);
    this.unsubscribe$.unsubscribe();
  }
}
