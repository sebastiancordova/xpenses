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
    const userId = this.userService.currentUserValue.uid;
    if(!userId){
      return of([]);
    }
    let finalStartDate: Date;
    let finalEndDate: Date;
    if (startDate && endDate) {
      finalStartDate = startDate;
      finalEndDate = endDate;
      finalEndDate.setHours(23, 59, 59, 999);
    } else {
      const date = new Date();
      const currentMonth = date.getMonth();
      const currentDay = date.getDate();
      const currentYear = date.getFullYear()

      if (currentDay >= 19) {
        finalStartDate = new Date(currentYear, currentMonth, 19, 0, 0, 0, 0);
        finalEndDate = new Date(currentYear, currentMonth + 1, 18, 23, 59, 59, 999);
      } else {
        finalStartDate = new Date(currentYear, currentMonth - 1, 19, 0, 0, 0, 0);
        finalEndDate = new Date(currentYear, currentMonth, 18, 23, 59, 59, 999);
      }
    }
    console.log(`Buscando gastos entre: ${finalStartDate.toLocaleDateString()} y ${finalEndDate.toLocaleDateString()}`)

    const colRef = collection(this.firestore, `users/${userId}/expenses`) as CollectionReference<Expense>;
    const queryRef = query(colRef, orderBy('createdAt', 'desc'), where('createdAt', '>=', finalStartDate), where('createdAt', '<=', finalEndDate));
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
