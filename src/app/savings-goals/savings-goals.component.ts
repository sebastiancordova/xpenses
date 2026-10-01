import { Component, OnDestroy, OnInit, inject } from '@angular/core';
import { NgbModal } from '@ng-bootstrap/ng-bootstrap';
import { Income } from '@core/models/income';
import { SavingsGoal, SavingsGoalInput, SavingsTransaction } from '@core/models/savings-goal';
import { AuthService } from '@core/services/auth.service';
import { IncomesService } from '@core/services/incomes.service';
import { SavingsGoalsService } from '@core/services/savings-goals.service';
import { getGoalProjection, getSavingsOverview, getSuggestedContribution } from '@core/utils/savings-goals.utils';
import { combineLatest, Subscription, catchError, distinctUntilChanged, map, of, switchMap, tap } from 'rxjs';
import { GoalFormComponent } from './goal-form/goal-form.component';
import { TransactionFormComponent, TransactionSubmission } from './transaction-form/transaction-form.component';
import { ConfirmActionComponent } from './confirm-action/confirm-action.component';

interface SavingsPageData {
  goals: SavingsGoal[];
  transactions: SavingsTransaction[];
  monthlyIncome: number;
}

@Component({
  selector: 'app-savings-goals',
  templateUrl: './savings-goals.component.html',
  styleUrls: ['./savings-goals.component.scss']
})
export class SavingsGoalsComponent implements OnInit, OnDestroy {
  private readonly goalsService = inject(SavingsGoalsService);
  private readonly incomesService = inject(IncomesService);
  private readonly authService = inject(AuthService);
  private readonly modalService = inject(NgbModal);
  private dataSubscription?: Subscription;
  public readonly currentPeriod = this.getCurrentPeriod();
  public readonly currentPeriodLabel = new Intl.DateTimeFormat('es-CL', { month: 'long', year: 'numeric' }).format(new Date());

  public loading = true;
  public loadError = false;
  public goals: SavingsGoal[] = [];
  public transactions: SavingsTransaction[] = [];
  public monthlyIncome = 0;
  public expandedGoalId: string | null = null;
  public notice = '';
  public readonly updatingGoalIds = new Set<string>();
  public readonly today = this.toLocalDate(new Date());
  private currentUserId: string | null = null;

  ngOnInit(): void {
    this.loadData();
  }

  ngOnDestroy(): void {
    this.dataSubscription?.unsubscribe();
  }

  loadData(): void {
    this.dataSubscription?.unsubscribe();
    this.loading = true;
    this.loadError = false;
    this.goals = [];
    this.transactions = [];
    this.monthlyIncome = 0;
    this.dataSubscription = this.authService.isAuthenticated().pipe(
      distinctUntilChanged((previous, current) => previous?.uid === current?.uid),
      tap(user => {
        const nextUserId = user?.uid ?? null;
        if (nextUserId !== this.currentUserId) {
          this.currentUserId = nextUserId;
          this.goals = [];
          this.transactions = [];
          this.monthlyIncome = 0;
          this.expandedGoalId = null;
          this.notice = '';
          this.loadError = false;
          this.loading = true;
        }
      }),
      switchMap(user => user?.uid
        ? combineLatest([
          this.goalsService.getGoals(),
          this.goalsService.getTransactions(),
          this.incomesService.getForPeriod(this.currentPeriod).pipe(
            map((incomes: Income[]) => incomes.reduce((sum, income) => sum + this.parseAmount(income.amount), 0))
          )
        ]).pipe(map(([goals, transactions, monthlyIncome]) => ({ goals, transactions, monthlyIncome } as SavingsPageData)))
        : of<SavingsPageData>({ goals: [], transactions: [], monthlyIncome: 0 })
      ),
      catchError(() => {
        this.loadError = true;
        return of(null);
      })
    ).subscribe((data) => {
      if (data) {
        this.goals = data.goals;
        this.transactions = data.transactions;
        this.monthlyIncome = data.monthlyIncome;
        this.loadError = false;
      }
      this.loading = false;
    });
  }

  get overview() {
    return getSavingsOverview(this.goals, this.monthlyIncome);
  }

  get hasAllocationOverIncome(): boolean {
    return this.overview.suggestedMonthly > this.monthlyIncome;
  }

