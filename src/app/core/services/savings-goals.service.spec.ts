import { TestBed } from '@angular/core/testing';
import { Auth } from '@angular/fire/auth';
import { Firestore } from '@angular/fire/firestore';
import { SavingsGoalsService } from './savings-goals.service';
import { SavingsGoalInput } from '@core/models/savings-goal';

describe('Savings service boundary validation (no remote Firebase)', () => {
  let service: SavingsGoalsService;
  const valid: SavingsGoalInput = {
    name: 'Synthetic goal', targetAmount: 100000, allocationType: 'percentage',
    allocationValue: 10, status: 'active'
  };

  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [
      { provide: Auth, useValue: { currentUser: null } },
      { provide: Firestore, useValue: {} }
    ] });
    service = TestBed.inject(SavingsGoalsService);
  });

  it('rejects missing authentication before constructing a database path', async () => {
    await expectAsync(service.saveGoal(valid)).toBeRejectedWithError(/signed-in user/);
  });
  it('rejects unsafe, fractional, negative and zero target amounts', async () => {
    for (const targetAmount of [Infinity, NaN, 0, -1, 10.5, Number.MAX_SAFE_INTEGER + 1]) {
      await expectAsync(service.saveGoal({ ...valid, targetAmount })).toBeRejectedWithError(/whole CLP/);
    }
  });
  it('rejects invalid percentages and dates at the service boundary', async () => {
    await expectAsync(service.saveGoal({ ...valid, allocationValue: 100.01 })).toBeRejected();
    await expectAsync(service.saveGoal({ ...valid, allocationValue: 12.345 })).toBeRejected();
    await expectAsync(service.saveGoal({ ...valid, targetDate: '2026-02-30' })).toBeRejected();
  });
  it('rejects invalid ledger amounts and future actual dates', async () => {
    await expectAsync(service.addTransaction('goal', { type: 'contribution', amount: -100, date: '2026-01-01' }, 'request')).toBeRejected();
    await expectAsync(service.addTransaction('goal', { type: 'contribution', amount: 100, date: '2999-01-01' }, 'request')).toBeRejectedWithError(/future/);
  });
});
