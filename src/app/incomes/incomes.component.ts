import { Component, inject } from '@angular/core';
import { FormBuilder, FormGroup } from '@angular/forms';
import { IUser } from '@core/models/user';
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
  private fireIncomes: Income[] = [];
  public incomes: Income[] = [];
  public totalAmountFiltered = 0;

  constructor() {
    this.filtersForm = this.fb.group({
      search: ''
    });
  }

  ngOnInit(): void {
    this.incomesService.getAll().pipe(takeUntil(this.unsubscribe$)).subscribe((incomes) => {
      this.fireIncomes = incomes;
      this.filter();
    });
    this.filtersForm.valueChanges
      .pipe(takeUntil(this.unsubscribe$), debounceTime(200), tap(() => this.filter()))
      .subscribe();

  }

  filter() {
    let incomes = this.fireIncomes;
    // filters
    const { search } = this.filtersForm.value;

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

  ngOnDestroy() {
    this.unsubscribe$.next(true);
    this.unsubscribe$.unsubscribe();
  }
}
