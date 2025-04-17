import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';

import { SubscriptionRoutingModule } from './subscriptions-routing.module';
import { AddSubscriptionComponent } from './add-subscription/add-subscription.component';
import { SharedModule } from '@shared/shared.module';
import { EditSubscriptionsComponent } from './edit-subscription/edit-subscription.component';
import { SubscriptionsComponent } from './subscriptions.component';


@NgModule({
  declarations: [
    AddSubscriptionComponent,
    SubscriptionsComponent,
    EditSubscriptionsComponent
  ],
  imports: [
    CommonModule,
    SubscriptionRoutingModule,
    SharedModule
  ]
})
export class SubscriptionsModule { }
