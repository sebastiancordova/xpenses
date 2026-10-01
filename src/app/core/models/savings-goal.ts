import { Timestamp } from '@angular/fire/firestore';

export type SavingsAllocationType = 'percentage' | 'fixed';
export type SavingsGoalStatus = 'active' | 'paused' | 'completed' | 'archived';
export type SavingsTransactionType = 'contribution' | 'withdrawal';

export interface SavingsGoal {
  uid?: string;
  name: string;
  targetAmount: number;
  targetDate?: string;
  allocationType: SavingsAllocationType;
  allocationValue: number;
  status: SavingsGoalStatus;
  balance: number;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

export type SavingsGoalInput = Pick<
  SavingsGoal,
  'name' | 'targetAmount' | 'targetDate' | 'allocationType' | 'allocationValue' | 'status'
>;

export interface SavingsTransaction {
  uid?: string;
  goalId: string;
  type: SavingsTransactionType;
  amount: number;
  date: string;
  note?: string;
  createdAt: Timestamp;
}
