# Xpenses Agent Team

Configuration adapted from Long Dog Chaos on 2026-10-01 for Angular and Firebase.
Profiles live in `agents/*.toml` and are registered in [config.toml](config.toml).

## Team and models

| Profile | Responsibility | Model / effort |
| --- | --- | --- |
| [tech_lead](agents/tech_lead.toml) | Task planning, delegation, contracts, and integration | gpt-6.1-sol / medium |
| [product_designer](agents/product_designer.toml) | Flows, rules, and acceptance criteria | gpt-6-luna / high |
| [frontend_engineer](agents/frontend_engineer.toml) | Angular logic, forms, and calculations | gpt-6-luna / medium |
| [firebase_engineer](agents/firebase_engineer.toml) | Data, AngularFire, authentication, and rules | gpt-6-luna / medium |
| [ui_engineer](agents/ui_engineer.toml) | Presentation, responsive behavior, and accessibility | gpt-6-luna / medium |
| [qa_reviewer](agents/qa_reviewer.toml) | Independent, read-only review | gpt-6-luna / medium |

The default model is `gpt-6-luna` with `medium` effort; each profile sets its own override.
These values reflect the current TOML files in this repository. The game-development and
Blender-specific roles were adapted for Xpenses. Client permissions are inherited, except
for QA's read-only restriction. Global settings and MCP servers are not changed.

## Context and workflow

Read [shared instructions](../AGENTS.md), the [README](../README.md), the
[project technical guide](../docs/project-guidelines.md), and the
[architecture reference](../.github/.architecture.md). Compare documents with the
implementation because they may contain historical descriptions. Consult `.ai` if it is
added in the future.

`AGENTS.md` contains operational rules; `docs/project-guidelines.md` is the canonical source
for conventions, contracts, and business rules. Update that guide when behavior changes.
The former Copilot instructions were migrated into the technical guide and are no longer
present as a compatibility copy; Codex does not need to read them.

1. The Tech Lead defines the outcome, criteria, dependencies, and files for each task.
2. They delegate independent areas to suitable specialists.
3. Each file has one writer, and shared contracts are agreed before implementation.
4. Specialists deliver changes and evidence; QA reviews according to risk.
5. The Tech Lead integrates the work and updates existing documentation.

Delegation applies to development requests from the owner. Do not launch every agent by
default or create separate chats. Preserve unrelated local changes. Profiles do not authorize
commits, deployments, or data migrations. Development and production may share Firebase:
use emulators or synthetic data and check the target before testing writes.

## Usage

For example, in a new Xpenses session:

> Use tech_lead to develop this feature. Divide the work and delegate to frontend_engineer, firebase_engineer, or ui_engineer as appropriate.

> Delegate review of these changes to qa_reviewer; do not implement fixes.

Creating these files does not start agents. The session must load the profiles; if they are
unavailable, start a new project session and check the client configuration. These changes
do not alter the turn model of sessions that are already active.

## Validation

For code changes, use `npm run build` and tests appropriate to the task, based on
`package.json`. `npm test` is available (Angular/Karma); `npm run check` does not exist.
For configuration-only changes, validate TOML syntax, names, and profile paths. File
validation does not prove that agents loaded successfully or that models are available.

Format checked against [OpenAI Docs: subagents](https://learn.chatgpt.com/docs/agent-configuration/subagents).
