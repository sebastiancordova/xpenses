import { Component, OnDestroy, inject } from '@angular/core';
import { FormBuilder, FormGroup } from '@angular/forms';
import { IUser } from '@core/models/user';
import { NgbModal } from '@ng-bootstrap/ng-bootstrap';
import { ToastrService } from 'ngx-toastr';
import { Subject, debounceTime, take, takeUntil, tap } from 'rxjs';
import { AddExpenseComponent } from './add-expense/add-expense.component';
import { ExpensesService } from '@core/services/expenses.service';
import { Expense, ExpenseCategory } from '@core/models/expense';
import { EditExpenseComponent } from './edit-expense/edit-expense.component';

@Component({
  selector: 'app-expenses',
  templateUrl: './expenses.component.html',
  styleUrls: ['./expenses.component.scss']
})
export class ExpensesComponent implements OnDestroy {
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
  public expenseCategory = ExpenseCategory;

  constructor() {
    this.filtersForm = this.fb.group({
      search: '',
      category: ''
    });
  }

  ngOnInit(): void {
    this.expensesService.getAll().pipe(takeUntil(this.unsubscribe$)).subscribe((expenses) => {
      console.log(expenses);
      this.fireExpenses = expenses;
      this.loadingPage = false;
      this.filter();
    });
    this.filtersForm.valueChanges
      .pipe(takeUntil(this.unsubscribe$), debounceTime(200), tap(() => this.filter()))
      .subscribe();
  }

  filter() {
    let expenses = this.fireExpenses;
    this.totalAmountFiltered = 0;
    // filters
    const { search, category } = this.filtersForm.value;

    if (search !== '') {
      expenses = expenses.filter(expense => expense.title.toLowerCase().includes(search.toLowerCase()) || expense.amount.toLowerCase().includes(search.toLowerCase()));
      this.totalAmountFiltered = expenses.reduce((acc, expense) => acc + +expense.amount, 0);
    } else {
      this.totalAmountFiltered = 0;
    }

    if (category !== '') {
      expenses = expenses.filter(expense => expense.category === category);
      this.totalAmountFiltered = expenses.reduce((acc, expense) => acc + +expense.amount, 0);
    } else {
      this.totalAmountFiltered = 0;
    }
    this.collectionSize = expenses.length;

    // paginate
    expenses = expenses.slice((this.page - 1) * this.pageSize, (this.page - 1) * this.pageSize + this.pageSize);
    this.expenses = expenses;
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
