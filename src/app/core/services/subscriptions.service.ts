import { Firestore } from '@core/firebase/firebase.tokens';
import { FirebaseStreamsService } from '@core/firebase/firebase-streams.service';
import { CollectionReference, Timestamp, addDoc, collection, deleteDoc, doc, orderBy, query, updateDoc } from 'firebase/firestore';
import { Injectable, inject } from '@angular/core';
import { UserService } from './user.service';

import { Observable, map, of, switchMap } from 'rxjs';
import { Subscription } from '@core/models/subscriptions';

@Injectable({
  providedIn: 'root'
})
export class SubscriptionsService {
  private readonly firebaseStreams = inject(FirebaseStreamsService);

  private userService = inject(UserService);
  private firestore: Firestore = inject(Firestore);

  getAll(paymentMethodId?: string, legacyPaymentMethodId?: string): Observable<Subscription[]> {
    return this.userService.currentUser.pipe(
      switchMap(user => {
        if (user) {
          const colRef = collection(this.firestore, `users/${user.uid}/subscriptions`) as CollectionReference<Subscription>;
          const queryRef = query(colRef, orderBy('createdAt', 'desc'));
          return (this.firebaseStreams.collectionData(queryRef, { idField: 'uid' }) as Observable<Subscription[]>).pipe(
            map(subscriptions => paymentMethodId
              ? subscriptions.filter(subscription => (subscription.paymentMethodId ?? legacyPaymentMethodId) === paymentMethodId)
              : subscriptions)
          );
        }
        return of([]);
      })
    );
  }

  save(expense: Subscription) {
    const colRef = collection(this.firestore, `users/${this.userService.currentUserValue.uid}/subscriptions`) as CollectionReference<Subscription>;
    expense.createdAt = Timestamp.now();
    expense.updatedAt = Timestamp.now();
    return addDoc(colRef, expense);
  }

  update(expense: Subscription) {
    const docRef = doc(this.firestore, `users/${this.userService.currentUserValue.uid}/subscriptions/${expense.uid}`);
    expense.updatedAt = Timestamp.now();
    return updateDoc(docRef, { ...expense });
  }

  delete(id: string) {
    const docRef = doc(this.firestore, `users/${this.userService.currentUserValue.uid}/subscriptions/${id}`)
    return deleteDoc(docRef);
  }
}
