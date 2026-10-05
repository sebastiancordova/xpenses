import { Timestamp } from '@angular/fire/firestore';
import { FixedExpense } from '@core/models/expense';
import { FixedExpenseCharge } from '@core/models/fixed-expense-charge';
import {
  confirmedFixedChargesInRange,
  getFixedExpenseChargeId,
  isFixedExpenseChargeDate,
  isFixedExpenseChargePeriod,
  summarizeFixedCharges,
} from './fixed-expense-charges.utils';

describe('fixed-expense-charges.utils', () => {
  const timestamp = Timestamp.fromDate(new Date('2026-01-01T00:00:00Z'));
  const template = (values: Partial<FixedExpense> = {}): FixedExpense => ({
    uid: 'electricity', title: 'Electricity', amount: '100000',
    createdAt: timestamp, updatedAt: timestamp, ...values,
  });
  const charge = (values: Partial<FixedExpenseCharge> = {}): FixedExpenseCharge => ({
    uid: 'electricity_2026-09', fixedExpenseId: 'electricity', period: '2026-09',
    title: 'Electricity', amount: '110000', chargeDate: '2026-09-08',
    status: 'confirmed', createdAt: timestamp, updatedAt: timestamp, ...values,
  });
  const date = (year: number, month: number, day: number) => new Date(year, month - 1, day);

  it('validates calendar periods and local date-only values', () => {
    expect(isFixedExpenseChargePeriod('2026-09')).toBeTrue();
    expect(isFixedExpenseChargePeriod('2026-13')).toBeFalse();
    expect(isFixedExpenseChargePeriod('0000-01')).toBeFalse();
    expect(isFixedExpenseChargeDate('2028-02-29')).toBeTrue();
    expect(isFixedExpenseChargeDate('2027-02-29')).toBeFalse();
    expect(isFixedExpenseChargeDate('2026-9-08')).toBeFalse();
  });

  it('uses one stable path-safe document ID for the same template and month', () => {
    expect(getFixedExpenseChargeId('electricity', '2026-09')).toBe('electricity_2026-09');
    expect(getFixedExpenseChargeId('electricity', '2026-09'))
      .toBe(getFixedExpenseChargeId('electricity', '2026-09'));
    expect(() => getFixedExpenseChargeId('bad/id', '2026-09')).toThrowError();
    expect(() => getFixedExpenseChargeId('electricity', '2026-9')).toThrowError();
  });

  it('keeps each confirmed amount by its charge date and estimates only unrecorded templates', () => {
    const result = summarizeFixedCharges(
      [template({ amount: '100000' }), template({ uid: 'water', title: 'Water', amount: '30000' })],
      [charge({ amount: '110000' })],
      '2026-09', date(2026, 9, 1), date(2026, 9, 30)
    );

    expect(result).toEqual({ confirmedAmount: 110000, estimatedAmount: 30000, totalAmount: 140000 });
  });

  it('lets a skipped occurrence replace the estimate without adding to spending', () => {
    const result = summarizeFixedCharges(
      [template()],
      [charge({ status: 'skipped' })],
      '2026-09', date(2026, 9, 1), date(2026, 9, 30)
    );

    expect(result).toEqual({ confirmedAmount: 0, estimatedAmount: 0, totalAmount: 0 });
  });

  it('suppresses only the real charge month and restores the other account month estimate', () => {
    const charges = [charge({ period: '2026-10', chargeDate: '2026-09-05' })];
    expect(summarizeFixedCharges([template()], charges, '2026-10', date(2026, 10, 1), date(2026, 10, 31)))
      .toEqual({ confirmedAmount: 0, estimatedAmount: 100000, totalAmount: 100000 });
    expect(summarizeFixedCharges([template()], charges, '2026-09', date(2026, 9, 1), date(2026, 9, 30)))
      .toEqual({ confirmedAmount: 110000, estimatedAmount: 0, totalAmount: 110000 });
    expect(confirmedFixedChargesInRange(charges, date(2026, 8, 20), date(2026, 9, 19)).length).toBe(1);
    expect(confirmedFixedChargesInRange(charges, date(2026, 9, 20), date(2026, 10, 19))).toEqual([]);
  });

  it('does not estimate again for its actual month when the date is outside the selected billing cycle', () => {
    const result = summarizeFixedCharges(
      [template()],
      [charge({ chargeDate: '2026-09-01' })],
      '2026-09', date(2026, 9, 20), date(2026, 10, 19)
    );

    expect(result).toEqual({ confirmedAmount: 0, estimatedAmount: 0, totalAmount: 0 });
  });

  it('uses the cycle end month for estimates and includes a September charge in an Aug 20–Sep 19 cycle', () => {
    const templates = [
      template({ amount: '800000' }),
      template({ uid: 'water', title: 'Water', amount: '50000' }),
    ];
    const result = summarizeFixedCharges(
      templates,
      [
        charge({ amount: '752480', chargeDate: '2026-09-05' }),
        charge({ uid: 'water_2026-09', fixedExpenseId: 'water', status: 'skipped', period: '2026-09', chargeDate: '2026-09-01' }),
      ],
      '2026-09', date(2026, 8, 20), date(2026, 9, 19)
    );

    expect(result).toEqual({ confirmedAmount: 752480, estimatedAmount: 0, totalAmount: 752480 });
  });

  it('lets a confirmed start-month occurrence satisfy the template estimate for the whole billing cycle', () => {
    const result = summarizeFixedCharges(
      [template({ amount: '100000' })],
      [charge({ amount: '95000', period: '2026-08', chargeDate: '2026-08-25' })],
      '2026-09', date(2026, 8, 20), date(2026, 9, 19)
    );

    expect(result).toEqual({ confirmedAmount: 95000, estimatedAmount: 0, totalAmount: 95000 });
  });

  it('does not recreate the end-month estimate when its actual charge falls outside the cycle', () => {
    const result = summarizeFixedCharges(
      [template({ amount: '100000' })],
      [charge({ amount: '110000', period: '2026-09', chargeDate: '2026-09-25' })],
      '2026-09', date(2026, 8, 20), date(2026, 9, 19)
    );

    expect(result).toEqual({ confirmedAmount: 0, estimatedAmount: 0, totalAmount: 0 });
  });

  it('estimates only unmatched templates and respects method matching for in-cycle suppression', () => {
    const templates = [
      template({ amount: '100000', paymentMethodId: 'card-a' }),
      template({ uid: 'water', title: 'Water', amount: '30000', paymentMethodId: 'card-a' }),
    ];
    const result = summarizeFixedCharges(
      templates,
      [charge({ amount: '90000', period: '2026-08', chargeDate: '2026-08-25', paymentMethodId: 'card-b' })],
      '2026-09', date(2026, 8, 20), date(2026, 9, 19), 'card-a', 'card-a'
    );

    expect(result).toEqual({ confirmedAmount: 0, estimatedAmount: 130000, totalAmount: 130000 });
  });

  it('does not estimate a resolved end-month occurrence on its template card after it was moved to another card', () => {
    const cardATemplate = template({ amount: '100000', paymentMethodId: 'card-a' });
    const cardBCharge = charge({ amount: '110000', chargeDate: '2026-09-05', paymentMethodId: 'card-b' });

    expect(summarizeFixedCharges(
      [cardATemplate], [cardBCharge], '2026-09', date(2026, 8, 20), date(2026, 9, 19), 'card-a', 'card-a'
    )).toEqual({ confirmedAmount: 0, estimatedAmount: 0, totalAmount: 0 });
    expect(summarizeFixedCharges(
      [cardATemplate], [cardBCharge], '2026-09', date(2026, 8, 20), date(2026, 9, 19), 'card-b', 'card-b'
    )).toEqual({ confirmedAmount: 110000, estimatedAmount: 0, totalAmount: 110000 });
  });

  it('suppresses the template-card estimate when the end-month occurrence is skipped on another card', () => {
    const result = summarizeFixedCharges(
      [template({ amount: '100000', paymentMethodId: 'card-a' })],
      [charge({ status: 'skipped', period: '2026-09', paymentMethodId: 'card-b' })],
      '2026-09', date(2026, 8, 20), date(2026, 9, 19), 'card-a', 'card-a'
    );

    expect(result).toEqual({ confirmedAmount: 0, estimatedAmount: 0, totalAmount: 0 });
  });

  it('derives the estimate month from the ending year when a cycle crosses New Year', () => {
    const result = summarizeFixedCharges(
      [template({ amount: '100000' })],
      [],
      '2027-01', date(2026, 12, 20), date(2027, 1, 19)
    );

    expect(result.estimatedAmount).toBe(100000);
  });

  it('filters charge and estimate totals by the selected method with legacy fallback', () => {
    const result = summarizeFixedCharges(
      [
        template({ paymentMethodId: 'card-a' }),
        template({ uid: 'water', amount: '30000' }),
        template({ uid: 'internet', amount: '20000', paymentMethodId: 'card-b' }),
      ],
      [
        charge({ amount: '110000', paymentMethodId: 'card-a' }),
        charge({ uid: 'water_2026-09', fixedExpenseId: 'water', title: 'Water', amount: '25000', paymentMethodId: undefined }),
        charge({ uid: 'internet_2026-09', fixedExpenseId: 'internet', paymentMethodId: 'card-b' }),
      ],
      '2026-09', date(2026, 9, 1), date(2026, 9, 30), 'card-a', 'card-a'
    );

    expect(result).toEqual({ confirmedAmount: 135000, estimatedAmount: 0, totalAmount: 135000 });
  });

  it('counts confirmed orphan occurrences and excludes skipped or out-of-range charges', () => {
    const charges = [
      charge({ fixedExpenseId: 'deleted-template', uid: 'orphan_2026-09', amount: '7000' }),
      charge({ uid: 'skipped', status: 'skipped', amount: '9000' }),
      charge({ uid: 'outside', chargeDate: '2026-10-01', amount: '5000' }),
    ];
    const matching = confirmedFixedChargesInRange(charges, date(2026, 9, 1), date(2026, 9, 30));

    expect(matching.map(item => item.amount)).toEqual(['7000']);
    expect(summarizeFixedCharges([], charges, '2026-09', date(2026, 9, 1), date(2026, 9, 30)).confirmedAmount)
      .toBe(7000);
  });

  it('uses inclusive local calendar boundaries and ignores malformed CLP strings', () => {
    const result = summarizeFixedCharges(
      [],
      [
        charge({ chargeDate: '2026-09-20', amount: '10000' }),
        charge({ uid: 'last-day', chargeDate: '2026-10-19', amount: '20000' }),
        charge({ uid: 'fraction', chargeDate: '2026-10-01', amount: '12.5' }),
      ],
      '2026-09', date(2026, 9, 20), date(2026, 10, 19)
    );

    expect(result).toEqual({ confirmedAmount: 30000, estimatedAmount: 0, totalAmount: 30000 });
  });
});
