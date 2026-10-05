# Xpenses

This project was generated with [Angular CLI](https://github.com/angular/angular-cli) version 16.0.4.

## Development server

Run `ng serve` for a dev server. Navigate to `http://localhost:4200/`. The application will automatically reload if you change any of the source files.

## Code scaffolding

Run `ng generate component component-name` to generate a new component. You can also use `ng generate directive|pipe|service|class|guard|interface|enum|module`.

## Build

Run `ng build` to build the project. The build artifacts will be stored in the `dist/` directory.

## Historical payment-method migration procedure

The following procedure is retained as historical documentation. The current repository
does not contain the `migrate:payment-method` script or an npm entry for it, so these
commands are unavailable and must not be run unless the script is restored and reviewed.
The historical procedure was scoped to user `ogG7JDXZiVZuHLhv1LLSOyHsEGB3` and assigned
payment method `bmOSOVqmN79gZhUZX9Y2` to documents without a method in `expenses`,
`fixed-expenses`, `subscriptions`, and `installment-purchases`; it did not modify incomes or
overwrite existing assignments.

It previously required Firebase Admin application default credentials
(`gcloud auth application-default login`) or a service account specified by
`GOOGLE_APPLICATION_CREDENTIALS`. If restored, first review the implementation and use a
dry run:

```bash
npm run migrate:payment-method
```

The historical apply command was:

```bash
npm run migrate:payment-method -- --apply
```

## Automatic Firebase Hosting deployment

`.github/workflows/firebase-hosting-develop.yml` builds and deploys to the **live** channel of Hosting target `xpenses`, which points to site `xpenses-93552` in project `xpenses-93552`, whenever it receives a `push` to `develop`. `develop` deploys to the existing live site; the workflow does not create a site or preview channel. To activate it, save the workflow on the `develop` branch and configure the repository secret described below. Review changes and the target before merging or pushing commits to that branch.

Create a dedicated service account in Firebase project `xpenses-93552` and grant it `Firebase Hosting Admin` (`roles/firebasehosting.admin`) and `API Keys Viewer` (`roles/serviceusage.apiKeysViewer`), which are required to deploy Hosting with the Firebase CLI. It does not need Authentication permissions for this live workflow; `Cloud Run Viewer` only applies if rewrites to Cloud Run or Cloud Functions are added. The official [action guide](https://github.com/FirebaseExtended/action-hosting-deploy/blob/main/docs/service-account.md) describes these roles.

Generate a JSON key for that account and save it in GitHub under **Settings → Secrets and variables → Actions** as the repository secret `FIREBASE_SERVICE_ACCOUNT_XPENSES_93552`. Do not add the key to the repository or logs. Once the secret exists, each push to `develop` installs dependencies with `npm ci`, runs `npm run build`, and uses the official action to publish only target `xpenses` to `live`.

## Running unit tests

Run `ng test` to execute the unit tests via [Karma](https://karma-runner.github.io).

## Savings Goals — MVP

The `/metas` screen lets users create goals with a target amount, an optional date, and a monthly plan based on an income percentage or a fixed amount. The plan is a suggestion: the balance changes only when contributions or withdrawals are recorded manually. Recording a movement does not transfer money or create an expense.

- Incomes are global and use the current calendar month. Goals do not depend on the Dashboard payment method.
- Active goal percentages cannot exceed 100%. If fixed amounts plus percentages exceed income, the screen displays a warning; it does not guarantee that the remainder will cover expenses.
- Pausing, completing, or archiving a goal preserves its balance and history. This MVP does not support deleting movements.
- Projections assume the current plan is followed, with no interest or investment returns. They are not a guarantee.
- In the Dashboard, the balance is current and net contributions belong to the selected calendar month, not a card cycle. The current plan does not reconstruct historical plans.

Firestore stores new data under the authenticated user:

```text
users/{uid}/savings-goals/{goalId}
users/{uid}/savings-transactions/{requestId}
users/{uid}/savings-planning/state
```

New amounts are integer CLP values; existing collection formats are unchanged. The planning document serializes the percentage limit; Firestore transactions update the balance and history together and prevent the same submission from being recorded twice. Operations require a connection because transactions cannot be committed offline.

Current rules already restrict these paths to their owner. This MVP's limit and business validations run in the client service; general rules do not prevent the owner from changing their own records outside the app. No migration or changes to existing data are required.

## Running end-to-end tests

Run `ng e2e` to execute the end-to-end tests via a platform of your choice. To use this command, you need to first add a package that implements end-to-end testing capabilities.

## Further help

To get more help on the Angular CLI use `ng help` or go check out the [Angular CLI Overview and Command Reference](https://angular.io/cli) page.
