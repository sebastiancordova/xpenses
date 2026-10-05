import { FixedExpense } from '@core/models/expense';
import { FixedExpenseCharge } from '@core/models/fixed-expense-charge';

export interface FixedExpenseChargeSummary {
  confirmedAmount: number;
  estimatedAmount: number;
  totalAmount: number;
}

/** Returns whether a value is a real calendar date in YYYY-MM-DD form. */
export function isFixedExpenseChargeDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const [year, month, day] = value.split('-').map(Number);
  if (year < 1) return false;
  const parsed = new Date(0);
  parsed.setFullYear(year, month - 1, day);
  return parsed.getFullYear() === year
    && parsed.getMonth() === month - 1
    && parsed.getDate() === day;
}

/** Returns whether a value is a valid calendar month in YYYY-MM form. */
export function isFixedExpenseChargePeriod(value: string): boolean {
  if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(value)) return false;
  const year = Number(value.slice(0, 4));
  return Number.isInteger(year) && year >= 1 && year <= 9999;
}

/** Stable path-safe document ID, enforcing one monthly occurrence per template. */
export function getFixedExpenseChargeId(fixedExpenseId: string, period: string): string {
  validateDocumentId(fixedExpenseId, 'fixedExpenseId');
  if (!isFixedExpenseChargePeriod(period)) {
    throw new Error('Fixed expense charge period must be a valid YYYY-MM month.');
  }
  return `${fixedExpenseId}_${period}`;
}

/** Confirmed occurrences belong to their actual charge month; omissions to the selected month. */
export function getFixedExpenseChargeMonth(charge: Pick<FixedExpenseCharge, 'status' | 'chargeDate' | 'period'>): string {
  return charge.status === 'confirmed' && isFixedExpenseChargeDate(charge.chargeDate)
    ? charge.chargeDate.slice(0, 7) : charge.period;
}

/** Selects a stable write slot without replacing a legacy charge from another month. */
export function selectFixedExpenseChargeSlot(
  input: Pick<FixedExpenseCharge, 'fixedExpenseId' | 'status' | 'chargeDate' | 'period'>,
  preferred?: FixedExpenseCharge,
  fallback?: FixedExpenseCharge
): 'preferred' | 'fallback' {
  const matches = (existing: FixedExpenseCharge) => existing.fixedExpenseId === input.fixedExpenseId
    && getFixedExpenseChargeMonth(existing) === getFixedExpenseChargeMonth(input);
  if (fallback && matches(fallback)) return 'fallback';
  if (!preferred || matches(preferred)) return 'preferred';
  if (!fallback) return 'fallback';
  throw new Error('Monthly charge identity conflict. Existing records were preserved.');
}

/**
 * Totals confirmed charges by their recorded date and estimates active templates
 * that have no occurrence for the billing cycle's ending calendar month yet.
 * A matching confirmed occurrence anywhere in the billing cycle also replaces
 * that cycle's estimate, even when its actual charge month is the start month.
 */
export function summarizeFixedCharges(
  templates: FixedExpense[],
  charges: FixedExpenseCharge[],
  period: string,
  start: Date,
  end: Date,
  paymentMethodId?: string,
  legacyPaymentMethodId?: string
): FixedExpenseChargeSummary {
  // A single monthly occurrence is resolved globally for this template/month.
  // Its payment-method snapshot may differ from the template (for example, the
  // user moved this month's bill to another card), so never recreate an estimate
  // on the template's old card. The confirmed amount itself remains method-filtered.
  const periodChargeIds = new Set(charges
    .filter(charge => getFixedExpenseChargeMonth(charge) === period)
    .map(charge => charge.fixedExpenseId));

  const confirmedCharges = confirmedFixedChargesInRange(
    charges,
    start,
    end,
    paymentMethodId,
    legacyPaymentMethodId
  );
  const cycleChargeIds = new Set(confirmedCharges.map(charge => charge.fixedExpenseId));

  const confirmedAmount = confirmedCharges.reduce((total, charge) => total + parseClpAmount(charge.amount), 0);

  const estimatedAmount = templates.reduce((total, template) => {
    if (!template.uid || periodChargeIds.has(template.uid) || cycleChargeIds.has(template.uid)) return total;
    if (!matchesPaymentMethod(template.paymentMethodId, paymentMethodId, legacyPaymentMethodId)) return total;
    return total + parseClpAmount(template.amount);
  }, 0);

  return { confirmedAmount, estimatedAmount, totalAmount: confirmedAmount + estimatedAmount };
}

/** Returns confirmed monthly charges whose recorded date falls in an inclusive local-date range. */
export function confirmedFixedChargesInRange(
  charges: FixedExpenseCharge[],
  start: Date,
  end: Date,
  paymentMethodId?: string,
  legacyPaymentMethodId?: string
): FixedExpenseCharge[] {
  const startDate = toLocalDateKey(start);
  const endDate = toLocalDateKey(end);
  if (!startDate || !endDate || startDate > endDate) return [];

  return charges.filter(charge => charge.status === 'confirmed'
    && isFixedExpenseChargeDate(charge.chargeDate)
    && charge.chargeDate >= startDate
    && charge.chargeDate <= endDate
    && matchesPaymentMethod(charge.paymentMethodId, paymentMethodId, legacyPaymentMethodId));
}

function matchesPaymentMethod(
  itemPaymentMethodId: string | undefined,
  selectedPaymentMethodId: string | undefined,
  legacyPaymentMethodId: string | undefined
): boolean {
  return !selectedPaymentMethodId
    || (itemPaymentMethodId ?? legacyPaymentMethodId) === selectedPaymentMethodId;
}

function parseClpAmount(amount: string): number {
  if (typeof amount !== 'string' || !/^\d+$/.test(amount)) return 0;
  const value = Number(amount);
  return Number.isSafeInteger(value) && value > 0 ? value : 0;
}

function toLocalDateKey(date: Date): string | null {
  if (!(date instanceof Date) || !Number.isFinite(date.getTime())) return null;
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${String(year).padStart(4, '0')}-${month}-${day}`;
}

function validateDocumentId(value: string, fieldName: string): void {
  if (typeof value !== 'string' || !value.trim() || value.includes('/')) {
    throw new Error(`${fieldName} must be a nonempty Firestore document ID.`);
  }
}
