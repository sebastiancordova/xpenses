import { Injectable, inject } from '@angular/core';
import { Auth, authState } from '@angular/fire/auth';
import {
  CollectionReference,
  DocumentReference,
  Firestore,
  Timestamp,
  Transaction,
  collection,
  collectionData,
  deleteDoc,
  doc,
  runTransaction,
} from '@angular/fire/firestore';
import { Observable, of, switchMap } from 'rxjs';
import {
  FixedExpenseCharge,
  FixedExpenseChargeInput,
} from '@core/models/fixed-expense-charge';
import {
  getFixedExpenseChargeId,
  getFixedExpenseChargeMonth,
  isFixedExpenseChargeDate,
  selectFixedExpenseChargeSlot,
} from '@core/utils/fixed-expense-charges.utils';

const CHARGES_PATH = 'fixed-expense-charges';

@Injectable({ providedIn: 'root' })
export class FixedExpenseChargesService {
  private readonly firestore = inject(Firestore);
  private readonly auth = inject(Auth);

  getAll(): Observable<FixedExpenseCharge[]> {
    return authState(this.auth).pipe(
      switchMap(user => {
        if (!user?.uid) return of<FixedExpenseCharge[]>([]);
        const charges = collection(
          this.firestore,
          `users/${user.uid}/${CHARGES_PATH}`
        ) as CollectionReference<FixedExpenseCharge>;
        return collectionData(charges, { idField: 'uid' }) as Observable<FixedExpenseCharge[]>;
      })
    );
  }

  async save(input: FixedExpenseChargeInput, existingId?: string): Promise<void> {
    const normalized = validateAndNormalizeInput(input);
    if (existingId !== undefined) validateDocumentId(existingId, 'chargeId');
    const uid = this.requireCurrentUid();
    const chargeId = existingId ?? getFixedExpenseChargeId(normalized.fixedExpenseId, getFixedExpenseChargeMonth(normalized));
    const chargeRef = doc(
      this.firestore,
      `users/${uid}/${CHARGES_PATH}/${chargeId}`
    );
    const fallbackRef = existingId ? undefined : doc(this.firestore, `users/${uid}/${CHARGES_PATH}/${chargeId}_actual`);
    await runTransaction(this.firestore, transaction => writeFixedExpenseCharge(transaction, chargeRef, fallbackRef, normalized, !!existingId));
  }

  async delete(id: string): Promise<void> {
    validateDocumentId(id, 'chargeId');
    const uid = this.requireCurrentUid();
    const chargeRef = doc(
      this.firestore,
      `users/${uid}/${CHARGES_PATH}/${id}`
    );
    await deleteDoc(chargeRef);
  }

  private requireCurrentUid(): string {
    const uid = this.auth.currentUser?.uid;
    if (!uid?.trim()) throw new Error('A signed-in user is required to access fixed expense charges.');
    return uid;
  }
}

/** Transaction body kept independent of the remote runtime for synthetic persistence tests. */
export async function writeFixedExpenseCharge(
  transaction: Pick<Transaction, 'get' | 'set'>,
  chargeRef: DocumentReference,
  fallbackRef: DocumentReference | undefined,
  normalized: FixedExpenseChargeInput,
  editing: boolean
): Promise<void> {
  const preferred = await transaction.get(chargeRef);
  let targetRef = chargeRef;
  let existing = preferred;
  if (editing) {
    if (!preferred.exists() || preferred.data()['fixedExpenseId'] !== normalized.fixedExpenseId) {
      throw new Error('The original monthly charge is missing or belongs to another template.');
    }
  } else {
    if (!fallbackRef) throw new Error('Missing monthly charge fallback reference.');
    const fallback = await transaction.get(fallbackRef);
    const slot = selectFixedExpenseChargeSlot(normalized,
      preferred.exists() ? preferred.data() as FixedExpenseCharge : undefined,
      fallback.exists() ? fallback.data() as FixedExpenseCharge : undefined);
    if (slot === 'fallback') { targetRef = fallbackRef; existing = fallback; }
  }
  const now = Timestamp.now();
  const existingCreatedAt = existing.exists() ? existing.data()['createdAt'] : undefined;
  const charge: Omit<FixedExpenseCharge, 'uid'> = {
    ...normalized,
    createdAt: existingCreatedAt instanceof Timestamp ? existingCreatedAt : now,
    updatedAt: now,
  };
  transaction.set(targetRef, charge);
}

function validateDocumentId(value: string, fieldName: string): void {
  if (typeof value !== 'string' || !value.trim() || value.includes('/')) {
    throw new Error(`${fieldName} must be a nonempty Firestore document ID.`);
  }
}

function validateAndNormalizeInput(input: FixedExpenseChargeInput): FixedExpenseChargeInput {
  if (!input || typeof input !== 'object') {
    throw new Error('Fixed expense charge is required.');
  }

  // Also validates both the source template document ID and YYYY-MM period.
  getFixedExpenseChargeId(input.fixedExpenseId, input.period);

  if (typeof input.title !== 'string' || !input.title.trim()) {
    throw new Error('Fixed expense charge title is required.');
  }
  if (typeof input.amount !== 'string' || !/^\d+$/.test(input.amount)) {
    throw new Error('Fixed expense charge amount must be a whole CLP amount.');
  }
  const amount = Number(input.amount);
  if (!Number.isSafeInteger(amount) || amount <= 0) {
    throw new Error('Fixed expense charge amount must be a positive safe whole CLP amount.');
  }
  if (!isFixedExpenseChargeDate(input.chargeDate)) {
    throw new Error('Fixed expense charge date must be a valid YYYY-MM-DD date.');
  }
  if (input.status !== 'confirmed' && input.status !== 'skipped') {
    throw new Error('Fixed expense charge status is invalid.');
  }
  if (input.paymentMethodId !== undefined
      && (typeof input.paymentMethodId !== 'string' || !input.paymentMethodId.trim() || input.paymentMethodId.includes('/'))) {
    throw new Error('Payment method ID must be a nonempty Firestore document ID.');
  }

  return {
    fixedExpenseId: input.fixedExpenseId,
    period: input.period,
    title: input.title.trim(),
    amount: String(amount),
    chargeDate: input.chargeDate,
    status: input.status,
    ...(input.paymentMethodId === undefined ? {} : { paymentMethodId: input.paymentMethodId }),
  };
}
