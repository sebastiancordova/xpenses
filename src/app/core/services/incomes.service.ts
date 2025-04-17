import { Injectable, inject } from '@angular/core';
import { CollectionReference, Firestore, Timestamp, addDoc, collection, collectionData, deleteDoc, doc, orderBy, query, updateDoc } from '@angular/fire/firestore';
import { UserService } from './user.service';
import { Observable, of, switchMap } from 'rxjs';
import { Income } from '@core/models/income';

@Injectable({
  providedIn: 'root'
})
export class IncomesService {

  private userService = inject(UserService);
  private firestore: Firestore = inject(Firestore);

  getAll(): Observable<Income[]> {
    return this.userService.currentUser.pipe(
      switchMap(user => {
        if (user) {
          const colRef = collection(this.firestore, `users/${user.uid}/incomes`) as CollectionReference<Income>;
          const queryRef = query(colRef, orderBy('createdAt', 'desc'));
          return collectionData(queryRef, { idField: 'uid' });
        }
        return of([]);
      })
    );
  }

  save(expense: Income) {
    const colRef = collection(this.firestore, `users/${this.userService.currentUserValue.uid}/incomes`) as CollectionReference<Income>;
    expense.createdAt = Timestamp.now();
    expense.updatedAt = Timestamp.now();
    return addDoc(colRef, expense);
  }

  update(expense: Income) {
    const docRef = doc(this.firestore, `users/${this.userService.currentUserValue.uid}/incomes/${expense.uid}`);
    expense.updatedAt = Timestamp.now();
    return updateDoc(docRef, { ...expense });
  }

  delete(id: string) {
    const docRef = doc(this.firestore, `users/${this.userService.currentUserValue.uid}/incomes/${id}`)
    return deleteDoc(docRef);
  }

}
