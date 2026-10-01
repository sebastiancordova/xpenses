import { ApplicationRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, ReactiveFormsModule } from '@angular/forms';
import { NgbActiveModal, NgbModal, NgbModalModule } from '@ng-bootstrap/ng-bootstrap';
import { TestBed } from '@angular/core/testing';
import { SavingsGoal } from '@core/models/savings-goal';
import { TransactionFormComponent } from './transaction-form.component';

describe('TransactionFormComponent', () => {
  let component: TransactionFormComponent;
  const goal = {
    uid: 'goal-1', name: 'Viaje', targetAmount: 500_000, allocationType: 'fixed',
    allocationValue: 25_000, status: 'active', balance: 60_000
  } as SavingsGoal;

  beforeEach(() => {
    TestBed.configureTestingModule({
      declarations: [TransactionFormComponent],
      imports: [CommonModule, ReactiveFormsModule, NgbModalModule],
      providers: [FormBuilder, { provide: NgbActiveModal, useValue: {} }]
    });
    component = TestBed.runInInjectionContext(() => new TransactionFormComponent());
    component.goal = goal;
    component.type = 'withdrawal';
  });

  afterEach(() => TestBed.inject(NgbModal).dismissAll());

  it('opens as the first savings modal before the parent assigns goal data', () => {
    const modal = TestBed.inject(NgbModal).open(TransactionFormComponent, {
      windowClass: 'savings-goal-modal', ariaLabelledBy: 'savings-modal-title', animation: false
    });

    expect(document.body.querySelector('.savings-goal-modal .modal-content')).not.toBeNull();
    const component = modal.componentInstance;
    component.goal = goal;
    component.type = 'contribution';
    TestBed.inject(ApplicationRef).tick();

    expect(document.body.querySelector('.transaction-goal-name')?.textContent).toContain('Viaje');
    expect(document.body.querySelector('#transaction-amount')).not.toBeNull();
    expect(document.activeElement).toBe(document.body.querySelector('#transaction-amount'));
    expect(getComputedStyle(document.body.querySelector('.savings-goal-modal .modal-content') as Element).borderTopLeftRadius).toBe('14px');

    modal.close();
    const reopened = TestBed.inject(NgbModal).open(TransactionFormComponent, {
      windowClass: 'savings-goal-modal', ariaLabelledBy: 'savings-modal-title', animation: false
    });
    reopened.componentInstance.goal = goal;
    reopened.componentInstance.type = 'withdrawal';
    TestBed.inject(ApplicationRef).tick();
    reopened.componentInstance.form.patchValue({ amount: '60001' });
    expect(reopened.componentInstance.form.get('amount')?.hasError('exceedsBalance')).toBeTrue();
    expect(document.body.querySelector('.transaction-goal-name')?.textContent).toContain('Viaje');
    reopened.dismiss();
  });

  it('keeps withdrawals within the current goal balance', () => {
    component.form.patchValue({ amount: '60001' });
    expect(component.form.get('amount')?.hasError('exceedsBalance')).toBeTrue();
    component.form.get('amount')?.markAsTouched();
    expect(component.amountError).toContain('saldo disponible');

    component.form.patchValue({ amount: '60000' });
    expect(component.form.get('amount')?.valid).toBeTrue();
  });

  it('rejects future transaction dates', () => {
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    const date = `${tomorrow.getFullYear()}-${String(tomorrow.getMonth() + 1).padStart(2, '0')}-${String(tomorrow.getDate()).padStart(2, '0')}`;
    component.form.patchValue({ date });
    expect(component.form.get('date')?.hasError('futureDate')).toBeTrue();
  });

  it('reuses an idempotency key for a retry and refreshes it when the request changes', () => {
    const requests: string[] = [];
    component.submitted.subscribe(submission => requests.push(submission.requestId));
    component.form.patchValue({ amount: '2000', date: component.today, note: 'Ahorro' });
    component.submit();
    component.submit();
    expect(requests[0]).toBe(requests[1]);

    component.form.patchValue({ amount: '3000' });
    component.submit();
    expect(requests[2]).not.toBe(requests[1]);
  });

  it('does not emit another movement while a request is saving', () => {
    const submitted = jasmine.createSpy('submitted');
    component.submitted.subscribe(submitted);
    component.form.patchValue({ amount: '2000', date: component.today });
    component.loading = true;

    component.submit();

    expect(submitted).not.toHaveBeenCalled();
  });
});
