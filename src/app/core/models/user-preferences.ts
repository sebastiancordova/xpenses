export interface UserPreferences {
  billingCycleDay: number; // 1–28, day of month billing cycle starts
  savingsRate: number;     // 0–100 (%), target savings from income
  variableRate: number;    // 0–100 (%), budget allocated to variable expenses
}

export const DEFAULT_PREFERENCES: UserPreferences = {
  billingCycleDay: 19,
  savingsRate: 20,
  variableRate: 50,
};
