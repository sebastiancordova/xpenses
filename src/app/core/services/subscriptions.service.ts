import { Injectable, inject } from '@angular/core';
import { UserService } from './user.service';
import { CollectionReference, Firestore, Timestamp, addDoc, collection, collectionData, deleteDoc, doc, orderBy, query, updateDoc } from '@angular/fire/firestore';
import { Observable, of, switchMap } from 'rxjs';
import { Subscription } from '@core/models/subscriptions';

@Injectable({
  providedIn: 'root'
})
export class SubscriptionsService {

  private userService = inject(UserService);
  private firestore: Firestore = inject(Firestore);

  getAll(): Observable<Subscription[]> {
    return this.userService.currentUser.pipe(
      switchMap(user => {
        if (user) {
          const colRef = collection(this.firestore, `users/${user.uid}/subscriptions`) as CollectionReference<Subscription>;
          const queryRef = query(colRef, orderBy('createdAt', 'desc'));
          return collectionData(queryRef, { idField: 'uid' });
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
