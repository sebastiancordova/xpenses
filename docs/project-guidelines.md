# Xpenses — Project Guidelines

Canonical technical context for Xpenses, independent of the coding assistant.
Migrated from the locally updated Copilot instructions without dropping technical
sections. The source was verified against the local implementation on 2026-10-01;
this migration does not constitute a new runtime or deployment audit.

Read [AGENTS.md](../AGENTS.md) for agent workflow and operational permissions,
[README.md](../README.md) for setup, and the
[architecture reference](../.github/.architecture.md) for extended context.
Code and current configuration take precedence over historical descriptions.
Update this guide when a delivery changes conventions, data contracts or business
behavior; keep operational rules in AGENTS.md. The former Copilot instructions were
migrated here and the original file has since been removed. Codex uses this guide.

## Build & Test

```bash
ng serve          # dev server → http://localhost:4200
ng build          # production build → dist/xpenses/
ng test           # unit tests via Karma
ng generate ...   # scaffolding (component, service, guard, module, etc.)
firebase deploy --only hosting     # deploy to Firebase Hosting
firebase deploy --only firestore   # deploy Firestore security rules
```

Use the existing npm scripts (`npm start`, `npm run build`, `npm test`); there is
no `npm run check`. Headless tests: `npm test -- --watch=false --browsers=ChromeHeadless`.
Use Node.js 24.15.0 (`.nvmrc`). Angular 22 permits Node `^22.22.3 || ^24.15.0 || >=26.0.0`,
but Firebase 13 packages require >=24.12.0. The combined project engine is `^24.15.0 || >=26.0.0`.
Install dependencies with `npm ci`, using the committed lockfile. Angular framework packages,
`@angular/compiler-cli`, `@angular/localize`, and the CLI/build toolchain target 22.2.3;
their exact peer dependencies must remain aligned when updating them. CDK retains its
independently compatible version. Regenerate the lockfile through normal npm resolution
after dependency changes; do not bypass peer conflicts with `--force` or
`--legacy-peer-deps`. Validate a clean `npm ci` and `npm run build` before accepting a dependency update.
On the macOS x64 validation host, the native embedded Sass runtime aborted. Use
`NG_BUILD_SASS_EMBEDDED=0 npm run build` on affected hosts to select the JavaScript
Sass implementation; keep the portable npm scripts unchanged.
Deployments and data migrations require the owner's explicit request. For
documentation-only changes, validate referenced paths and `git diff --check`.

### Angular 22 migration validation — 2026-10-20

- Node.js 24.15.0 and npm 10.9.2: clean `npm ci` passed without engine conflicts.
- `NG_BUILD_SASS_EMBEDDED=0 npm run build` passed with the host-specific Sass fallback.
  The build needed network access to inline the existing Google Fonts resource.
- Karma/ChromeHeadless: 114 general tests passed, followed by 7 focused notification tests
  covering timeout, persistent password-reset feedback, dismissal and escaped content.
- `git diff --check` and local documentation links passed. QA reviewed the integrated
  changes; no functional finding remains open. The Dashboard style error budget stays at 20 KB.
- Size warnings remain at the existing thresholds (initial bundle about 1.67 MB versus a 500 KB warning,
  component styles versus 2 KB warnings), together with legacy Sass/webpack deprecations.
  These checks do not constitute a physical-phone or full visual review. No remote Firebase
  validation, data migration or deployment was performed.

## UI/UX Workflow

For interface work, use the installed `ui-ux-pro-max` skill when available and read the
repository workflow at [PROMPT.md](../.github/prompts/ui-ux-pro-max/PROMPT.md), followed by
the relevant [Xpenses design references](../.github/design-system/xpenses/MASTER.md) and
page override. The skill supplies the workflow; the repository prompt supplies project
constraints and the bundled search utility; the Master and page files hold design decisions.
Current application conventions take precedence over generated recommendations.

Run the bundled search script from the repository root, for example:

