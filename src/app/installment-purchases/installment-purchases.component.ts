import { Component, OnDestroy, OnInit, inject } from '@angular/core';
import { FormBuilder, FormGroup } from '@angular/forms';
import { NgbModal } from '@ng-bootstrap/ng-bootstrap';
import { ToastrService } from 'ngx-toastr';
import { Subject, debounceTime, take, takeUntil, tap } from 'rxjs';
import { InstallmentPurchase } from '@core/models/installment-purchase';
import { InstallmentPurchasesService } from '@core/services/installment-purchases.service';
import { AddInstallmentPurchaseComponent } from './add-installment-purchase/add-installment-purchase.component';
import { EditInstallmentPurchaseComponent } from './edit-installment-purchase/edit-installment-purchase.component';

@Component({
  selector: 'app-installment-purchases',
  templateUrl: './installment-purchases.component.html',
  styleUrls: ['./installment-purchases.component.scss']
})
export class InstallmentPurchasesComponent implements OnInit, OnDestroy {
  public filtersForm: FormGroup;
  private unsubscribe$ = new Subject<boolean>();
  public loadingPage = true;
  public page = 1;
  public pageSize = 8;
  public collectionSize = 0;
  public installmentPurchases: InstallmentPurchase[] = [];
  public fireInstallmentPurchases: InstallmentPurchase[] = [];
  public totalAmountFiltered = 0;

  private service = inject(InstallmentPurchasesService);
  private fb = inject(FormBuilder);
  private toastr = inject(ToastrService);
  private modalService = inject(NgbModal);

  private readonly months = [
    'enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio',
    'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'
  ];

  constructor() {
    this.filtersForm = this.fb.group({ search: '', status: 'all' });
  }

  ngOnInit(): void {
    this.service.getAll().pipe(takeUntil(this.unsubscribe$)).subscribe(purchases => {
      this.fireInstallmentPurchases = purchases;
      this.filter();
    });
    this.filtersForm.valueChanges
      .pipe(takeUntil(this.unsubscribe$), debounceTime(200), tap(() => this.filter()))
      .subscribe();
  }

  filter(): void {
    let purchases = [...this.fireInstallmentPurchases];
    this.totalAmountFiltered = 0;
    const { search, status } = this.filtersForm.value;

    if (search) {
      purchases = purchases.filter(p =>
        p.title.toLowerCase().includes(search.toLowerCase())
      );
    }
    if (status !== 'all') {
      purchases = purchases.filter(p => p.status === status);
    }

    // Active first, then completed
    purchases.sort((a, b) => {
      if (a.status === b.status) return 0;
      return a.status === 'active' ? -1 : 1;
    });

    this.totalAmountFiltered = purchases
      .filter(p => p.status === 'active')
      .reduce((acc, p) => acc + +p.installmentAmount, 0);

    this.collectionSize = purchases.length;
    purchases = purchases.slice((this.page - 1) * this.pageSize, (this.page - 1) * this.pageSize + this.pageSize);
    this.installmentPurchases = purchases;
    this.loadingPage = false;
  }

  getUpcomingInstallment(p: InstallmentPurchase): number {
    if (!p.startDate) return 1;
    return this.service.getUpcomingInstallment(p.startDate.toDate(), p.paymentDay, p.totalInstallments);
  }

  getRemaining(p: InstallmentPurchase): number {
    if (!p.startDate) return p.totalInstallments;
    return this.service.getRemainingInstallments(p.startDate.toDate(), p.paymentDay, p.totalInstallments);
  }

  isLastInstallment(p: InstallmentPurchase): boolean {
    return this.getRemaining(p) === 1;
  }

  getEndingDate(p: InstallmentPurchase): string {
    if (!p.startDate) return '';
    const first = this.service.getFirstPaymentDate(p.startDate.toDate(), p.paymentDay);
    const last = new Date(first.getFullYear(), first.getMonth() + p.totalInstallments - 1, p.paymentDay);
    return `${this.months[last.getMonth()]} ${last.getFullYear()}`;
  }

  openCreateModal(): void {
    const modalRef = this.modalService.open(AddInstallmentPurchaseComponent, {
      size: 'sm',
      centered: true,
      windowClass: 'add-installment-purchase-modal'
    });
    modalRef.componentInstance.newInstallmentPurchase$.pipe(take(1)).subscribe((purchase: InstallmentPurchase) => {
      this.service.save(purchase).then(() => {
        this.toastr.success('Compra en cuotas añadida');
      }).catch(() => {
        this.toastr.error('Ocurrió un error, por favor intenta de nuevo');
      });
    });
  }

  openEditModal(purchase: InstallmentPurchase): void {
    const modalRef = this.modalService.open(EditInstallmentPurchaseComponent, {
      size: 'sm',
      centered: true,
      windowClass: 'edit-installment-purchase-modal'
    });
    modalRef.componentInstance.purchase = purchase;
    modalRef.componentInstance.editInstallmentPurchase$.pipe(take(1)).subscribe((updated: InstallmentPurchase) => {
      this.service.update(updated).then(() => {
        this.toastr.success('Compra en cuotas actualizada');
      }).catch(() => {
        this.toastr.error('Ocurrió un error, por favor intenta de nuevo');
      });
    });
    modalRef.componentInstance.deleteInstallmentPurchase$.pipe(take(1)).subscribe((id: string) => {
      this.service.delete(id).then(() => {
        this.toastr.success('Compra en cuotas eliminada');
      }).catch(() => {
        this.toastr.error('Ocurrió un error, por favor intenta de nuevo');
      });
    });
  }

  ngOnDestroy(): void {
    this.unsubscribe$.next(true);
    this.unsubscribe$.unsubscribe();
  }
}
