import { Injectable, inject } from '@angular/core';
import { CollectionReference, Firestore, collection, collectionData, Timestamp, addDoc, doc, orderBy, query, deleteDoc, updateDoc, where, endAt } from '@angular/fire/firestore';
import { Expense } from '@core/models/expense';
import { Observable, switchMap, of, skipWhile } from 'rxjs';
import { UserService } from './user.service';

@Injectable({
  providedIn: 'root'
})
export class ExpensesService {
  private userService = inject(UserService);
  private firestore: Firestore = inject(Firestore);
  private expensesCollection!: CollectionReference<Expense>;
  constructor() { }

  getAll(startDate?: Date, endDate?: Date): Observable<Expense[]> {
    if (!startDate && !endDate) {
      const date = new Date();
      const month = date.getMonth();
      const day = date.getDate();
      const year = date.getFullYear()
      if (day > 18) {
        startDate = new Date(year, month + 1, day);
      }
      startDate = new Date(year, 5, 19);
      //console.log(startDate)
      endDate = date;
    }
    const userId = this.userService.currentUserValue.uid;


    const colRef = collection(this.firestore, `users/${userId}/expenses`) as CollectionReference<Expense>;
    const queryRef = query(colRef, orderBy('createdAt', 'desc'), where('createdAt', '>=', startDate));
    return collectionData(queryRef, { idField: 'uid' }) as Observable<Expense[]>;

  }

  save(expense: Expense) {
    const colRef = collection(this.firestore, `users/${this.userService.currentUserValue.uid}/expenses`) as CollectionReference<Expense>;
    expense.createdAt = Timestamp.now();
    expense.updatedAt = Timestamp.now();
    return addDoc(colRef, expense);
  }

  update(expense: Expense) {
    const docRef = doc(this.firestore, `users/${this.userService.currentUserValue.uid}/expenses/${expense.uid}`);
    expense.updatedAt = Timestamp.now();
    return updateDoc(docRef, { ...expense });
  }

  delete(id: string) {
    const docRef = doc(this.firestore, `users/${this.userService.currentUserValue.uid}/expenses/${id}`)
    return deleteDoc(docRef);
  }
}
