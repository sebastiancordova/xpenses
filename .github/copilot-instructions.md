# Xpenses — Project Guidelines

## Build & Test

```bash
ng serve          # dev server → http://localhost:4200
ng build          # production build → dist/xpenses/
ng test           # unit tests via Karma
ng generate ...   # scaffolding (component, service, guard, module, etc.)
```

## Architecture

Two lazy-loaded entry points from `AppRoutingModule`:

```
/auth  → AuthModule         # login, register, reset (no guard)
/      → MainModule         # shell layout, guarded (inline CanMatch → authState)
```

`MainModule` hosts a sidebar shell and lazy-loads all features as children:

| Route             | Module                |
|-------------------|-----------------------|
| `/dashboard`      | `DashboardModule`     |
| `/ingresos`       | `IncomesModule`       |
| `/gastos`         | `ExpensesModule`      |
| `/gastos-fijos`   | `FixedExpensesModule` |
| `/subscripciones` | `SubscriptionsModule` |

**Path aliases** (configured in `tsconfig.json`): `@core/`, `@shared/`, `@environment/`.

## Conventions

### Modules & Components
- **NgModule-based only** — no standalone components (Angular 16, not yet migrated).
- Each feature declares `XComponent`, `AddXComponent`, `EditXComponent` in `XModule`.
- Editing is done via **ng-bootstrap modals** (`NgbModal`), not routed pages.
- Subscription cleanup: always use `takeUntil(this.unsubscribe$)` + `Subject` destroyed in `ngOnDestroy`.
- No `OnPush` — all components use default change detection.

### Services
- Use `inject()` for DI (not constructor parameters).
- All services are `providedIn: 'root'`.
- CRUD pattern: `getAll()` → `Observable<T[]>` via `collectionData({ idField: 'uid' })`, `save()`, `update()`, `delete(id)`.

### Models
- All domain models extend `Base` (`createdAt: Timestamp`, `updatedAt: Timestamp`, `uid?: string`).
- **`amount` is stored as `string`**, not number, on all models.
- Firestore per-user subcollections: `users/{uid}/expenses`, `users/{uid}/incomes`, `users/{uid}/fixed-expenses`, `users/{uid}/subscriptions`.

### Forms
- Use `ReactiveFormsModule` with getter accessors for form controls.
- Custom cross-field validator lives in `@core/validators/custom.validators.ts` (`CustomValidator.confirmPassword`).

### Styling
- **Bootstrap 4** (not 5) + ng-bootstrap `^15`.
- Global SCSS structure: `src/assets/sass/_variables.scss` (brand palette, breakpoints), `_mixins.scss`, `_extend_bootstrap.scss`.
- Brand palette: primary `#876656`, secondary `#BD9988`; font: `Lato`.
- Import shared variables/mixins via `@use`/`@import` from `src/assets/sass/`.

### Shared Module
`SharedModule` exports ng-bootstrap modal/pagination/popover/datepicker modules, `ReactiveFormsModule`, and `RangeDateSelectorComponent`. Import it into every feature module.

## Key Pitfalls

- **Billing cycle is 19th–18th**, not calendar month. `ExpensesService.getAll()` defaults to this window; `DashboardComponent` replicates the same logic (it's duplicated by design for now).
- **`NoAuthGuard` is stale** — references `/empresas` (non-existent route) and `CanLoad` (deprecated). Don't use it.
- **`IsActiveGuard`** (email verification) is imported but not wired to any route — email verification is not enforced at runtime.
- The same Firebase config is used for dev and prod; only `production` flag and `appUrl` differ (see `src/environments/`).
- `firebase-tools` is incorrectly listed as a runtime dependency — treat it as dev-only.