  get monthlyPlanned(): number {
    return this.overview.suggestedMonthly;
  }

  get planPercent(): number {
    return this.monthlyIncome > 0 ? Math.min(100, (this.monthlyPlanned / this.monthlyIncome) * 100) : 0;
  }

  get displayGoals(): SavingsGoal[] {
    const statusOrder: Record<SavingsGoal['status'], number> = {
      active: 0, paused: 1, completed: 2, archived: 3
    };
    return [...this.goals].sort((a, b) => statusOrder[a.status] - statusOrder[b.status]);
  }

  openCreateGoal(): void {
    this.openGoalForm();
  }

  openEditGoal(goal: SavingsGoal): void {
    if (!goal.uid) {
      this.notice = 'No pudimos identificar esta meta. Recarga la página e inténtalo otra vez.';
      return;
    }
    this.openGoalForm(goal);
  }

  private openGoalForm(goal?: SavingsGoal): void {
    let isSaving = false;
    const modal = this.modalService.open(GoalFormComponent, {
      size: 'sm', centered: true, windowClass: 'savings-goal-modal', backdrop: 'static', keyboard: true,
      ariaLabelledBy: 'savings-modal-title',
      beforeDismiss: () => !isSaving
    });
    modal.componentInstance.goal = goal;
    const alreadyAllocated = this.overview.allocatedPercentage
      - (goal?.status === 'active' && goal.allocationType === 'percentage' ? goal.allocationValue : 0);
    modal.componentInstance.maxPercentage = Math.max(0, Math.round((100 - alreadyAllocated) * 100) / 100);
    modal.componentInstance.updateAllocationValidators();
    const submittedSubscription = modal.componentInstance.submitted.subscribe(async (input: SavingsGoalInput) => {
      modal.componentInstance.loading = true;
      modal.componentInstance.error = '';
      isSaving = true;
      try {
        await this.goalsService.saveGoal(input, goal?.uid);
        this.notice = goal ? 'Meta actualizada.' : 'Meta creada.';
        isSaving = false;
        modal.close();
      } catch {
        isSaving = false;
        modal.componentInstance.loading = false;
        modal.componentInstance.error = 'No se pudo guardar. Revisa tu conexión e inténtalo otra vez; tus cambios siguen aquí.';
      }
    });
    modal.result.then(() => submittedSubscription.unsubscribe(), () => submittedSubscription.unsubscribe());
  }

  openTransaction(goal: SavingsGoal, type: 'contribution' | 'withdrawal'): void {
    if (!goal.uid) {
      this.notice = 'No pudimos identificar esta meta. Recarga la página e inténtalo otra vez.';
      return;
    }
    let isSaving = false;
    const modal = this.modalService.open(TransactionFormComponent, {
      size: 'sm', centered: true, windowClass: 'savings-goal-modal', backdrop: 'static', keyboard: true,
      ariaLabelledBy: 'savings-modal-title',
      beforeDismiss: () => !isSaving
    });
    modal.componentInstance.goal = goal;
    modal.componentInstance.type = type;
    const submittedSubscription = modal.componentInstance.submitted.subscribe(async (submission: TransactionSubmission) => {
      modal.componentInstance.loading = true;
      modal.componentInstance.error = '';
      isSaving = true;
      try {
        await this.goalsService.addTransaction(goal.uid!, submission, submission.requestId);
        this.notice = type === 'contribution' ? 'Aporte registrado.' : 'Retiro registrado.';
        isSaving = false;
        modal.close();
      } catch {
        isSaving = false;
        modal.componentInstance.loading = false;
        modal.componentInstance.error = 'No se pudo registrar el movimiento. Inténtalo otra vez; el formulario conserva tus datos.';
      }
    });
    modal.result.then(() => submittedSubscription.unsubscribe(), () => submittedSubscription.unsubscribe());
  }

  togglePause(goal: SavingsGoal): void {
    if (!goal.uid || this.updatingGoalIds.has(goal.uid)) return;
    this.updatingGoalIds.add(goal.uid);
    const input = this.toInput(goal);
    input.status = goal.status === 'active' ? 'paused' : 'active';
    this.goalsService.saveGoal(input, goal.uid).then(() => {
      this.notice = goal.status === 'active' ? 'Meta pausada.' : 'Meta reanudada.';
    }).catch(() => {
      this.notice = 'No se pudo actualizar la meta. Inténtalo otra vez.';
    }).finally(() => {
      this.updatingGoalIds.delete(goal.uid!);
    });
  }

