import { Injectable, inject } from '@angular/core';
import {
  Firestore,
  CollectionReference,
  collection,
  collectionData,
  doc,
  addDoc,
  updateDoc,
  deleteDoc,
  query,
  orderBy,
  Timestamp,
} from '@angular/fire/firestore';
import { combineLatest, firstValueFrom, Observable, of } from 'rxjs';
import { map, tap } from 'rxjs/operators';
import { InstallmentPurchase } from '@core/models/installment-purchase';
import { UserService } from './user.service';
import { UserPreferencesService } from './user-preferences.service';

@Injectable({ providedIn: 'root' })
export class InstallmentPurchasesService {
  private firestore = inject(Firestore);
  private userService = inject(UserService);
  private preferencesService = inject(UserPreferencesService);

  private colPath(): string {
    return `users/${this.userService.currentUserValue.uid}/installment-purchases`;
  }

  getAll(): Observable<InstallmentPurchase[]> {
    const uid = this.userService.currentUserValue.uid;
    if (!uid) return of([]);
    const colRef = collection(this.firestore, this.colPath()) as CollectionReference<InstallmentPurchase>;
    const q = query(colRef, orderBy('createdAt', 'desc'));
    const purchases$ = collectionData(q, { idField: 'uid' }) as Observable<InstallmentPurchase[]>;
    return combineLatest([purchases$, this.preferencesService.getPreferences()]).pipe(
      tap(([purchases, preferences]) => this.syncCalculatedStatuses(purchases, preferences.billingCycleDay)),
      map(([purchases, preferences]) => this.applyConfiguredPaymentDay(purchases, preferences.billingCycleDay))
    );
  }

  /**
   * Returns every purchase with a scheduled installment in [start, end].
   * Completed purchases are intentionally included so historical dashboards
   * show the installment that belonged to that past statement.
   */
  getInstallmentsForCycle(start: Date, end: Date): Observable<InstallmentPurchase[]> {
    const uid = this.userService.currentUserValue.uid;
    if (!uid) return of([]);
    const colRef = collection(this.firestore, this.colPath()) as CollectionReference<InstallmentPurchase>;
    const q = query(colRef, orderBy('createdAt', 'desc'));
    const purchases$ = collectionData(q, { idField: 'uid' }) as Observable<InstallmentPurchase[]>;
    return combineLatest([purchases$, this.preferencesService.getPreferences()]).pipe(
      // Keep records in sync even when the dashboard is the first screen visited.
      tap(([purchases, preferences]) => this.syncCalculatedStatuses(purchases, preferences.billingCycleDay)),
      map(([purchases, preferences]) => this.applyConfiguredPaymentDay(purchases, preferences.billingCycleDay)),
      map(purchases => purchases.filter(p =>
        p.startDate &&
        this.hasPaymentInCycle(p, start, end)
      ))
    );
  }

  async save(purchase: InstallmentPurchase): Promise<any> {
    const uid = this.userService.currentUserValue.uid;
    const colRef = collection(this.firestore, `users/${uid}/installment-purchases`) as CollectionReference<InstallmentPurchase>;
    const { billingCycleDay } = await firstValueFrom(this.preferencesService.getPreferences());
    const startDate = purchase.startDate.toDate();
    purchase.paymentDay = billingCycleDay;
    purchase.currentInstallment = this.getPaidInstallments(startDate, billingCycleDay, purchase.totalInstallments);
    purchase.status = this.isCompleted(startDate, billingCycleDay, purchase.totalInstallments) ? 'completed' : 'active';
    purchase.createdAt = Timestamp.now();
    purchase.updatedAt = Timestamp.now();
    return addDoc(colRef, purchase);
  }

  async update(purchase: InstallmentPurchase): Promise<void> {
    const uid = this.userService.currentUserValue.uid;
    const docRef = doc(this.firestore, `users/${uid}/installment-purchases/${purchase.uid}`);
    const { billingCycleDay } = await firstValueFrom(this.preferencesService.getPreferences());
    const startDate = purchase.startDate.toDate();
    purchase.paymentDay = billingCycleDay;
    purchase.currentInstallment = this.getPaidInstallments(startDate, billingCycleDay, purchase.totalInstallments);
    purchase.status = this.isCompleted(startDate, billingCycleDay, purchase.totalInstallments) ? 'completed' : 'active';
    purchase.updatedAt = Timestamp.now();
    return updateDoc(docRef, { ...purchase });
  }

