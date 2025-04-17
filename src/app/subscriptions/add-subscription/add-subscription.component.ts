import { Component, EventEmitter, inject, Output, ViewEncapsulation } from '@angular/core';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { Subscription } from '@core/models/subscriptions';
import { NgbActiveModal } from '@ng-bootstrap/ng-bootstrap';

@Component({
  selector: 'app-add-subscription',
  templateUrl: './add-subscription.component.html',
  styleUrls: ['./add-subscription.component.scss'],
  encapsulation: ViewEncapsulation.None
})
export class AddSubscriptionComponent {
  public addSubscriptionForm!: FormGroup;
  public loading = false
  public activeModal: NgbActiveModal = inject(NgbActiveModal);
  @Output() newSubscription$ = new EventEmitter<Subscription>();
  private fb: FormBuilder = inject(FormBuilder);
  constructor() {
    this.addSubscriptionForm = this.fb.group({
      title: ['', Validators.required],
      amount: ['', Validators.required]
    })

  }

  submit() {
    this.loading = true;
    const newSubscription: Subscription = this.addSubscriptionForm.value;
    this.newSubscription$.emit(newSubscription)
    this.activeModal.close();
  }

  get title() {
    return this.addSubscriptionForm.get('title');
  }
  get amount() {
    return this.addSubscriptionForm.get('amount');
  }
}