```bash
python3 .github/prompts/ui-ux-pro-max/scripts/search.py "personal finance mobile dashboard" --domain ux --max-results 5
python3 .github/prompts/ui-ux-pro-max/scripts/search.py "responsive charts keyboard accessibility" --domain web
python3 .github/prompts/ui-ux-pro-max/scripts/search.py "personal finance dashboard" --design-system
```

The bundled stack catalog does not include Angular. Do not pass `--stack angular`; adapt
relevant UX, web, product, and style results to Angular 22, NgModules, reactive forms,
Bootstrap 5, ng-bootstrap 21, SCSS, Lato, and the existing brown tokens. Angular examples
may assume standalone or zoneless applications; this project retains NgModules and
Zone.js. Check the bundled script's `--help` for supported options. If persisting a
generated Xpenses design system is specifically needed, `--output-dir .github -p Xpenses`
writes under `.github/design-system/xpenses`; inspect and reconcile the diff because this
can replace the canonical design files.

The Hosting workflow [`firebase-hosting-develop.yml`](../.github/workflows/firebase-hosting-develop.yml) builds on pushes to `develop` with `npm ci` and `npm run build`, then deploys only Hosting target `xpenses` to the live channel of project `xpenses-93552` (`dist/xpenses`). It uses Node.js 24.15.0, satisfying the Angular 22 / Firebase 13 engine requirements and matching `.nvmrc`. Authentication is a dedicated service-account JSON in the GitHub repository secret `FIREBASE_SERVICE_ACCOUNT_XPENSES_93552`; activation and permissions are documented in [README.md](../README.md). The workflow serializes Hosting deployments. It does not deploy Firestore rules or run data migrations. Adding this configuration does not execute a deployment; publishing it on `develop` with its secret configured enables the requested automatic releases.

## Architecture

### Firebase SDK integration (Angular 22)

- At the migration date (2026-10-20), AngularFire 20.1.1 declares Angular 20 peer support. The Angular 22 upgrade
  replaces that dependency with the modular `firebase/app`, `firebase/auth` and
  `firebase/firestore` SDKs (Firebase 13.0.0); Firestore documents and authentication methods keep their contracts.
- Import the injectable `Auth` and `Firestore` tokens from `core/firebase/firebase.tokens`.
  Import SDK types, `Timestamp`, CRUD and transaction functions directly from `firebase/*`.
  `AppModule` creates the default Firebase app and supplies these instances. Tests must
  override the same local tokens; importing SDK interfaces does not create DI tokens.
- `FirebaseStreamsService` wraps `onAuthStateChanged` and `onSnapshot` in cold RxJS
  observables. It captures `NgZone` through constructor-time injection, emits values and
  errors inside Angular, and detaches listeners on unsubscribe. `docData` emits `undefined`
  for absent documents; `idField` adds the document ID, preserving existing service results.
- `src/main.ts` passes `provideZoneChangeDetection()` through
  `bootstrapModule(AppModule, { applicationProviders: [...] })` because Angular 21+
  defaults to zoneless. A module-level provider is insufficient for Angular 22 bootstrap
  ordering. Keep the bootstrap provider when upgrading; UI subscriptions and forms
  currently depend on Zone.js. TestBed must use the same detection mode for matching tests.
- IndexedDB persistence remains enabled, with the existing handling for unsupported
  browsers and conflicting tabs. Transactions still require a connection. No data migration,
  collection change, authentication provider change or rules deployment accompanies this upgrade.

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
| `/cuotas`         | `InstallmentPurchasesModule` |
| `/configuracion`  | `SettingsModule`      |
| `/metas`          | `SavingsGoalsModule`  |

**Path aliases** (configured in `tsconfig.json`): `@core/`, `@shared/`, `@environment/`.

## Firestore Data Model

### Collections (per-user subcollections under `users/{uid}/`)

