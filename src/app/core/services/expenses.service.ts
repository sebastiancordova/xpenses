import { Injectable, inject } from '@angular/core';
import { CollectionReference, Firestore, collection, collectionData, Timestamp, addDoc, doc, orderBy, query } from '@angular/fire/firestore';
import { Expense } from '@core/models/expense';
import { Observable, switchMap, of } from 'rxjs';
import { UserService } from './user.service';

@Injectable({
  providedIn: 'root'
})
export class ExpensesService {
  private userService = inject(UserService);
  private firestore: Firestore = inject(Firestore);
  private expensesCollection!: CollectionReference<Expense>;
  constructor() { }

  getAll(): Observable<Expense[]> {
    return this.userService.currentUser.pipe(
      switchMap(user => {
        if (user) {
          const colRef = collection(this.firestore, `users/${user.uid}/expenses`) as CollectionReference<Expense>;
          const queryRef = query(colRef, orderBy('createdAt', 'desc')); // Add the orderBy clause here
          return collectionData(queryRef); // Use the modified query reference
        }
        return of([]);
      })
    );
  }

  save(expense: Expense) {
    const colRef = collection(this.firestore, `users/${this.userService.currentUserValue.uid}/expenses`) as CollectionReference<Expense>;
    expense.createdAt = Timestamp.now();
    expense.updatedAt = Timestamp.now();
    return addDoc(colRef, expense);
  }
}