  delete(id: string): Promise<void> {
    const uid = this.userService.currentUserValue.uid;
    return deleteDoc(doc(this.firestore, `users/${uid}/installment-purchases/${id}`));
  }

  /**
   * Returns the first calendar date on which the first payment is due.
   * If the purchase started before or on paymentDay of the same month → same month.
   * If it started after paymentDay → next month.
   */
  getFirstPaymentDate(startDate: Date, paymentDay: number): Date {
    if (startDate.getDate() <= paymentDay) {
      return new Date(startDate.getFullYear(), startDate.getMonth(), paymentDay);
    }
    return new Date(startDate.getFullYear(), startDate.getMonth() + 1, paymentDay);
  }

  /**
   * Returns the next installment that will be charged, using the same
   * convention people see in their bank statement (for example, 9/10).
   * It intentionally differs from getPaidInstallments: this installment is
   * still included in the amount pending to pay.
   */
  getUpcomingInstallment(startDate: Date, paymentDay: number, total: number, referenceDate = new Date()): number {
    const paidInstallments = this.getPaidInstallments(startDate, paymentDay, total, referenceDate);
    return Math.min(paidInstallments + 1, total);
  }

  /** Includes the current billing period's installment, when there is one. */
  getRemainingInstallments(startDate: Date, paymentDay: number, total: number, referenceDate = new Date()): number {
    return Math.max(0, total - this.getPaidInstallments(startDate, paymentDay, total, referenceDate));
  }

  getPaidInstallments(startDate: Date, paymentDay: number, total: number, referenceDate = new Date()): number {
    const today = this.startOfDay(referenceDate);
    const firstPayment = this.getFirstPaymentDate(startDate, paymentDay);
    let count = 0;
    for (let i = 0; i < total; i++) {
      const paymentDate = new Date(firstPayment.getFullYear(), firstPayment.getMonth() + i, paymentDay);
      if (paymentDate < today) count++;
      else break;
    }
    return Math.min(Math.max(count, 0), total);
  }

  isCompleted(startDate: Date, paymentDay: number, total: number, referenceDate = new Date()): boolean {
    return this.getPaidInstallments(startDate, paymentDay, total, referenceDate) >= total;
  }

  /** Returns true if any of the installment payment dates falls within [start, end]. */
  hasPaymentInCycle(p: InstallmentPurchase, start: Date, end: Date): boolean {
    return this.getInstallmentInCycle(p, start, end) !== null;
  }

  /** Returns the 1-based installment scheduled within a dashboard period. */
  getInstallmentInCycle(p: InstallmentPurchase, start: Date, end: Date): number | null {
    const startDate = p.startDate.toDate();
    const firstPayment = this.getFirstPaymentDate(startDate, p.paymentDay);
    for (let i = 0; i < p.totalInstallments; i++) {
      const paymentDate = new Date(firstPayment.getFullYear(), firstPayment.getMonth() + i, p.paymentDay);
      if (paymentDate >= start && paymentDate <= end) return i + 1;
      if (paymentDate > end) break;
    }
    return null;
  }

  private syncCalculatedStatuses(purchases: InstallmentPurchase[], billingCycleDay: number): void {
    const uid = this.userService.currentUserValue.uid;
    if (!uid) return;
    purchases.forEach(p => {
      if (p.uid && p.startDate) {
        const paymentDay = billingCycleDay;
        const paidInstallments = this.getPaidInstallments(p.startDate.toDate(), paymentDay, p.totalInstallments);
        const status = paidInstallments >= p.totalInstallments ? 'completed' : 'active';
        if (p.status !== status || p.currentInstallment !== paidInstallments || p.paymentDay !== paymentDay) {
          const docRef = doc(this.firestore, `users/${uid}/installment-purchases/${p.uid}`);
          updateDoc(docRef, { paymentDay, status, currentInstallment: paidInstallments, updatedAt: Timestamp.now() });
        }
      }
    });
  }

  /** Keeps persisted purchases aligned with the account-wide billing day. */
  private applyConfiguredPaymentDay(purchases: InstallmentPurchase[], billingCycleDay: number): InstallmentPurchase[] {
    return purchases.map(purchase => {
      return purchase.paymentDay === billingCycleDay ? purchase : { ...purchase, paymentDay: billingCycleDay };
    });
  }

  private startOfDay(date: Date): Date {
    return new Date(date.getFullYear(), date.getMonth(), date.getDate());
  }
}