| Subcollection        | Model          | Key fields                                             |
|----------------------|----------------|--------------------------------------------------------|
| `expenses`           | `Expense`      | `title`, `amount: string`, `category: ExpenseCategory \| string`, `subcategory?`, `comment`, `paymentMethodId?`, `createdAt`, `updatedAt` |
| `fixed-expenses`     | `FixedExpense` | `title`, `amount: string`, `paymentMethodId?`, `createdAt`, `updatedAt` |
| `fixed-expense-charges` | `FixedExpenseCharge` | `fixedExpenseId`, `period: YYYY-MM`, `title`, `amount: string`, `chargeDate: YYYY-MM-DD`, `paymentMethodId?`, `status: confirmed \| skipped`, `createdAt`, `updatedAt` |
| `incomes`            | `Income`       | `title`, `amount: string`, `period?: YYYY-MM`, `type?: fixed \| variable`, `createdAt`, `updatedAt` |
| `subscriptions`      | `Subscription` | `title`, `amount: string`, `paymentMethodId?`, `createdAt`, `updatedAt` |
| `installment-purchases` | `InstallmentPurchase` | `title`, `installmentAmount: string`, `totalInstallments`, `currentInstallment`, `startDate: Timestamp`, `paymentDay`, `paymentMethodId?`, `category`, `subcategory?`, `status` |
| `payment-methods`    | `PaymentMethod` | `name`, `type: credit \| debit \| cash`, `billingCycleDay?`, `isActive`, `isDefault?`, `createdAt`, `updatedAt` |
| `settings/preferences` | `UserPreferences` | `billingCycleDay: number`, `savingsRate: number`, `variableRate: number` |
| `savings-goals`      | `SavingsGoal` | `name`, `targetAmount: number`, `targetDate?`, `allocationType`, `allocationValue`, `status`, `balance: number`, `createdAt`, `updatedAt` |
| `savings-transactions` | `SavingsTransaction` | `goalId`, `type: contribution \| withdrawal`, `amount: number`, `date: YYYY-MM-DD`, `note?`, `createdAt` |
| `savings-planning/state` | Planning state document | `activePercentageTotal`, `createdAt`, `updatedAt` |

Expense, fixed-expense, income, subscription, installment and payment-method models
extend `Base` (`createdAt: Timestamp`, `updatedAt: Timestamp`, `uid?: string`).
`FixedExpense` is declared in `src/app/core/models/expense.ts`; `Subscription` is in
`src/app/core/models/subscriptions.ts`. Savings models are separate interfaces in
`src/app/core/models/savings-goal.ts`; a savings transaction has no `updatedAt`.

Preserve string amounts in the historical collections. Savings monetary amounts
are safe integer numbers in CLP; percentage allocations may have two decimal places.
`paymentMethodId` stores the payment-method document ID, not its display name.
Incomes are global per user and calendar month, without a payment method; older
incomes without `period` fall back to the month of `createdAt`.

### Security Rules summary (`firestore.rules`)
- Local rules require `isOwner(userId)`: authenticated and `request.auth.uid == userId`.
- This applies recursively to `users/{userId}` and all its subcollections, including payment methods and savings.
- There is no rule allowing the legacy top-level `expenses/{expenseId}` collection.
- Rules enforce ownership, but not schemas or savings business constraints. Those validations run in the client service; do not describe them as server-enforced.

### `ExpenseCategory` enum values
Current form options come from `EXPENSE_CATEGORY_OPTIONS` in `src/app/core/models/expense.ts`:
`Alimentación`, `Salidas`, `Transporte`, `Hogar`, `Servicios y cuentas`,
`Salud y cuidado`, `Compras personales`, `Educación`, `Viajes`, `Subscripciones`, `Otros`.
Most options have optional subcategories. Historical enum values (`Supermercado`,
`Casa`, `Cuentas`, `Entretenimiento`, `Ropa`, `Auto cuidado`, `Gasto Fijo`) remain
supported; do not remove or silently rewrite existing records.

## Conventions

### Modules & Components
- **NgModule-based application** — keep feature modules and explicitly declare application components with `standalone: false`. Library standalone directives may be imported by an NgModule.
- CRUD features generally declare `XComponent`, `AddXComponent`, `EditXComponent` in `XModule`; settings and savings have their own form components.
- Editing is done via **ng-bootstrap modals** (`NgbModal`), not routed pages.
- Subscription cleanup: always use `takeUntil(this.unsubscribe$)` + `Subject` destroyed in `ngOnDestroy`.
- Application components explicitly use `ChangeDetectionStrategy.Eager`, added by the Angular 22 migration to preserve their previous change detection behavior. Keep the separate `provideZoneChangeDetection()` bootstrap `applicationProviders` entry as well.
- `$safeNavigationMigration(...)` expressions in the fixed-expense and settings templates are compiler-supported output of Angular's migration; they preserve the previous optional-chain null semantics.

