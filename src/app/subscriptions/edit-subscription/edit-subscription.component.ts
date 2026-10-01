import { Component, EventEmitter, Input, Output, ViewEncapsulation, inject } from '@angular/core';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { Subscription } from '@core/models/subscriptions';
import { NgbActiveModal } from '@ng-bootstrap/ng-bootstrap';
import { PaymentMethod } from '@core/models/payment-method';
import { PaymentMethodsService } from '@core/services/payment-methods.service';
import { UserPreferencesService } from '@core/services/user-preferences.service';
import { firstValueFrom } from 'rxjs';

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
  public paymentMethods: PaymentMethod[] = [];

  private fb: FormBuilder = inject(FormBuilder);
  private paymentMethodsService = inject(PaymentMethodsService);
  private preferencesService = inject(UserPreferencesService);
  constructor() {
    this.editSubscriptionForm = this.fb.group({
      title: ['', Validators.required],
      amount: ['', Validators.required],
      paymentMethodId: ['', Validators.required]
    })

  }

  async ngOnInit(): Promise<void> {
    const preferences = await firstValueFrom(this.preferencesService.getPreferences());
    const defaultMethod = await this.paymentMethodsService.ensureDefault(preferences.billingCycleDay);
    const methods = await firstValueFrom(this.paymentMethodsService.getAll());
    const selectedMethod = methods.find(method => method.uid === this.subscription.paymentMethodId)
      || methods.find(method => method.name === this.subscription.paymentMethodId)
      || defaultMethod;
    this.paymentMethods = methods.filter(method => method.isActive || method.uid === selectedMethod.uid);
    this.title?.setValue(this.subscription.title);
    this.amount?.setValue(this.subscription.amount);
    this.paymentMethodId?.setValue(selectedMethod.uid);
  }

  submit(): void {
    if (this.editSubscriptionForm.invalid || this.loading) {
      this.editSubscriptionForm.markAllAsTouched();
      return;
    }
    this.loading = true;
    const editSubscription: Subscription = { ...this.subscription, ...this.editSubscriptionForm.value };
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
  get paymentMethodId() { return this.editSubscriptionForm.get('paymentMethodId'); }
}
