import { Injectable, inject } from '@angular/core';
import { CollectionReference, Firestore, Timestamp, addDoc, collection, collectionData, deleteDoc, doc, orderBy, query, updateDoc } from '@angular/fire/firestore';
import { UserService } from './user.service';
import { Auth, authState } from '@angular/fire/auth';
import { Observable, distinctUntilChanged, map, of, switchMap } from 'rxjs';
import { Income } from '@core/models/income';

@Injectable({
  providedIn: 'root'
})
export class IncomesService {

  private userService = inject(UserService);
  private firestore: Firestore = inject(Firestore);
  private auth = inject(Auth);

  getAll(): Observable<Income[]> {
    return authState(this.auth).pipe(
      map(user => user?.uid),
      distinctUntilChanged(),
      switchMap(userId => {
        if (!userId) return of([] as Income[]);
        const colRef = collection(this.firestore, `users/${userId}/incomes`) as CollectionReference<Income>;
        const queryRef = query(colRef, orderBy('createdAt', 'desc'));
        return collectionData(queryRef, { idField: 'uid' }) as Observable<Income[]>;
      })
    );
  }

  /** Gets incomes for one calendar month while keeping pre-period records accessible. */
  getForPeriod(period: string): Observable<Income[]> {
    return this.getAll().pipe(
      map(incomes => incomes.filter(income => this.getIncomePeriod(income) === period))
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

  getIncomePeriod(income: Income): string {
    if (income.period) return income.period;
    const createdAt = income.createdAt?.toDate();
    if (!createdAt) return '';
    return `${createdAt.getFullYear()}-${String(createdAt.getMonth() + 1).padStart(2, '0')}`;
  }

}
