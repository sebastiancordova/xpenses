import { Timestamp } from '@angular/fire/firestore';
import { SavingsGoal, SavingsGoalInput } from '../models/savings-goal';
import {
  getActivePercentageTotal,
  getGoalProjection,
  getSavingsOverview,
  getSuggestedContribution,
  isSavingsDate,
  isSameSavingsTransactionRequest,
  applySavingsTransaction,
  updateActivePercentageTotal,
} from './savings-goals.utils';

describe('savings-goals.utils', () => {
  const createdAt = Timestamp.fromDate(new Date('2026-01-01T00:00:00Z'));
  const goal = (values: Partial<SavingsGoal> = {}): SavingsGoal => ({
    uid: 'goal-1',
    name: 'Emergency fund',
    targetAmount: 1_000_000,
    allocationType: 'percentage',
    allocationValue: 10,
    status: 'active',
    balance: 100_000,
    createdAt,
    updatedAt: createdAt,
    ...values,
  });

  it('rounds percentage suggestions to whole CLP and ignores inactive goals', () => {
    expect(getSuggestedContribution(goal(), 99_999)).toBe(10_000);
    expect(getSuggestedContribution(goal({ status: 'paused' }), 100_000)).toBe(0);
    expect(getSuggestedContribution(goal({ allocationType: 'fixed', allocationValue: 25_000 }), 0)).toBe(25_000);
    expect(getSuggestedContribution(goal({ allocationType: 'fixed', allocationValue: 25_000 }), 100_000)).toBe(25_000);
  });

  it('counts active percentage allocations and supports replacement without double counting', () => {
    const goals = [
      goal({ uid: 'goal-1', allocationValue: 40 }),
      goal({ uid: 'goal-2', allocationValue: 35 }),
      goal({ uid: 'goal-3', status: 'paused', allocationValue: 90 }),
    ];
    const input: SavingsGoalInput = {
      name: 'Travel',
      targetAmount: 500_000,
      allocationType: 'percentage',
      allocationValue: 25,
      status: 'active',
    };

    expect(getActivePercentageTotal(goals, input)).toBe(100);
    expect(getActivePercentageTotal(goals, { ...input, allocationValue: 26 })).toBe(101);
    expect(getActivePercentageTotal(goals, { ...input, allocationValue: 60 }, 'goal-1')).toBe(95);
    expect(getActivePercentageTotal(goals, { ...input, status: 'paused' })).toBe(75);
    expect(updateActivePercentageTotal(75, goals[0], input)).toBe(60);
    expect(updateActivePercentageTotal(75, undefined, input)).toBe(100);
  });

  it('summarizes all balances while planning only active goals', () => {
    const overview = getSavingsOverview([
      goal({ allocationValue: 20, balance: 50_000 }),
      goal({ uid: 'goal-2', allocationType: 'fixed', allocationValue: 15_000, balance: 30_000 }),
      goal({ uid: 'goal-3', status: 'archived', balance: 10_000 }),
    ], 100_000);

    expect(overview).toEqual({
      balance: 90_000,
      suggestedMonthly: 35_000,
      allocatedPercentage: 20,
      unassignedIncome: 65_000,
      activeCount: 2,
    });
  });

  it('projects a whole-CLP monthly plan from the current balance', () => {
    const projection = getGoalProjection(
      goal({ targetAmount: 250_000, balance: 100_000, allocationValue: 10 }),
      100_000,
      new Date(2026, 0, 31)
    );

    expect(projection).toEqual({
      monthlyContribution: 10_000,
      monthsRemaining: 15,
      estimatedDate: '2027-04-30',
    });
    expect(getGoalProjection(goal({ status: 'paused' }), 100_000, new Date(2026, 0, 1)))
      .toEqual({ monthlyContribution: 0, monthsRemaining: null, estimatedDate: null });
  });

  it('accepts only real YYYY-MM-DD dates', () => {
    expect(isSavingsDate('2028-02-29')).toBeTrue();
    expect(isSavingsDate('2027-02-29')).toBeFalse();
    expect(isSavingsDate('2026-2-01')).toBeFalse();
  });

  it('does not render invalid dates for plans beyond the supported calendar', () => {
    const projection = getGoalProjection(goal({ targetAmount: Number.MAX_SAFE_INTEGER, balance: 0,
      allocationType: 'fixed', allocationValue: 1 }), 0, new Date(2026, 0, 1));
    expect(projection.estimatedDate).toBeNull();
    expect(projection.monthsRemaining).toBeNull();
  });

  it('keeps percentage totals precise to hundredths', () => {
    const first = goal({ uid: 'goal-1', allocationValue: 33.33 });
    const second = goal({ uid: 'goal-2', allocationValue: 66.67 });
    const replacement: SavingsGoalInput = {
      name: 'Third',
      targetAmount: 100_000,
      allocationType: 'percentage',
      allocationValue: 0.01,
      status: 'active',
    };

    expect(getActivePercentageTotal([first, second], { ...replacement, allocationValue: 0 }, 'goal-1'))
      .toBe(66.67);
    expect(updateActivePercentageTotal(99.99, undefined, replacement)).toBe(100);
  });

  it('recognizes retries only when transaction payloads match and prevents overdraw', () => {
    const request = {
      goalId: 'goal-1',
      type: 'contribution' as const,
      amount: 20_000,
      date: '2026-09-30',
      note: 'Payday',
    };
    const existing = { ...request, uid: 'request-1', createdAt };

    expect(isSameSavingsTransactionRequest(existing, request)).toBeTrue();
    expect(isSameSavingsTransactionRequest(existing, { ...request, amount: 25_000 })).toBeFalse();
    expect(applySavingsTransaction(10_000, 'contribution', 2_000)).toBe(12_000);
    expect(() => applySavingsTransaction(10_000, 'withdrawal', 10_001)).toThrowError();
  });
});
