import { CommonModule } from '@angular/common';
import { TestBed, fakeAsync, tick } from '@angular/core/testing';
import { Timestamp } from '@angular/fire/firestore';
import { NgbModal } from '@ng-bootstrap/ng-bootstrap';
import { SharedModule } from '@shared/shared.module';
import { ToastrService } from 'ngx-toastr';
import { Subject, of } from 'rxjs';
import { Income } from '@core/models/income';
import { IncomesService } from '@core/services/incomes.service';
import { AddIncomesComponent } from './add-incomes/add-incomes.component';
import { EditIncomeComponent } from './edit-income/edit-income.component';
import { IncomesComponent } from './incomes.component';

describe('IncomesComponent', () => {
  const october = new Date(2026, 9, 1, 12);
  const makeIncome = (
    uid: string,
    title: string,
    amount: string,
    period: string | undefined,
    createdAt: Date,
    type: 'fixed' | 'variable' = 'fixed'
  ): Income => ({
    uid,
    title,
    amount,
    period,
    type,
    createdAt: Timestamp.fromDate(createdAt),
    updatedAt: Timestamp.fromDate(createdAt)
  });

  let incomesService: {
    getAll: jasmine.Spy;
    getIncomePeriod: jasmine.Spy;
    save: jasmine.Spy;
    update: jasmine.Spy;
    delete: jasmine.Spy;
  };
  let modalService: { open: jasmine.Spy };
  let toastr: { success: jasmine.Spy; error: jasmine.Spy };
  let createModalRef: any;
  let editModalRef: any;

  beforeEach(async () => {
    const records = [
      makeIncome('salary', 'Sueldo', '1100000', '2026-10', october),
      makeIncome('bonus', 'Trabajo adicional', '100000', undefined, new Date(2026, 9, 15, 12), 'variable'),
      makeIncome('old-month', 'Sueldo anterior', '900000', '2026-09', new Date(2026, 8, 1, 12))
    ];
    incomesService = {
      getAll: jasmine.createSpy().and.returnValue(of(records)),
      getIncomePeriod: jasmine.createSpy().and.callFake((income: Income) => {
        if (income.period) return income.period;
        const date = income.createdAt?.toDate();
        return date ? `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}` : '';
      }),
      save: jasmine.createSpy().and.returnValue(Promise.resolve()),
      update: jasmine.createSpy().and.returnValue(Promise.resolve()),
      delete: jasmine.createSpy().and.returnValue(Promise.resolve())
    };
    createModalRef = { componentInstance: { period: '', newIncome$: new Subject<Income>() } };
    editModalRef = { componentInstance: { income: null, editIncome$: new Subject<Income>(), deleteIncome$: new Subject<string>() } };
    modalService = {
      open: jasmine.createSpy().and.callFake((component: unknown) =>
        component === AddIncomesComponent ? createModalRef : editModalRef)
    };
    toastr = { success: jasmine.createSpy(), error: jasmine.createSpy() };

    await TestBed.configureTestingModule({
      declarations: [IncomesComponent],
      imports: [CommonModule, SharedModule],
      providers: [
        { provide: IncomesService, useValue: incomesService },
        { provide: NgbModal, useValue: modalService },
        { provide: ToastrService, useValue: toastr }
      ]
    }).compileComponents();
  });

  function createFixture() {
    const fixture = TestBed.createComponent(IncomesComponent);
    fixture.detectChanges();
    fixture.componentInstance.filtersForm.patchValue({ period: '2026-10' });
    tick(200);
    fixture.detectChanges();
    return fixture;
  }

  it('combines the selected calendar month, legacy createdAt fallback, search and filtered total', fakeAsync(() => {
    const fixture = createFixture();
    const component = fixture.componentInstance;

    expect(component.incomes.map(income => income.uid)).toEqual(['salary', 'bonus']);
    expect(component.collectionSize).toBe(2);
    expect(component.totalAmountFiltered).toBe(1200000);
    expect(component.selectedPeriodLabel).toBe('Octubre 2026');

    component.filtersForm.patchValue({ search: 'trabajo' });
    tick(200);
    expect(component.incomes.map(income => income.uid)).toEqual(['bonus']);
    expect(component.collectionSize).toBe(1);
    expect(component.totalAmountFiltered).toBe(100000);
    expect(component.isSearchActive).toBeTrue();
    fixture.destroy();
  }));

  it('keeps the filtered total across pages and shows explicit edit actions', fakeAsync(() => {
    const records = Array.from({ length: 10 }, (_, index) =>
      makeIncome(`income-${index}`, `Ingreso ${index}`, String((index + 1) * 1000), '2026-10', new Date(2026, 9, index + 1, 12)));
    incomesService.getAll.and.returnValue(of(records));
    const fixture = createFixture();
    const component = fixture.componentInstance;
    component.pageSize = 8;
    component.filter();

    expect(component.incomes.length).toBe(8);
    expect(component.collectionSize).toBe(10);
    expect(component.totalAmountFiltered).toBe(55000);
    expect(fixture.nativeElement.querySelector('.module-mobile-card .income-edit-button')).toBeTruthy();
    expect(fixture.nativeElement.querySelector('.table-card .income-edit-button')).toBeTruthy();

    component.page = 2;
    component.filter();
    expect(component.incomes.map(income => income.uid)).toEqual(['income-8', 'income-9']);
    expect(component.totalAmountFiltered).toBe(55000);
    fixture.destroy();
  }));

  it('navigates calendar months and disables the next control for the current month', fakeAsync(() => {
    const fixture = createFixture();
    const component = fixture.componentInstance;
    component.filtersForm.patchValue({ period: '2026-01' });
    component.previousMonth();
    expect(component.selectedPeriod).toBe('2025-12');
    component.nextMonth();
    expect(component.selectedPeriod).toBe('2026-01');

    const now = new Date();
    const currentPeriod = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    component.filtersForm.patchValue({ period: currentPeriod });
    fixture.detectChanges();
    expect(component.isCurrentMonth).toBeTrue();
    expect((fixture.nativeElement.querySelector('[aria-label="Ver mes siguiente"]') as HTMLButtonElement).disabled).toBeTrue();
    fixture.destroy();
  }));

  it('passes the selected month to creation and opens edit from its explicit button', fakeAsync(() => {
    const fixture = createFixture();
    const component = fixture.componentInstance;

    component.openCreateModal();
    expect(modalService.open).toHaveBeenCalledWith(AddIncomesComponent, jasmine.any(Object));
    expect(createModalRef.componentInstance.period).toBe('2026-10');

    fixture.nativeElement.querySelector('.module-mobile-card .income-edit-button').click();
    expect(modalService.open).toHaveBeenCalledWith(EditIncomeComponent, jasmine.any(Object));
    expect(editModalRef.componentInstance.income.uid).toBe('salary');
    fixture.destroy();
  }));

  it('distinguishes an empty search from an empty month and clears only the search', fakeAsync(() => {
    const fixture = createFixture();
    const component = fixture.componentInstance;
    component.filtersForm.patchValue({ search: 'no existe' });
    tick(200);
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('.empty-state__title').textContent).toContain('No encontramos');

    fixture.nativeElement.querySelector('.empty-state__action').click();
    tick(200);
    fixture.detectChanges();
    expect(component.filtersForm.value).toEqual({ search: '', period: '2026-10' });
    expect(component.collectionSize).toBe(2);

    component.filtersForm.patchValue({ search: '   ' });
    tick(200);
    fixture.detectChanges();
    expect(component.collectionSize).toBe(0);
    expect(component.isSearchActive).toBeTrue();
    expect(fixture.nativeElement.querySelector('.empty-state__title').textContent).toContain('No encontramos');
    expect(fixture.nativeElement.querySelector('.empty-state__action').textContent).toContain('Limpiar búsqueda');
    fixture.nativeElement.querySelector('.empty-state__action').click();
    tick(200);
    fixture.detectChanges();
    expect(component.collectionSize).toBe(2);
    expect(component.filtersForm.value).toEqual({ search: '', period: '2026-10' });
    fixture.destroy();
  }));

  it('formats only an actual createdAt date for the card presentation', fakeAsync(() => {
    const fixture = createFixture();
    const component = fixture.componentInstance;
    expect(component.getIncomeCreatedAtLabel(component.incomes[0])).toContain('octubre de 2026');
    const withoutCreatedAt = { ...component.incomes[0], createdAt: undefined } as unknown as Income;
    expect(component.getIncomeCreatedAtLabel(withoutCreatedAt)).toBeNull();
    fixture.destroy();
  }));
});
