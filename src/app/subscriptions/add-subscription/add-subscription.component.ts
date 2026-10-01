import { Component, EventEmitter, inject, Output, ViewEncapsulation } from '@angular/core';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { Subscription } from '@core/models/subscriptions';
import { NgbActiveModal } from '@ng-bootstrap/ng-bootstrap';
import { PaymentMethod } from '@core/models/payment-method';
import { PaymentMethodsService } from '@core/services/payment-methods.service';
import { UserPreferencesService } from '@core/services/user-preferences.service';
import { firstValueFrom } from 'rxjs';

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
  public paymentMethods: PaymentMethod[] = [];
  @Output() newSubscription$ = new EventEmitter<Subscription>();
  private fb: FormBuilder = inject(FormBuilder);
  private paymentMethodsService = inject(PaymentMethodsService);
  private preferencesService = inject(UserPreferencesService);
  constructor() {
    this.addSubscriptionForm = this.fb.group({
      title: ['', Validators.required],
      amount: ['', Validators.required],
      paymentMethodId: ['', Validators.required]
    })

  }

  async ngOnInit(): Promise<void> {
    const preferences = await firstValueFrom(this.preferencesService.getPreferences());
    const defaultMethod = await this.paymentMethodsService.ensureDefault(preferences.billingCycleDay);
    this.paymentMethods = (await firstValueFrom(this.paymentMethodsService.getAll())).filter(method => method.isActive);
    this.addSubscriptionForm.patchValue({ paymentMethodId: defaultMethod.uid });
  }

  submit(): void {
    if (this.addSubscriptionForm.invalid || this.loading) {
      this.addSubscriptionForm.markAllAsTouched();
      return;
    }

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
  get paymentMethodId() { return this.addSubscriptionForm.get('paymentMethodId'); }
}
