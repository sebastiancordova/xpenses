import { TestBed } from '@angular/core/testing';
import { Auth } from '@angular/fire/auth';
import { DocumentReference, Firestore, Timestamp, Transaction } from '@angular/fire/firestore';
import { FixedExpenseChargeInput } from '@core/models/fixed-expense-charge';
import { FixedExpenseChargesService, writeFixedExpenseCharge } from './fixed-expense-charges.service';
import { getFixedExpenseChargeId, getFixedExpenseChargeMonth } from '@core/utils/fixed-expense-charges.utils';

describe('FixedExpenseChargesService boundary validation (no remote Firebase)', () => {
  let service: FixedExpenseChargesService;
  const valid: FixedExpenseChargeInput = {
    fixedExpenseId: 'electricity', period: '2026-09', title: 'Electricity',
    amount: '110000', chargeDate: '2026-09-08', paymentMethodId: 'card-a', status: 'confirmed',
  };

  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [
      { provide: Auth, useValue: { currentUser: null } },
      { provide: Firestore, useValue: {} },
    ] });
    service = TestBed.inject(FixedExpenseChargesService);
  });

  it('rejects unauthenticated writes before creating a Firestore reference', async () => {
    await expectAsync(service.save(valid)).toBeRejectedWithError(/signed-in user/);
    await expectAsync(service.delete('electricity_2026-09')).toBeRejectedWithError(/signed-in user/);
  });

  it('validates the template ID, billing period, title, amount and charge date before Firebase access', async () => {
    await expectAsync(service.save({ ...valid, fixedExpenseId: 'unsafe/id' })).toBeRejectedWithError(/document ID/);
    await expectAsync(service.save({ ...valid, period: '2026-13' })).toBeRejectedWithError(/YYYY-MM/);
    await expectAsync(service.save({ ...valid, title: '  ' })).toBeRejectedWithError(/title/);

    for (const amount of ['', '0', '-1', '10.5', String(Number.MAX_SAFE_INTEGER + 1)]) {
      await expectAsync(service.save({ ...valid, amount })).toBeRejected();
    }
    await expectAsync(service.save({ ...valid, chargeDate: '2026-02-30' })).toBeRejectedWithError(/YYYY-MM-DD/);
    await expectAsync(service.save({
      ...valid,
      status: 'pending' as unknown as FixedExpenseChargeInput['status'],
    })).toBeRejectedWithError(/status/);
  });

  it('accepts an absent payment-method snapshot for debit, cash, or legacy templates', async () => {
    await expectAsync(service.save({ ...valid, paymentMethodId: undefined })).toBeRejectedWithError(/signed-in user/);
  });

  it('preserves the distinction between account month and actual charge month', async () => {
    await expectAsync(service.save({ ...valid, period: '2026-10', chargeDate: '2026-09-05' }))
      .toBeRejectedWithError(/signed-in user/);
  });

  it('rejects unsafe document IDs for deletion', async () => {
    await expectAsync(service.delete('charge/id')).toBeRejectedWithError(/document ID/);
  });
});

describe('FixedExpenseChargesService transaction persistence (synthetic documents)', () => {
  const input: FixedExpenseChargeInput = {
    fixedExpenseId: 'dividend', period: '2026-10', title: 'Dividendo',
    amount: '462560', chargeDate: '2026-10-05', status: 'confirmed',
  };
  const reference = (id: string) => ({ id }) as DocumentReference;
  const preferred = reference(getFixedExpenseChargeId(input.fixedExpenseId, getFixedExpenseChargeMonth(input)));
  const fallback = reference(`${preferred.id}_actual`);
  const createdAt = Timestamp.fromMillis(1000);
  let documents: Map<string, any>;
  let transaction: Pick<Transaction, 'get' | 'set'>;
  let writes: string[];

  beforeEach(() => {
    documents = new Map([[preferred.id, { ...input, chargeDate: '2026-09-05', createdAt }]]);
    writes = [];
    transaction = {
      get: jasmine.createSpy('get').and.callFake(async (ref: DocumentReference) => ({
        exists: () => documents.has(ref.id), data: () => documents.get(ref.id),
      })),
      set: jasmine.createSpy('set').and.callFake((ref: DocumentReference, value: any) => {
        writes.push(ref.id); documents.set(ref.id, value); return transaction;
      }),
    } as unknown as Pick<Transaction, 'get' | 'set'>;
  });

  it('preserves a September charge at a legacy October ID and creates a separate October occurrence', async () => {
    const september = documents.get(preferred.id);
    await writeFixedExpenseCharge(transaction, preferred, fallback, input, false);
    expect(documents.get(preferred.id)).toBe(september);
    expect(documents.get(fallback.id).chargeDate).toBe('2026-10-05');
    expect(documents.size).toBe(2);
    expect(writes).toEqual([fallback.id]);

    const octoberCreatedAt = documents.get(fallback.id).createdAt;
    await writeFixedExpenseCharge(transaction, preferred, fallback, { ...input, amount: '470000' }, false);
    expect(documents.size).toBe(2);
    expect(documents.get(fallback.id).amount).toBe('470000');
    expect(documents.get(fallback.id).createdAt).toBe(octoberCreatedAt);
    expect(documents.get(preferred.id)).toBe(september);
  });

  it('uses the date month for a new backdated occurrence and keeps edits on its original document', async () => {
    const backdated = { ...input, chargeDate: '2026-09-05' };
    const septemberRef = reference(getFixedExpenseChargeId(backdated.fixedExpenseId, getFixedExpenseChargeMonth(backdated)));
    expect(septemberRef.id).toBe('dividend_2026-09');
    documents.clear();
    await writeFixedExpenseCharge(transaction, septemberRef, reference(`${septemberRef.id}_actual`), backdated, false);
    expect(documents.get(septemberRef.id).period).toBe('2026-10');
    const timestamp = documents.get(septemberRef.id).createdAt;
    await writeFixedExpenseCharge(transaction, septemberRef, undefined, { ...backdated, amount: '450000' }, true);
    expect(documents.size).toBe(1);
    expect(documents.get(septemberRef.id).createdAt).toBe(timestamp);
    expect(documents.get(septemberRef.id).amount).toBe('450000');
  });

  it('retains legacy creation timestamps when editing their original ID', async () => {
    await writeFixedExpenseCharge(transaction, preferred, undefined, { ...input, chargeDate: '2026-09-05', amount: '450000' }, true);
    expect(documents.size).toBe(1);
    expect(documents.get(preferred.id).createdAt).toBe(createdAt);
    expect(documents.get(preferred.id).amount).toBe('450000');
  });

  it('refuses to overwrite unrelated collisions or recreate a deleted edit target', async () => {
    documents.set(fallback.id, { ...input, chargeDate: '2026-08-05' });
    await expectAsync(writeFixedExpenseCharge(transaction, preferred, fallback, input, false)).toBeRejectedWithError(/identity conflict/);
    expect(writes).toEqual([]);
    await expectAsync(writeFixedExpenseCharge(transaction, reference('missing'), undefined, input, true)).toBeRejectedWithError(/missing/);
    expect(writes).toEqual([]);
  });
});
