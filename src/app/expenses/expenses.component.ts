import { Component, OnDestroy, inject } from '@angular/core';
import { FormBuilder, FormGroup } from '@angular/forms';
import { IUser } from '@core/models/user';
import { AuthService } from '@core/services/auth.service';
import { UserService } from '@core/services/user.service';
import { NgbModal } from '@ng-bootstrap/ng-bootstrap';
import { ToastrService } from 'ngx-toastr';
import { Observable, Subject, skip, skipUntil, skipWhile, takeUntil, tap } from 'rxjs';
import { AddExpenseComponent } from './add-expense/add-expense.component';
import { ExpensesService } from '@core/services/expenses.service';
import { Expense } from '@core/models/expense';

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
  public expenses$ = new Observable<Expense[]>;
  private expensesService: ExpensesService = inject(ExpensesService);
  private fb: FormBuilder = inject(FormBuilder);
  private toastr: ToastrService = inject(ToastrService);
  private modalService: NgbModal = inject(NgbModal);

  constructor() {
    this.filtersForm = this.fb.group({
      search: ''
    });
  }

  ngOnInit(): void {
    this.expenses$ = this.expensesService.getAll();
    this.loadingPage = false;
  }


  filter() {

  }


  openCreateModal() {
    const modalRef = this.modalService.open(AddExpenseComponent, {
      size: 'sm',
      centered: true,
      windowClass: 'add-expense-modal'
    })
    modalRef.componentInstance.newExpense$.subscribe((expense: Expense) => {
      this.expensesService.save(expense).then(() => {
        this.toastr.success('Expense added successfully');
      }).catch(() => {
        this.toastr.error('An error occurred, please try again');
      })
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