### Services
- Use `inject()` for DI (not constructor parameters).
- All services are `providedIn: 'root'`.
- Notifications use the local `NotificationsService` and a root `NgbToast` container.
  `success`/`error`/`info`/`warning` preserve the existing text-based API, top-right position
  and five-second default. Password-reset feedback retains `disableTimeOut: true` and
  `tapToDismiss: true`. Keep messages escaped as text. Angular 22 removed an API used by
  ngx-toastr 19; ngx-toastr 20 declares Angular 21 peers, so the migration reuses ng-bootstrap.
- CRUD pattern: `getAll()` → `Observable<T[]>` via `collectionData({ idField: 'uid' })`, `save()`, `update()`, `delete(id)`.
- Existing CRUD writes mostly build paths from `UserService.currentUserValue.uid`. Reactive reads may use `currentUser.pipe(switchMap(...))`; income and savings reads use Firebase `authState`. Preserve session switching and subscription cancellation; do not replace reactive reads with a cached UID.
- `InstallmentPurchasesService.getInstallmentsForCycle(start, end, paymentMethodId?, legacyPaymentMethodId?, referenceDate?, selection?)` retains completed purchases only for closed historical ranges (the range ends before the start of today), when an installment belongs to that range. Selection supports explicit `'billing-cycle'` attribution for credit Dashboard requests; calendar/default `'payment-date'` selection uses the actual scheduled charge date. Current/future ranges exclude purchases whose full schedule has already elapsed, calculated from `startDate`, effective `paymentDay` and `totalInstallments`, even if persisted `status` is stale. The last installment remains eligible on its scheduled day and becomes completed the next day, matching the purchases list. This filter feeds the Dashboard list, totals, category chart and period comparison; it does not record payment confirmation or require a data migration.
- `PaymentMethodsService` manages credit, debit and cash methods. Non-credit methods omit the billing day on creation; avoid sending `undefined` fields to Firestore.
- `SavingsGoalsService` uses Firestore transactions for goal planning and movements rather than the generic CRUD pattern.

### Forms
- Use `ReactiveFormsModule` with getter accessors for form controls.
- Custom cross-field validator lives in `@core/validators/custom.validators.ts` (`src/app/core/validators/custom.validators.ts`) (`CustomValidator.confirmPassword`).

### Styling
- **Bootstrap 5.3** + ng-bootstrap `^21`. Use logical spacing utilities (`ms`/`me`/`ps`/`pe`), `text-end`, `fw-bold`, `visually-hidden`, and `form-select`. Existing `.form-group` spacing and compact `.form-row` gutters are maintained locally in `_extend_bootstrap.scss`.
- Global SCSS structure: `src/assets/sass/_variables.scss` (brand palette, breakpoints), `_mixins.scss`, `_extend_bootstrap.scss`.
- Brand palette: primary `#876656`, secondary `#BD9988`; font: `Lato`.
- Import shared variables/mixins via `@use`/`@import` from `src/assets/sass/`.
- Consult the [design system](../.github/design-system/) for UI work; preserve mobile layouts, accessible focus states and the shared visual style of add/edit modals.

### Shared Module
`SharedModule` exports ng-bootstrap modal/pagination/popover/datepicker modules, `ReactiveFormsModule`, and `RangeDateSelectorComponent`. Import it into every feature module.
The Dashboard savings summary is exported separately by `SavingsSummaryModule`.

## Dashboard & Billing Periods

