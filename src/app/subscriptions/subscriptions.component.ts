import { Component, inject } from '@angular/core';
import { FormBuilder, FormGroup } from '@angular/forms';
import { NgbModal } from '@ng-bootstrap/ng-bootstrap';
import { ToastrService } from 'ngx-toastr';
import { Subject, debounceTime, take, takeUntil, tap } from 'rxjs';
import { AddSubscriptionComponent } from './add-subscription/add-subscription.component';
import { EditSubscriptionsComponent } from './edit-subscription/edit-subscription.component';
import { SubscriptionsService } from '@core/services/subscriptions.service';
import { Subscription } from '@core/models/subscriptions';

@Component({
  selector: 'app-subscriptions',
  templateUrl: './subscriptions.component.html',
  styleUrls: ['./subscriptions.component.scss']
})
export class SubscriptionsComponent {
  public filtersForm: FormGroup;
  private unsubscribe$ = new Subject<boolean>();
  public loadingPage = true;
  public page = 1;
  public pageSize = 8;
  public collectionSize = 1;
  private subscriptionsService: SubscriptionsService = inject(SubscriptionsService);
  private fb: FormBuilder = inject(FormBuilder);
  private toastr: ToastrService = inject(ToastrService);
  private modalService: NgbModal = inject(NgbModal);
  private fireSubscriptions: Subscription[] = [];
  public subscriptions: Subscription[] = [];
  public totalAmountFiltered = 0;

  constructor() {
    this.filtersForm = this.fb.group({
      search: ''
    });
  }

  ngOnInit(): void {
    this.subscriptionsService.getAll().pipe(takeUntil(this.unsubscribe$)).subscribe((subscriptions) => {
      this.fireSubscriptions = subscriptions;
      this.filter();
    });
    this.filtersForm.valueChanges
      .pipe(takeUntil(this.unsubscribe$), debounceTime(200), tap(() => this.filter()))
      .subscribe();

  }

  filter() {
    let subscriptions = this.fireSubscriptions;
    // filters
    const { search } = this.filtersForm.value;

    if (search !== '') {
      subscriptions = subscriptions.filter(subscription => subscription.title.toLowerCase().includes(search.toLowerCase()) || subscription.amount.toLowerCase().includes(search.toLowerCase()));
    }

    this.collectionSize = subscriptions.length;
    this.totalAmountFiltered = subscriptions.reduce((acc, subscription) => acc + +subscription.amount, 0);
    // paginate
    subscriptions = subscriptions.slice((this.page - 1) * this.pageSize, (this.page - 1) * this.pageSize + this.pageSize);
    this.subscriptions = subscriptions;
    this.loadingPage = false;
  }

  openCreateModal() {
    const modalRef = this.modalService.open(AddSubscriptionComponent, {
      size: 'sm',
      centered: true,
      windowClass: 'add-subscription-modal',
    })
    modalRef.componentInstance.newSubscription$.pipe(take(1)).subscribe((subscription: Subscription) => {
      this.subscriptionsService.save(subscription).then(() => {
        this.toastr.success('Subscripción añadida');
      }).catch(() => {
        this.toastr.error('Ocurrió un error, por favor intenta de nuevo');
      })
    })
  }

  openEditModal(subscription: Subscription) {
    const modalRef = this.modalService.open(EditSubscriptionsComponent, {
      size: 'sm',
      centered: true,
      windowClass: 'edit-subscription-modal'
    })
    modalRef.componentInstance.subscription = subscription;
    modalRef.componentInstance.editSubscription$.pipe(take(1)).subscribe((subscription: Subscription) => {
      this.subscriptionsService.update(subscription).then(() => {
        this.toastr.success('Subscripción editada');
      }).catch(() => {
        this.toastr.error('Ocurrió un error, por favor intenta de nuevo');
      })
    })
    modalRef.componentInstance.deleteSubscription$.pipe(take(1)).subscribe((id: string) => {
      this.delete(id);
    })
  }

  delete(id: string) {
    this.subscriptionsService.delete(id).then(() => {
      this.toastr.success('Subscripción eliminada');
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
