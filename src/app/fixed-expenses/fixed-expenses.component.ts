import { Component, OnDestroy, inject } from '@angular/core';
import { FormBuilder, FormGroup } from '@angular/forms';
import { IUser } from '@core/models/user';
import { NgbModal } from '@ng-bootstrap/ng-bootstrap';
import { ToastrService } from 'ngx-toastr';
import { Subject, debounceTime, take, takeUntil, tap } from 'rxjs';
import { FixedExpense } from '@core/models/expense';
import { AddFixedExpenseComponent } from './add-fixed-expense/add-fixed-expense.component';
import { FixedExpensesService } from '@core/services/fixed-expenses.service';
import { EditFixedExpenseComponent } from './edit-fixed-expense/edit-fixed-expense.component';

@Component({
  selector: 'app-fixed-expenses',
  templateUrl: './fixed-expenses.component.html',
  styleUrls: ['./fixed-expenses.component.scss']
})
export class FixedExpensesComponent implements OnDestroy {
  public filtersForm: FormGroup;
  private unsubscribe$ = new Subject<boolean>();
  public loadingPage = true;
  public currentUser!: IUser;
  public page = 1;
  public pageSize = 8;
  public collectionSize = 1;
  public fixedExpenses: FixedExpense[] = [];
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
  }

  ngOnInit(): void {
    this.fixedExpensesService.getAll().pipe(takeUntil(this.unsubscribe$)).subscribe((fixedExpenses) => {
      console.log(fixedExpenses);
      this.fireFixedExpenses = fixedExpenses;
      this.filter();
    });
    this.filtersForm.valueChanges
      .pipe(takeUntil(this.unsubscribe$), debounceTime(200), tap(() => this.filter()))
      .subscribe();

  }

  filter() {
    let fixedExpenses = this.fireFixedExpenses;
    this.totalAmountFiltered = 0;
    // filters
    const { search } = this.filtersForm.value;

    if (search !== '') {
      fixedExpenses = fixedExpenses.filter(expense => expense.title.toLowerCase().includes(search.toLowerCase()) || expense.amount.toLowerCase().includes(search.toLowerCase()));
    }

    this.totalAmountFiltered = fixedExpenses.reduce((acc, expense) => acc + +expense.amount, 0);
    this.collectionSize = fixedExpenses.length;

    // paginate
    fixedExpenses = fixedExpenses.slice((this.page - 1) * this.pageSize, (this.page - 1) * this.pageSize + this.pageSize);
    this.fixedExpenses = fixedExpenses;
    this.loadingPage = false;
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
    this.unsubscribe$.next(true);
    this.unsubscribe$.unsubscribe();
  }
}
