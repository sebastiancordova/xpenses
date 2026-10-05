# Xpenses

Personal finance PWA built with Angular 16, TypeScript, RxJS, AngularFire, and Firebase.

## Project context

- At the start, read [README.md](README.md), the [technical guide](docs/project-guidelines.md),
  the [architecture reference](.github/.architecture.md), and the [agent team guide](.codex/README.md).
- This file contains operational rules. The technical guide is the canonical source for
  conventions, contracts, business rules, and pitfalls. Keep it updated when those change.
- Compare documents with the code, installed versions, and local changes. Documentation
  may describe an earlier state; do not present historical TODOs as confirmed defects.
- Consult `.ai` if it exists and maintain continuity documentation when a delivery changes
  behavior or architecture. Assign one writer to each shared document.

## Coordination and agents

- For non-trivial development, the root agent creates a real `tech_lead` profile instance.
  Assuming the role is not enough. Pass the objective and constraints, wait for its work,
  and report the result without duplicating its research or implementation during ownership.
- `tech_lead` defines scope, decisions, dependencies, contracts, acceptance criteria, and the
  plan; it coordinates specialists directly, reviews their work, resolves integration, and
  validates completion.
- New features, non-trivial bugs, refactors, and significant Firebase, persistence, UI,
  architecture, or multi-file/module changes go through `tech_lead`.
- The root agent may handle read-only questions, explanations, simple inspections, and very
  small mechanical changes; follow another workflow when the owner requests one.
- The owner authorizes delegation to profiles in `.codex/agents/*.toml` during development.
  If two or more areas are independent, delegate at least one to a suitable specialist.
  Handle small tasks directly and select agents by need; do not launch every agent.
- Profiles: `tech_lead`, `product_designer`, `frontend_engineer`, `firebase_engineer`,
  `ui_engineer`, and `qa_reviewer`. Read their instructions before assigning work.
- Use configured profiles instead of generic agents when an appropriate specialist exists.
  Hierarchy: root → `tech_lead` → required specialists. Specialists do not create further
  hierarchies except for an explicitly justified exceptional need.
- Each assignment must state its objective, permitted files, exclusions, contracts, criteria,
  and validations. Give each file a single writer; agree on shared models, services, and events
  before parallel work in related areas.
- Specialists deliver results and evidence to the coordinator. The coordinator waits, reviews,
  and integrates their work. Avoid recursive delegation and duplicate coordinators.
- QA reviews read-only: it reports findings and does not implement fixes.
- Profile files define agents; they do not start processes. Creating separate chats or
  messaging other chats requires the owner's specific authorization.
- Models and effort are set in [.codex/config.toml](.codex/config.toml) and the profiles. If
  the tool does not load profiles, pass their instructions and values when supported; do not
  claim a model was applied without evidence. Do not increase cost on your own initiative.

## Development

- Preserve existing local changes and other agents' work. Check Git status before editing;
  do not overwrite, discard, or reformat unrelated files.
- Follow current conventions: NgModules, reactive forms, existing aliases, AngularFire/RxJS
  services, and SCSS tokens. Consult `.github/design-system` for UI work.
- Code and identifiers are in English; communication and user-facing app text are in Spanish.
- Agree on schema or persisted-type changes; preserve compatibility with existing documents
  and precision for amounts, dates, installments, and billing periods.
- Clean up subscriptions and handle loading, errors, submission, and destructive-action
  confirmation. Review keyboard use, focus, contrast, and small screens when changing UI.
- Resolve reversible technical details within the task. Stack, dependency, and scope changes
  must address a concrete need and be explained to the owner.

## Firebase and data

- Check the target and environment before testing writes: development and production may share
  Firebase. Use emulators or synthetic data for local validation.
- Check user isolation under `users/{uid}` and Firestore rules where applicable; evaluate
  authentication and authorization separately.
- Local implementation does not authorize migration, deletion, or modification of real remote
  data. Prepare a simulation and exact scope before an authorized migration.
- Do not expose credentials or personal data in code, logs, screenshots, or documentation.
- Make commits, push, merge, or deploy only when the owner requests it.

## Verification and delivery

- For code changes, run `npm run build` and risk-appropriate tests using existing scripts.
  `npm test` uses Angular/Karma; `npm run check` does not currently exist.
- For documentation- or configuration-only changes, validate relevant links, TOML, and paths.
- Distinguish compilation, functional tests, and visual review. Record what was observed;
  viewport emulation is not equivalent to validation on a physical phone.
- Report the result, files, checks performed, and concrete outstanding items.
