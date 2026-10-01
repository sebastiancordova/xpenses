import { Injectable, inject } from '@angular/core';
import { Auth, authState } from '@angular/fire/auth';
import {
  CollectionReference,
  Firestore,
  Timestamp,
  collection,
  collectionData,
  doc,
  getDoc,
  getDocs,
  orderBy,
  query,
  runTransaction,
} from '@angular/fire/firestore';
import { Observable, of, switchMap } from 'rxjs';
import {
  SavingsGoal,
  SavingsGoalInput,
  SavingsGoalStatus,
  SavingsTransaction,
  SavingsTransactionType,
} from '@core/models/savings-goal';
import {
  applySavingsTransaction,
  isSameSavingsTransactionRequest,
  isSavingsDate,
  updateActivePercentageTotal,
} from '@core/utils/savings-goals.utils';

const GOALS_PATH = 'savings-goals';
const TRANSACTIONS_PATH = 'savings-transactions';
const PLANNING_STATE_PATH = 'savings-planning/state';
const VALID_STATUSES: SavingsGoalStatus[] = ['active', 'paused', 'completed', 'archived'];
const VALID_TRANSACTION_TYPES: SavingsTransactionType[] = ['contribution', 'withdrawal'];

@Injectable({ providedIn: 'root' })
export class SavingsGoalsService {
  private readonly firestore = inject(Firestore);
  private readonly auth = inject(Auth);

  getGoals(): Observable<SavingsGoal[]> {
    return authState(this.auth).pipe(
      switchMap(user => {
        if (!user?.uid) return of<SavingsGoal[]>([]);
        const goalsRef = collection(
          this.firestore,
          `users/${user.uid}/${GOALS_PATH}`
        ) as CollectionReference<SavingsGoal>;
        return collectionData(
          query(goalsRef, orderBy('createdAt', 'desc')),
          { idField: 'uid' }
        ) as Observable<SavingsGoal[]>;
      })
    );
  }

  getTransactions(): Observable<SavingsTransaction[]> {
    return authState(this.auth).pipe(
      switchMap(user => {
        if (!user?.uid) return of<SavingsTransaction[]>([]);
        const transactionsRef = collection(
          this.firestore,
          `users/${user.uid}/${TRANSACTIONS_PATH}`
        ) as CollectionReference<SavingsTransaction>;
        return collectionData(
          query(transactionsRef, orderBy('createdAt', 'desc')),
          { idField: 'uid' }
        ) as Observable<SavingsTransaction[]>;
      })
    );
  }

  async saveGoal(input: SavingsGoalInput, goalId?: string): Promise<void> {
    validateGoalInput(input);
    const uid = this.requireCurrentUid();
    const goalsRef = collection(this.firestore, `users/${uid}/${GOALS_PATH}`);
    const planningRef = doc(this.firestore, `users/${uid}/${PLANNING_STATE_PATH}`);
    const goalRef = goalId ? doc(goalsRef, validateDocumentId(goalId, 'goalId')) : doc(goalsRef);
    // AngularFire's transaction API does not expose transactional collection queries.
    // This snapshot initializes the aggregate only; the planning document serializes
    // every save, and a retry uses its latest value after a concurrent first save.
    const initialPlanningState = await getDoc(planningRef);
    let initialPercentageTotal = Number(initialPlanningState.data()?.['activePercentageTotal'] ?? 0);
    if (!initialPlanningState.exists()) {
      const initialGoals = await getDocs(goalsRef);
      initialPercentageTotal = initialGoals.docs.reduce((total, snapshot) => {
        const goal = snapshot.data() as SavingsGoal;
        return total + (goal.status === 'active' && goal.allocationType === 'percentage'
          ? Math.round(goal.allocationValue * 100)
          : 0);
      }, 0) / 100;
    }

    await runTransaction(this.firestore, async transaction => {
      const planningState = await transaction.get(planningRef);
      const existingGoal = goalId ? await transaction.get(goalRef) : null;

      if (goalId && !existingGoal?.exists()) {
        throw new Error('Savings goal not found for the signed-in user.');
      }

      const currentGoal = existingGoal?.exists() ? existingGoal.data() as SavingsGoal : undefined;
      const currentTotal = planningState.exists()
        ? Number(planningState.data()?.['activePercentageTotal'] ?? 0)
        : initialPercentageTotal;
      const activePercentageTotal = updateActivePercentageTotal(currentTotal, currentGoal, input);

      if (activePercentageTotal > 100) {
        throw new Error('Active percentage savings allocations cannot exceed 100%.');
      }

      const now = Timestamp.now();
      const existing = currentGoal;
      const { targetDate, ...goalFields } = input;
      const goal: SavingsGoal = {
        ...goalFields,
        name: input.name.trim(),
        balance: existing?.balance ?? 0,
        createdAt: existing?.createdAt ?? now,
        updatedAt: now,
        ...(targetDate === undefined ? {} : { targetDate }),
      };

      transaction.set(goalRef, goal);
      transaction.set(planningRef, {
        activePercentageTotal,
        updatedAt: now,
        ...(planningState.exists() ? {} : { createdAt: now }),
      }, { merge: true });
    });
  }

