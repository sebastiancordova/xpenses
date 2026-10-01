import {
  SavingsGoal,
  SavingsGoalInput,
  SavingsTransaction,
  SavingsTransactionType,
} from '../models/savings-goal';

export interface SavingsOverview {
  balance: number;
  suggestedMonthly: number;
  allocatedPercentage: number;
  unassignedIncome: number;
  activeCount: number;
}

export interface GoalProjection {
  monthlyContribution: number;
  monthsRemaining: number | null;
  estimatedDate: string | null;
}

/** Returns whether a value is a real calendar date in YYYY-MM-DD form. */
export function isSavingsDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const [year, month, day] = value.split('-').map(Number);
  const parsed = new Date(Date.UTC(year, month - 1, day));
  return parsed.getUTCFullYear() === year
    && parsed.getUTCMonth() === month - 1
    && parsed.getUTCDate() === day;
}

/** Computes the active percentage total after inserting or replacing one goal. */
export function getActivePercentageTotal(
  goals: SavingsGoal[],
  input: SavingsGoalInput,
  goalId?: string
): number {
  const existingTotal = goals.reduce((total, goal) => {
    if (goal.uid === goalId || goal.status !== 'active' || goal.allocationType !== 'percentage') {
      return total;
    }
    return total + toPercentageBasisPoints(goal.allocationValue);
  }, 0);

  return fromPercentageBasisPoints(existingTotal + (
    input.status === 'active' && input.allocationType === 'percentage'
      ? toPercentageBasisPoints(input.allocationValue)
      : 0
  ));
}

/** Applies a goal replacement to the serialized active percentage total. */
export function updateActivePercentageTotal(
  currentTotal: number,
  previousGoal: Pick<SavingsGoal, 'status' | 'allocationType' | 'allocationValue'> | undefined,
  input: SavingsGoalInput
): number {
  const previousAllocation = previousGoal?.status === 'active'
    && previousGoal.allocationType === 'percentage'
    ? toPercentageBasisPoints(previousGoal.allocationValue)
    : 0;
  const nextAllocation = input.status === 'active' && input.allocationType === 'percentage'
    ? toPercentageBasisPoints(input.allocationValue)
    : 0;
  return fromPercentageBasisPoints(
    toPercentageBasisPoints(currentTotal) - previousAllocation + nextAllocation
  );
}

export function applySavingsTransaction(
  balance: number,
  type: SavingsTransactionType,
  amount: number
): number {
  const nextBalance = balance + (type === 'contribution' ? amount : -amount);
  if (type === 'withdrawal' && nextBalance < 0) {
    throw new Error('Withdrawal exceeds the savings goal balance.');
  }
  if (!Number.isSafeInteger(nextBalance)) {
    throw new Error('Savings balance exceeds the supported CLP range.');
  }
  return nextBalance;
}

export function isSameSavingsTransactionRequest(
  existing: SavingsTransaction,
  request: Pick<SavingsTransaction, 'goalId' | 'type' | 'amount' | 'date' | 'note'>
): boolean {
  return existing.goalId === request.goalId
    && existing.type === request.type
    && existing.amount === request.amount
    && existing.date === request.date
    && (existing.note?.trim() || '') === (request.note?.trim() || '');
}

/** Calculates the monthly amount for an active goal, in whole CLP. */
export function getSuggestedContribution(goal: SavingsGoal, monthlyIncome: number): number {
  if (goal.status !== 'active') return 0;
  if (goal.allocationType === 'percentage') {
    if (!Number.isFinite(monthlyIncome) || monthlyIncome <= 0) return 0;
    return Math.round(monthlyIncome * goal.allocationValue / 100);
  }
  return Number.isSafeInteger(goal.allocationValue) && goal.allocationValue > 0
    ? goal.allocationValue
    : 0;
}

export function getSavingsOverview(goals: SavingsGoal[], monthlyIncome: number): SavingsOverview {
  const income = Number.isFinite(monthlyIncome) ? Math.round(monthlyIncome) : 0;
  const activeGoals = goals.filter(goal => goal.status === 'active');
  const suggestedMonthly = activeGoals.reduce(
    (total, goal) => total + getSuggestedContribution(goal, income),
    0
  );

  return {
    balance: goals.reduce((total, goal) => total + (Number.isFinite(goal.balance) ? goal.balance : 0), 0),
    suggestedMonthly,
    allocatedPercentage: fromPercentageBasisPoints(activeGoals.reduce(
      (total, goal) => total + (goal.allocationType === 'percentage'
        ? toPercentageBasisPoints(goal.allocationValue)
        : 0),
      0
    )),
    unassignedIncome: income - suggestedMonthly,
    activeCount: activeGoals.length,
  };
}

export function getGoalProjection(
  goal: SavingsGoal,
  monthlyIncome: number,
  asOf: Date
): GoalProjection {
  const monthlyContribution = getSuggestedContribution(goal, monthlyIncome);
  const remaining = Math.max(0, goal.targetAmount - goal.balance);

  if (remaining === 0) {
    return { monthlyContribution, monthsRemaining: 0, estimatedDate: toDateOnly(asOf) };
  }
  if (monthlyContribution <= 0 || !Number.isFinite(remaining)) {
    return { monthlyContribution, monthsRemaining: null, estimatedDate: null };
  }

  const monthsRemaining = Math.ceil(remaining / monthlyContribution);
  const estimatedDate = addCalendarMonths(asOf, monthsRemaining);
  if (!Number.isFinite(estimatedDate.getTime())) {
    return { monthlyContribution, monthsRemaining: null, estimatedDate: null };
  }
  return {
    monthlyContribution,
    monthsRemaining,
    estimatedDate: toDateOnly(estimatedDate),
  };
}

function addCalendarMonths(date: Date, months: number): Date {
  const result = new Date(date.getFullYear(), date.getMonth(), 1);
  result.setMonth(result.getMonth() + months);
  const lastDayOfTargetMonth = new Date(result.getFullYear(), result.getMonth() + 1, 0).getDate();
  result.setDate(Math.min(date.getDate(), lastDayOfTargetMonth));
  return result;
}

function toDateOnly(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function toPercentageBasisPoints(value: number): number {
  return Math.round(value * 100);
}

function fromPercentageBasisPoints(value: number): number {
  return value / 100;
}
