import { ComponentFixture, TestBed, fakeAsync, flushMicrotasks } from '@angular/core/testing';
import { CommonModule } from '@angular/common';
import { BehaviorSubject, of, throwError } from 'rxjs';
import { NgbModal } from '@ng-bootstrap/ng-bootstrap';
import { SavingsGoalsComponent } from './savings-goals.component';
import { SavingsGoal } from '@core/models/savings-goal';
import { SavingsGoalsService } from '@core/services/savings-goals.service';
import { AuthService } from '@core/services/auth.service';
import { IncomesService } from '@core/services/incomes.service';

describe('Savings goals page with synthetic services', () => {
  let fixture: ComponentFixture<SavingsGoalsComponent>;
  let auth$: BehaviorSubject<{ uid: string } | null>;
  let goals$: BehaviorSubject<SavingsGoal[]>;
  let getGoals: jasmine.Spy;
  const goal = { uid: 'test-goal', name: 'Synthetic savings', targetAmount: 100000,
    balance: 20000, allocationType: 'fixed', allocationValue: 10000, status: 'active' } as SavingsGoal;

  beforeEach(async () => {
    auth$ = new BehaviorSubject<{ uid: string } | null>({ uid: 'synthetic-user' });
    goals$ = new BehaviorSubject([goal]);
    getGoals = jasmine.createSpy().and.returnValue(goals$);
    await TestBed.configureTestingModule({
      declarations: [SavingsGoalsComponent], imports: [CommonModule],
      providers: [
        { provide: NgbModal, useValue: {} },
        { provide: AuthService, useValue: { isAuthenticated: () => auth$ } },
        { provide: IncomesService, useValue: { getForPeriod: () => of([{ amount: '100000' }]) } },
        { provide: SavingsGoalsService, useValue: { getGoals, getTransactions: () => of([]), saveGoal: jasmine.createSpy().and.resolveTo() } }
      ]
    }).compileComponents();
    fixture = TestBed.createComponent(SavingsGoalsComponent);
    fixture.detectChanges();
  });

  it('renders actual balance separately from the monthly plan', () => {
    expect(fixture.componentInstance.overview.balance).toBe(20000);
    expect(fixture.componentInstance.monthlyPlanned).toBe(10000);
    expect(fixture.nativeElement.querySelector('h1').textContent).toContain('Mis metas');
    expect(fixture.nativeElement.querySelectorAll('.goal-card').length).toBe(1);
    expect(fixture.nativeElement.querySelector('.goal-card__actions--secondary')).toBeNull();
  });

  it('clears account data when authentication changes before new snapshots arrive', () => {
    getGoals.and.returnValue(new BehaviorSubject<SavingsGoal[]>([]));
    auth$.next({ uid: 'other-synthetic-user' });
    fixture.detectChanges();
    expect(fixture.componentInstance.goals).toEqual([]);
    expect(fixture.componentInstance.overview.balance).toBe(0);
    auth$.next(null);
    fixture.detectChanges();
    expect(fixture.componentInstance.monthlyIncome).toBe(0);
  });

  it('shows recoverable errors without presenting the previous account data', () => {
    getGoals.and.returnValue(throwError(() => new Error('synthetic failure')));
    fixture.componentInstance.loadData();
    fixture.detectChanges();
    expect(fixture.componentInstance.loadError).toBeTrue();
    expect(fixture.componentInstance.goals).toEqual([]);
    expect(fixture.nativeElement.querySelector('.state-card--error').textContent).toContain('Reintentar');
  });

  it('retains archived money but removes its monthly allocation', () => {
    goals$.next([{ ...goal, status: 'archived' }]);
    fixture.detectChanges();
    expect(fixture.componentInstance.overview.balance).toBe(20000);
    expect(fixture.componentInstance.monthlyPlanned).toBe(0);
  });

  it('warns about a fixed plan even when no income has been recorded', () => {
    TestBed.inject(IncomesService).getForPeriod = () => of([]);
    fixture.componentInstance.loadData();
    fixture.detectChanges();
    expect(fixture.componentInstance.monthlyPlanned).toBe(10000);
    expect(fixture.componentInstance.hasAllocationOverIncome).toBeTrue();
    expect(fixture.nativeElement.querySelector('.allocation-warning')).not.toBeNull();
  });

  it('guards pending status writes independently for each goal', fakeAsync(() => {
    const saveGoal = TestBed.inject(SavingsGoalsService).saveGoal as jasmine.Spy;
    const releases: Record<string, () => void> = {};
    saveGoal.and.callFake((_input: unknown, id: string) => new Promise<void>(resolve => releases[id] = resolve));
    const component = fixture.componentInstance;
    const other = { ...goal, uid: 'second-goal' };
    component.togglePause(goal);
    component.togglePause(other);
    component.togglePause(goal);
    expect(saveGoal.calls.count()).toBe(2);
    releases['test-goal']();
    flushMicrotasks();
    expect(component.isUpdating(goal)).toBeFalse();
    expect(component.isUpdating(other)).toBeTrue();
    component.togglePause(other);
    expect(saveGoal.calls.count()).toBe(2);
    releases['second-goal']();
    flushMicrotasks();
    expect(component.isUpdating(other)).toBeFalse();
  }));
});
