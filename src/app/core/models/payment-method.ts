import { Base } from './base';

export type PaymentMethodType = 'credit' | 'debit' | 'cash';

export interface PaymentMethod extends Base {
  name: string;
  type: PaymentMethodType;
  /** Required only for credit cards. It is the statement closing day. */
  billingCycleDay?: number;
  isActive: boolean;
  isDefault?: boolean;
}

export const PAYMENT_METHOD_TYPE_LABELS: Record<PaymentMethodType, string> = {
  credit: 'Tarjeta de crédito',
  debit: 'Débito',
  cash: 'Efectivo',
};
