import { FormBuilder } from '@angular/forms';
import { NgbActiveModal } from '@ng-bootstrap/ng-bootstrap';
import { TestBed } from '@angular/core/testing';
import { GoalFormComponent } from './goal-form.component';

describe('GoalFormComponent', () => {
  let component: GoalFormComponent;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [FormBuilder, { provide: NgbActiveModal, useValue: {} }]
    });
    component = TestBed.runInInjectionContext(() => new GoalFormComponent());
    component.ngOnInit();
  });

  it('limits active percentage plans to two decimal places and the available allocation', () => {
    component.maxPercentage = 35.5;
    component.updateAllocationValidators();
    component.form.patchValue({ allocationValue: 12.345 });
    expect(component.form.get('allocationValue')?.invalid).toBeTrue();

    component.form.patchValue({ allocationValue: 35.51 });
    expect(component.form.get('allocationValue')?.hasError('max')).toBeTrue();

    component.form.patchValue({ allocationValue: 35.5 });
    expect(component.form.get('allocationValue')?.valid).toBeTrue();
  });

  it('rejects blank names and malformed optional dates', () => {
    component.form.patchValue({ name: '   ', targetDate: '2026-02-30' });
    expect(component.form.get('name')?.hasError('whitespace')).toBeTrue();
    expect(component.form.get('targetDate')?.hasError('invalidDate')).toBeTrue();
  });

  it('emits a trimmed, whole-CLP savings goal input', () => {
    const submitted = jasmine.createSpy('submitted');
    component.submitted.subscribe(submitted);
    component.form.patchValue({
      name: '  Viaje al sur  ',
      targetAmount: '500000',
      allocationType: 'percentage',
      allocationValue: '12.5',
      status: 'active'
    });

    component.submit();

    expect(submitted).toHaveBeenCalledOnceWith({
      name: 'Viaje al sur',
      targetAmount: 500000,
      allocationType: 'percentage',
      allocationValue: 12.5,
      status: 'active'
    });
  });
});
