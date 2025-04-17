import { Injectable, inject } from '@angular/core';
import { CollectionReference, Firestore, collection, collectionData, orderBy, query, Timestamp, addDoc, deleteDoc, doc, updateDoc } from '@angular/fire/firestore';
import { FixedExpense } from '@core/models/expense';
import { UserService } from './user.service';
import { Observable, of, switchMap } from 'rxjs';

@Injectable({
  providedIn: 'root'
})
export class FixedExpensesService {

  private userService = inject(UserService);
  private firestore: Firestore = inject(Firestore);

  getAll(): Observable<FixedExpense[]> {
    return this.userService.currentUser.pipe(
      switchMap(user => {
        if (user) {
          const colRef = collection(this.firestore, `users/${user.uid}/fixed-expenses`) as CollectionReference<FixedExpense>;
          const queryRef = query(colRef, orderBy('createdAt', 'desc'));
          return collectionData(queryRef, { idField: 'uid' });
        }
        return of([]);
      })
    );
  }

  save(expense: FixedExpense) {
    const colRef = collection(this.firestore, `users/${this.userService.currentUserValue.uid}/fixed-expenses`) as CollectionReference<FixedExpense>;
    expense.createdAt = Timestamp.now();
    expense.updatedAt = Timestamp.now();
    return addDoc(colRef, expense);
  }

  update(expense: FixedExpense) {
    const docRef = doc(this.firestore, `users/${this.userService.currentUserValue.uid}/fixed-expenses/${expense.uid}`);
    expense.updatedAt = Timestamp.now();
    return updateDoc(docRef, { ...expense });
  }

  delete(id: string) {
    const docRef = doc(this.firestore, `users/${this.userService.currentUserValue.uid}/fixed-expenses/${id}`)
    return deleteDoc(docRef);
  }

}
