import { Injectable, inject } from '@angular/core';
import { Firestore, CollectionReference, addDoc, collection, collectionData, doc, getDocs, orderBy, query, Timestamp, updateDoc } from '@angular/fire/firestore';
import { Observable, of, switchMap } from 'rxjs';
import { PaymentMethod } from '@core/models/payment-method';
import { UserService } from './user.service';

@Injectable({ providedIn: 'root' })
export class PaymentMethodsService {
  private firestore = inject(Firestore);
  private userService = inject(UserService);

  getAll(): Observable<PaymentMethod[]> {
    return this.userService.currentUser.pipe(
      switchMap(user => {
        if (!user?.uid) return of([]);
        const methods = collection(this.firestore, `users/${user.uid}/payment-methods`) as CollectionReference<PaymentMethod>;
        return collectionData(query(methods, orderBy('createdAt', 'asc')), { idField: 'uid' }) as Observable<PaymentMethod[]>;
      })
    );
  }

  async ensureDefault(billingCycleDay: number): Promise<PaymentMethod> {
    const uid = this.userService.currentUserValue?.uid;
    if (!uid) throw new Error('No hay una sesión activa');
    const methods = collection(this.firestore, `users/${uid}/payment-methods`) as CollectionReference<PaymentMethod>;
    const snapshot = await getDocs(methods);
    const existing = snapshot.docs.map(item => ({ uid: item.id, ...item.data() } as PaymentMethod));
    const preferred = existing.find(method => method.isDefault) || existing.find(method => method.isActive) || existing[0];
    if (preferred) {
      if (!preferred.isDefault) {
        await updateDoc(doc(this.firestore, `users/${uid}/payment-methods/${preferred.uid}`), { isDefault: true, updatedAt: Timestamp.now() });
      }
      return { ...preferred, isDefault: true };
    }

    const method: PaymentMethod = {
      name: 'Tarjeta principal',
      type: 'credit',
      billingCycleDay,
      isActive: true,
      isDefault: true,
      createdAt: Timestamp.now(),
      updatedAt: Timestamp.now(),
    };
    const created = await addDoc(methods, method);
    return { ...method, uid: created.id };
  }

  async save(method: Omit<PaymentMethod, 'createdAt' | 'updatedAt' | 'uid'>): Promise<void> {
    const uid = this.userService.currentUserValue?.uid;
    if (!uid) throw new Error('No hay una sesión activa');
    const methods = collection(this.firestore, `users/${uid}/payment-methods`) as CollectionReference<PaymentMethod>;
    // Use a direct read here. A live collection subscription may not have emitted
    // yet when a person adds a second method immediately after opening Settings.
    const current = await getDocs(methods);
    const document: Omit<PaymentMethod, 'uid'> = {
      name: method.name,
      type: method.type,
      isActive: method.isActive,
      isDefault: current.empty,
      createdAt: Timestamp.now(),
      updatedAt: Timestamp.now(),
    };
    // Firestore rejects undefined values. Only credit cards have a statement day.
    if (method.type === 'credit' && method.billingCycleDay) {
      document.billingCycleDay = method.billingCycleDay;
    }
    await addDoc(methods, document);
  }

  async update(method: PaymentMethod): Promise<void> {
    const uid = this.userService.currentUserValue?.uid;
    if (!uid || !method.uid) throw new Error('Método de pago no encontrado');
    await updateDoc(doc(this.firestore, `users/${uid}/payment-methods/${method.uid}`), {
      name: method.name,
      type: method.type,
      billingCycleDay: method.type === 'credit' ? method.billingCycleDay : null,
      isActive: method.isActive,
      updatedAt: Timestamp.now(),
    });
  }

  async setActive(method: PaymentMethod, isActive: boolean): Promise<void> {
    const uid = this.userService.currentUserValue?.uid;
    if (!uid || !method.uid) throw new Error('Método de pago no encontrado');
    await updateDoc(doc(this.firestore, `users/${uid}/payment-methods/${method.uid}`), { isActive, updatedAt: Timestamp.now() });
  }
}