- The `Gastos` screen (the Spanish UI label for Expenses) provides a native payment-method filter: `Todos los métodos` (the Spanish UI label for “All methods”) includes every direct expense in its date range; individual methods match stored `paymentMethodId` values exactly; `Sin asignar` (“Unassigned”) exposes records with missing, null, or empty IDs without attributing them to a card. Inactive methods remain available for historical filtering. Search, category, total, sorting, and pagination combine with this client-side filter; no additional Firestore query or index is required. Selecting a method preserves the dates displayed in `Gastos` (default 19th–18th); adjust the range explicitly to compare it with a Dashboard card cycle or calendar month. The Dashboard's default-method fallback for unassigned legacy records remains separate.

- The Dashboard selects one payment method; there is no "all methods" view. The Expenses screen, fixed expenses, subscriptions, and installments use that selection. Legacy records without `paymentMethodId` fall back to the default method.
- The Dashboard uses the selected credit card's configured `billingCycleDay` as the inclusive start of its analysis window (preferences/default `19` are fallbacks). A day-19 window is **19 Sep–18 Oct 2026**: midnight on the 19th is included, and the next 19th is excluded. The end is one millisecond before the following month's start anchor. The current window changes on the start day itself. Credit selectors display the actual dates and the UI label `Ciclo de facturación` (“Billing cycle”); across years, both years are shown. Debit and cash retain calendar months. The internal reference date identifies the window's start month. Stored closing-day values remain unchanged. Services receive the displayed range consistently for direct expenses, fixed charges, installments, and comparisons. Credit installments use billing-cycle attribution: the installment closing on 19 Oct belongs to 19 Sep–18 Oct, using the previous monthly closing anchor as its attribution date. Calendar-month selection uses actual scheduled charge dates. Historical installment labels come from the selected cycle rather than today's upcoming installment.
- Monthly incomes and savings are global, independent of the selected card. `IncomesService.getForPeriod()` keeps using the reference calendar month (the cycle's start month for credit). The Dashboard income card explicitly names that month/year. Fixed-expense estimates use the cycle's closing calendar month instead, so a cycle ending in September resolves against September's occurrences. Fixed expenses and Incomes selectors explicitly identify their calendar-month scope.
- Daily spending and previous-period comparison have separate request streams. Selecting yesterday/today/a calendar day changes daily spending only. Comparison uses the Dashboard period and today's cutoff (clamped for shorter months); closed periods compare their complete ranges.
- `Seguimiento diario` (“Daily tracking”) appears before `Tus gastos por categoría` (“Your expenses by category”) and remains visible when the period has no expenses. The category overview can be shown or hidden from its header; it starts visible in each Dashboard instance. Hiding it preserves category exclusions, expanded details, and all totals, and does not change requests or calculations.
- Category exclusion changes the chart and exploratory total, without changing real expenses or the main financial totals. Category detail expansion is a separate action. Installment amounts belong to their recorded category/subcategory when available.
- For installments, derive the first scheduled charge from `startDate` and the selected credit card's closing day. The first closing is strictly after the purchase date: a purchase on the cycle's start/closing day belongs to the new cycle and first closes the following month. Clamp each monthly closing and attribution anchor independently to that month's last day (including days 29–31), so dates never overflow into another month. A purchase on 5 Oct with closing day 19 has installment 1 in 19 Sep–18 Oct; installment 2 belongs to 19 Oct–18 Nov. The upcoming installment is distinct from estimated past installments; remaining installments include the upcoming one. There is no manual payment confirmation tracking.

## Monthly Fixed Expenses

- `fixed-expenses` are recurring templates: their amount is a monthly estimate. A month-specific record in `fixed-expense-charges` preserves the actual amount, date and payment-method snapshot. Editing a template does not rewrite confirmed historical charges.
- The effective occurrence month is the actual `chargeDate` month for confirmed charges and `period` for skipped records. Only that month replaces its template estimate; a September charge with account period October leaves October pending. Resetting a monthly record makes its effective month pending again.
- New occurrences use deterministic `{fixedExpenseId}_{effective YYYY-MM}` IDs. Legacy IDs are preserved: if the preferred ID contains another month's charge, a stable `_actual` fallback is read/written transactionally. Repeated saves update the same target and preserve creation timestamps; incompatible collisions fail without overwriting history. Editing/resetting passes the actual document UID rather than reconstructing it from `period`.
- `period` remains the account's month metadata and may differ from `chargeDate`; it does not suppress another month's pending estimate. Saving a confirmed charge selects its actual date's month so the user sees the result. Existing documents are interpreted compatibly without moving documents or a remote migration.
- Confirmed charges count by `chargeDate` within the selected payment method's billing cycle. Pending estimates use the cycle's closing calendar month (the same month for debit/cash) and are explicitly identified as estimates. A confirmed charge for the selected method anywhere in the cycle replaces its template estimate, including charges in the cycle's starting month; it is never added alongside that same template's estimate. A confirmed or skipped record in the closing month also resolves that monthly occurrence. A confirmed record whose date is outside the cycle is not counted in that cycle, and does not recreate the template estimate for its occurrence month. Calendar-month fixed-expense records remain intact; changing this projection needs no migration or conversion of incomes/metas to card cycles.
- Monthly occurrence resolution is per recurring template and effective month, across payment methods: recording that month's charge on another card or omitting it also removes the old template's estimate. Only the snapshot's payment method receives the confirmed amount. Filtering occurrence resolution by the template's card would duplicate the same bill as an estimate on one card and a real charge on another.
- Daily spending includes only direct expense records for the selected date, excluding fixed charges, subscriptions and installments (including the daily record count). Period comparisons independently cut off direct expenses at today's equivalent date, but include confirmed fixed charges dated anywhere in each complete billing cycle, installments scheduled in each complete cycle, and the current monthly subscription commitment once in each period. Comparison requests carry separate cutoff and full-period ends; the displayed partial range describes direct expenses only. Pending fixed estimates are excluded. Subscriptions have neither a charge day nor monthly amount snapshots: their current amount is applied to both comparisons, not inferred from `createdAt` or presented as a confirmed payment. Historical subscription amounts cannot be reconstructed. A recorded charge or scheduled installment does not assert that a card bill was paid.
- Template deletion preserves monthly charge snapshots. Historical months without records remain estimates; this release does not infer past payments or backfill remote data.
- Writes use a transaction to preserve creation timestamps and avoid duplicate documents on retry. Amounts remain positive safe integer CLP serialized as strings. Reads follow authenticated user changes; existing owner-only recursive Firestore rules cover the new collection.

## Savings Goals

- `/metas` supports target amount/date, percentage or fixed monthly plans, and manual contributions/withdrawals. Plans are suggestions; they do not transfer money, create expenses or automatically change balances.
- `SavingsGoalsService` atomically updates balance and movement history using a stable request ID for retry protection. Withdrawals cannot exceed balance; contributions require an active goal. Transactions require a connection.
- Active percentage allocations are serialized through `savings-planning/state` and cannot exceed 100% in the client service. Fixed plans plus percentage suggestions may exceed monthly income; the UI warns about this.
- The Dashboard summary shows current balances, net contributions for the selected calendar month, and the current plan applied to that month's income. There are no historical plan snapshots or investment returns; do not deduct recorded savings again as expenses.

## Key Pitfalls

- **Legacy expense fallback differs from the Dashboard:** `ExpensesService.getAll()` without explicit dates still uses hardcoded **19th–18th**. The Dashboard passes explicit dates for the selected payment method; do not use the fallback to compute card periods.
- **`NoAuthGuard` is stale** — references `/empresas` (non-existent route) and `CanLoad` (deprecated). Don't use it.
- **`IsActiveGuard`** (email verification) is imported in `AppRoutingModule` but not wired to any route — email verification is not enforced at runtime.
- **`AuthGuard.CanMatch`** is capitalised incorrectly (should be `canMatch`) — the inline guard in `MainRoutingModule` is the one actually used.
- The same Firebase config is used for dev and prod; only `production` flag and `appUrl` differ (see `src/environments/`).
- `firebase-tools` is a development dependency; application code uses the modular Firebase SDK directly.
- Firestore offline persistence does not make savings transactions work offline. Validate remote-rule deployment separately from the local rules file.
