import { NgZone, provideZoneChangeDetection } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { documentValue, zoneListener } from './firebase-streams.service';

describe('Firebase stream adapter primitives', () => {
  let zone: NgZone;

  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [provideZoneChangeDetection()] });
    zone = TestBed.inject(NgZone);
  });

  it('delivers listener values inside Angular and unsubscribes the Firebase listener', () => {
    const stop = jasmine.createSpy('stop listener');
    const values: number[] = [];
    zoneListener<number>(zone, next => {
      next(7);
      return stop;
    }).subscribe(value => {
      expect(NgZone.isInAngularZone()).toBeTrue();
      values.push(value);
    }).unsubscribe();

    expect(values).toEqual([7]);
    expect(stop).toHaveBeenCalledTimes(1);
  });

  it('propagates listener failures through the Observable error channel', () => {
    const expected = new Error('synthetic listener failure');
    let actual: unknown;
    zoneListener<number>(zone, (_next, error) => {
      error(expected);
      return () => undefined;
    }).subscribe({ error: error => actual = error });

    expect(actual).toBe(expected);
  });

  it('preserves missing-document and idField semantics', () => {
    expect(documentValue(false, undefined, 'missing', 'uid')).toBeUndefined();
    expect(documentValue(true, { uid: 'stored', title: 'Expense' }, 'document-id', 'uid'))
      .toEqual({ uid: 'document-id', title: 'Expense' });
  });
});
