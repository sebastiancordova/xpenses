import { NgModule, inject } from '@angular/core';
import { Routes, RouterModule, Router } from '@angular/router';
import { MainComponent } from './main/main.component';
import { AuthService } from '@core/services/auth.service';
import { tap } from 'rxjs';

const routes: Routes = [
  {
    path: '',
    redirectTo: '/dashboard',
    pathMatch: 'full',
  },
  {
    path: '',
    component: MainComponent,
    canMatch: [() => {
      const router = inject(Router);
      return inject(AuthService).isAuthenticated().pipe(tap(u => u ?? router.navigate(['/auth/login'])));
    }],
    children: [
      {
        path: 'dashboard',
        loadChildren: () => import('../dashboard/dashboard.module').then(m => m.DashboardModule),
      },
      {
        path: 'ingresos',
        loadChildren: () => import('../incomes/incomes.module').then(m => m.IncomesModule),
      },
      {
        path: 'gastos',
        loadChildren: () => import('../expenses/expenses.module').then(m => m.ExpensesModule)
      },
      {
        path: 'gastos-fijos',
        loadChildren: () => import('../fixed-expenses/fixed-expenses.module').then(m => m.FixedExpensesModule)
      },
      {
        path: 'subscripciones',
        loadChildren: () => import('../subscriptions/subscriptions.module').then(m => m.SubscriptionsModule)
      }
    ]
  }

];

@NgModule({
  imports: [RouterModule.forChild(routes)],
  exports: [RouterModule],
  providers: [],
})
export class MainRoutingModule { }
