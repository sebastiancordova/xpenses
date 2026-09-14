import { Timestamp } from '@angular/fire/firestore';
import { Base } from './base';
import { ExpenseCategory } from './expense';

export interface InstallmentPurchase extends Base {
  title: string;
  installmentAmount: string;
  totalInstallments: number;
  currentInstallment: number; // cuotas ya facturadas/pagadas estimadas
  startDate: Timestamp;
  paymentDay: number; // mirrored from the account-wide billingCycleDay preference
  category: ExpenseCategory;
  status: 'active' | 'completed';
}