  async addTransaction(
    goalId: string,
    input: { type: SavingsTransactionType; amount: number; date: string; note?: string },
    requestId: string
  ): Promise<void> {
    validateDocumentId(goalId, 'goalId');
    validateTransactionInput(input);
    validateDocumentId(requestId, 'requestId');
    const uid = this.requireCurrentUid();
    const goalRef = doc(this.firestore, `users/${uid}/${GOALS_PATH}/${goalId}`);
    const transactionRef = doc(this.firestore, `users/${uid}/${TRANSACTIONS_PATH}/${requestId}`);

    await runTransaction(this.firestore, async transaction => {
      const existingTransaction = await transaction.get(transactionRef);
      const normalizedNote = input.note?.trim() || undefined;
      if (existingTransaction.exists()) {
        const isRetry = isSameSavingsTransactionRequest(
          existingTransaction.data() as SavingsTransaction,
          { ...input, goalId, ...(normalizedNote ? { note: normalizedNote } : {}) }
        );
        if (isRetry) return;
        throw new Error('Request ID was already used for a different savings transaction.');
      }

      const goalSnapshot = await transaction.get(goalRef);
      if (!goalSnapshot.exists()) {
        throw new Error('Savings goal not found for the signed-in user.');
      }
      const goal = goalSnapshot.data() as SavingsGoal;
      if (input.type === 'contribution' && goal.status !== 'active') {
        throw new Error('Contributions can only be added to active savings goals.');
      }

      const nextBalance = applySavingsTransaction(goal.balance, input.type, input.amount);

      const now = Timestamp.now();
      const entry: SavingsTransaction = {
        goalId,
        type: input.type,
        amount: input.amount,
        date: input.date,
        createdAt: now,
        ...(normalizedNote ? { note: normalizedNote } : {}),
      };
      transaction.set(transactionRef, entry);
      transaction.update(goalRef, { balance: nextBalance, updatedAt: now });
    });
  }

  private requireCurrentUid(): string {
    const uid = this.auth.currentUser?.uid;
    if (!uid?.trim()) throw new Error('A signed-in user is required to access savings data.');
    return uid;
  }
}

function validateGoalInput(input: SavingsGoalInput): void {
  if (!input || typeof input.name !== 'string' || !input.name.trim()) {
    throw new Error('Savings goal name is required.');
  }
  if (!Number.isSafeInteger(input.targetAmount) || input.targetAmount <= 0) {
    throw new Error('Savings target must be a positive whole CLP amount.');
  }
  if (input.targetDate !== undefined && !isSavingsDate(input.targetDate)) {
    throw new Error('Savings target date must be a valid YYYY-MM-DD date.');
  }
  if (input.allocationType !== 'percentage' && input.allocationType !== 'fixed') {
    throw new Error('Savings allocation type is invalid.');
  }
  if (input.allocationType === 'percentage') {
    if (!Number.isFinite(input.allocationValue) || input.allocationValue <= 0 || input.allocationValue > 100) {
      throw new Error('Savings percentage must be greater than 0 and at most 100.');
    }
    if (Math.abs(input.allocationValue * 100 - Math.round(input.allocationValue * 100)) > 1e-8) {
      throw new Error('Savings percentage can have at most two decimal places.');
    }
  } else if (!Number.isSafeInteger(input.allocationValue) || input.allocationValue <= 0) {
    throw new Error('Fixed savings allocation must be a positive whole CLP amount.');
  }
  if (!VALID_STATUSES.includes(input.status)) throw new Error('Savings goal status is invalid.');
}

function validateTransactionInput(
  input: { type: SavingsTransactionType; amount: number; date: string; note?: string }
): void {
  if (!input || !VALID_TRANSACTION_TYPES.includes(input.type)) {
    throw new Error('Savings transaction type is invalid.');
  }
  if (!Number.isSafeInteger(input.amount) || input.amount <= 0) {
    throw new Error('Savings transaction amount must be a positive whole CLP amount.');
  }
  if (!isSavingsDate(input.date)) {
    throw new Error('Savings transaction date must be a valid YYYY-MM-DD date.');
  }
  const [year, month, day] = input.date.split('-').map(Number);
  const transactionDate = new Date(year, month - 1, day);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  if (transactionDate > today) {
    throw new Error('Savings transactions cannot be dated in the future.');
  }
  if (input.note !== undefined && typeof input.note !== 'string') {
    throw new Error('Savings transaction note must be text.');
  }
}

function validateDocumentId(value: string, fieldName: string): string {
  if (typeof value !== 'string' || !value.trim() || value.includes('/')) {
    throw new Error(`${fieldName} must be a nonempty Firestore document ID.`);
  }
  return value;
}
