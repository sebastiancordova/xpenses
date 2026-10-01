import { Timestamp } from '@angular/fire/firestore';
import { Base } from './base';
import { ExpenseCategory } from './expense';

export interface InstallmentPurchase extends Base {
  title: string;
  installmentAmount: string;
  totalInstallments: number;
  currentInstallment: number; // cuotas ya facturadas/pagadas estimadas
  startDate: Timestamp;
  paymentDay: number; // copied from the selected credit card's statement closing day
  paymentMethodId?: string;
  category: ExpenseCategory | string;
  subcategory?: string;
  status: 'active' | 'completed';
}
