import { Component, EventEmitter, Input, Output, ViewEncapsulation, inject } from '@angular/core';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { Income } from '@core/models/income';
import { Subscription } from '@core/models/subscriptions';
import { NgbActiveModal } from '@ng-bootstrap/ng-bootstrap';

@Component({
  selector: 'app-edit-subscription',
  templateUrl: './edit-subscription.component.html',
  styleUrls: ['./edit-subscription.component.scss'],
  encapsulation: ViewEncapsulation.None
})
export class EditSubscriptionsComponent {
  @Output() editSubscription$ = new EventEmitter<Subscription>();
  @Output() deleteSubscription$ = new EventEmitter<string>();
  @Input() subscription!: Subscription
  public editSubscriptionForm!: FormGroup;
  public loading = false
  public activeModal: NgbActiveModal = inject(NgbActiveModal);

  private fb: FormBuilder = inject(FormBuilder);
  constructor() {
    this.editSubscriptionForm = this.fb.group({
      title: ['', Validators.required],
      amount: ['', Validators.required]
    })

  }

  ngOnInit(): void {
    this.title?.setValue(this.subscription.title);
    this.amount?.setValue(this.subscription.amount);
  }

  submit() {
    this.loading = true;
    const editSubscription: Income = { ...this.subscription, ...this.editSubscriptionForm.value };
    this.editSubscription$.emit(editSubscription)
    this.activeModal.close();
  }

  delete() {
    this.loading = true;
    this.deleteSubscription$.emit(this.subscription.uid);
    this.activeModal.close();
  }

  get title() {
    return this.editSubscriptionForm.get('title');
  }
  get amount() {
    return this.editSubscriptionForm.get('amount');
  }
}
