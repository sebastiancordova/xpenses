import { Base } from './base';

/** One monthly occurrence of a recurring fixed-expense template. */
export interface FixedExpenseCharge extends Base {
  fixedExpenseId: string;
  /** Calendar month of the recurring bill, in YYYY-MM format. */
  period: string;
  /** Template title captured when the monthly occurrence was recorded. */
  title: string;
  /** Positive whole CLP amount, serialized as a string for compatibility. */
  amount: string;
  /** Actual charge date in YYYY-MM-DD form, without timezone conversion. */
  chargeDate: string;
  /** Payment-method document ID captured for this occurrence. */
  paymentMethodId?: string;
  status: 'confirmed' | 'skipped';
}

export type FixedExpenseChargeInput = Omit<FixedExpenseCharge, 'createdAt' | 'updatedAt' | 'uid'>;