  isUpdating(goal: SavingsGoal): boolean {
    return Boolean(goal.uid && this.updatingGoalIds.has(goal.uid));
  }

  archiveGoal(goal: SavingsGoal): void {
    if (!goal.uid) {
      this.notice = 'No pudimos identificar esta meta. Recarga la página e inténtalo otra vez.';
      return;
    }
    let isSaving = false;
    const modal = this.modalService.open(ConfirmActionComponent, {
      size: 'sm', centered: true, windowClass: 'savings-goal-modal', backdrop: 'static', keyboard: true,
      ariaLabelledBy: 'savings-modal-title',
      beforeDismiss: () => !isSaving
    });
    modal.componentInstance.title = 'Archivar meta';
    modal.componentInstance.message = `“${goal.name}” dejará de aparecer entre tus metas activas. Su saldo y movimientos se conservarán en el historial.`;
    modal.componentInstance.confirmLabel = 'Archivar meta';
    const confirmedSubscription = modal.componentInstance.confirmed.subscribe(async () => {
      modal.componentInstance.loading = true;
      modal.componentInstance.error = '';
      isSaving = true;
      const input = this.toInput(goal);
      input.status = 'archived';
      try {
        await this.goalsService.saveGoal(input, goal.uid);
        this.notice = 'Meta archivada; su historial sigue disponible.';
        isSaving = false;
        modal.close();
      } catch {
        isSaving = false;
        modal.componentInstance.loading = false;
        modal.componentInstance.error = 'No se pudo archivar la meta. Inténtalo otra vez.';
      }
    });
    modal.result.then(() => confirmedSubscription.unsubscribe(), () => confirmedSubscription.unsubscribe());
  }

  transactionsFor(goal: SavingsGoal): SavingsTransaction[] {
    return this.transactions
      .filter(transaction => transaction.goalId === goal.uid)
      .sort((a, b) => b.date.localeCompare(a.date));
  }

  projection(goal: SavingsGoal) {
    return getGoalProjection(goal, this.monthlyIncome, new Date());
  }

  suggestedContribution(goal: SavingsGoal): number {
    return getSuggestedContribution(goal, this.monthlyIncome);
  }

  hasLateProjection(goal: SavingsGoal): boolean {
    const estimatedDate = this.projection(goal).estimatedDate;
    return Boolean(goal.targetDate && estimatedDate && goal.balance < goal.targetAmount && estimatedDate > goal.targetDate);
  }

  progress(goal: SavingsGoal): number {
    if (goal.targetAmount <= 0) return 0;
    return Math.min(100, Math.max(0, (goal.balance / goal.targetAmount) * 100));
  }

  formatMoney(amount: number): string {
    return new Intl.NumberFormat('es-CL', {
      style: 'currency', currency: 'CLP', maximumFractionDigits: 0
    }).format(Number.isFinite(amount) ? amount : 0);
  }

  formatPercentage(value: number): string {
    return new Intl.NumberFormat('es-CL', { maximumFractionDigits: 2 }).format(value);
  }

  formatDate(value: string): string {
    const [year, month, day] = value.split('-').map(Number);
    if (!year || !month || !day) return value;
    return new Intl.DateTimeFormat('es-CL', { day: 'numeric', month: 'short', year: 'numeric' })
      .format(new Date(year, month - 1, day));
  }

  statusLabel(status: SavingsGoal['status']): string {
    return ({ active: 'Activa', paused: 'En pausa', completed: 'Completada', archived: 'Archivada' })[status];
  }

  private toInput(goal: SavingsGoal): SavingsGoalInput {
    return {
      name: goal.name,
      targetAmount: goal.targetAmount,
      targetDate: goal.targetDate,
      allocationType: goal.allocationType,
      allocationValue: goal.allocationValue,
      status: goal.status
    };
  }

  private parseAmount(value: string): number {
    const amount = Number(value);
    return Number.isFinite(amount) && amount > 0 ? amount : 0;
  }

  private getCurrentPeriod(): string {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  }

  private toLocalDate(date: Date): string {
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
  }
}
