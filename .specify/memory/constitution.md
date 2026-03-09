# Meister ProPR Extension Constitution

## Core Principles

### I. API-Contract-First

`api/openapi.json` is the single source of truth for the HTTP contract
between the extension and the backend; the typed TypeScript client under
`src/generated/` MUST be regenerated via `npm run generate:api` whenever the
backend OpenAPI spec changes — hand-written HTTP calls against the backend are
prohibited; breaking contract changes (removed fields, changed types, renamed
paths) require a coordinated version bump in the backend repository and a
matching client regeneration in this repository; the extension MUST NOT make
assumptions about backend behaviour beyond what the OpenAPI spec defines.

### II. Test-First (NON-NEGOTIABLE)

TDD is mandatory — no implementation begins before failing tests are written and
reviewed; Red → Green → Refactor is strictly enforced through the speckit
workflow: `[TEST]` tasks appear first in `tasks.md`, are confirmed failing before
implementation begins, implementation drives them green, then a refactor pass
cleans up without changing behaviour; tests MUST cover: settings persistence via
mocked `IExtensionDataService`, polling logic with simulated status transitions,
error handling paths (network failure, `401`, `failed` job status), and UI state
transitions; a feature is not done until all tests pass in CI — PRs with failing
tests MUST NOT be merged.

### III. No Secrets in the Extension

Foundry credentials (endpoint, API key) MUST NEVER be stored in ADO extension
data storage, transmitted by the browser, or accepted as extension configuration;
the extension stores only two values: `backendUrl` and `clientKey`, written and
read exclusively via `IExtensionDataService`; the ADO token obtained from
`SDK.getAccessToken()` is forwarded to the backend in the `X-Ado-Token` header
and MUST NOT be persisted, logged to the console, or stored in any browser
storage; `clientKey` MUST NOT appear in any URL query parameter — headers only;
any PR or change that introduces secret handling outside these boundaries is a
constitution violation and MUST be rejected.

### IV. ADO SDK as the Only Integration Layer

All Azure DevOps interactions MUST go through the official SDKs:
`azure-devops-extension-sdk` for lifecycle (`SDK.init`, `SDK.getAccessToken`,
`SDK.notifyLoadSucceeded`, `SDK.getPageContext`, `SDK.getHost`) and
`azure-devops-extension-api` for REST clients (`GitRestClient`,
`IExtensionDataService`); direct `fetch`/`axios` calls to Azure DevOps REST
endpoints are prohibited — use the typed SDK clients; the extension MUST call
`SDK.notifyLoadSucceeded()` exactly once per panel when the UI is ready,
including on early-exit paths (e.g. missing configuration); failing to notify
load success causes a blank extension frame in ADO.

### V. Polling Over WebSockets

The extension communicates with the backend exclusively via polling — no
WebSocket, SSE, or long-poll connections; polling interval for job status is
3 seconds with a 5-minute timeout after which the UI MUST surface a timeout
error to the user; the jobs overview table refreshes every 5 seconds
independently; polling MUST be cancelled or allowed to expire naturally when the
panel is unloaded — no runaway `setInterval` calls; idempotent `GET` requests
MUST be used for polling; only `POST /reviews` changes state.

### VI. Simplicity and Browser Constraints

The extension runs in a sandboxed browser iframe inside Azure DevOps; no Node.js
APIs, no filesystem access, no native modules; UI is plain TypeScript + DOM — no
React, Vue, or other UI framework is introduced unless justified in the plan's
Complexity Tracking table; vanilla DOM manipulation is preferred for the current
scope; CSS follows ADO visual conventions (colours, spacing, typography) to
maintain a native feel; complexity beyond what the current feature requires MUST
be justified — YAGNI applies strictly.

### VII. Build Integrity

Every merged change MUST produce a clean `npm run build` with zero TypeScript
errors (`npx tsc --noEmit`); the webpack bundle MUST NOT include source maps in
production builds; `npm run generate:api` MUST be re-run and the generated files
committed whenever `api/openapi.json` changes; packaging (`npm run
package`) produces a `.vsix` artefact — the generated `.vsix` MUST NOT be
committed to source control; `vss-extension.json` version MUST be incremented on
every publishable release.

## Technology Stack & Constraints

**Language**: TypeScript (strict mode) | **Bundler**: Webpack |
**ADO SDK**: `azure-devops-extension-sdk`, `azure-devops-extension-api` |
**HTTP client**: `axios` (backend calls only; ADO calls via SDK clients) |
**API client generation**: `openapi-typescript-codegen` from
`../backend/openapi.json` → `src/generated/` |
**Settings storage**: `IExtensionDataService` (ADO extension data) |
**Packaging**: `tfx-cli` → `.vsix` |
**CI**: `npm run build` + `npx tsc --noEmit` must be clean before merge |
**No secrets**: `backendUrl` + `clientKey` only — Foundry credentials live
exclusively in the backend deployment.

## Development Workflow

The speckit command sequence is the mandatory development loop for every feature:
`/speckit.specify` → `/speckit.clarify` → `/speckit.plan` → `/speckit.tasks` →
`/speckit.implement`; `tasks.md` always leads with `[TEST]` tasks confirmed
failing before implementation begins; implementation proceeds task by task until
all tests are green; a refactor pass follows each green cycle without changing
behaviour.

Build commands: `npm run build` (production), `npm run build:dev` (development
with watch), `npm run generate:api` (regenerate typed client), `npm run package`
(produce `.vsix`), `npx tsc --noEmit` (type-check only).

Always read `Requirements.md` before implementing features or making
architectural decisions. Always read `CLAUDE.md` at the start of every session.

## Governance

This constitution supersedes all other practices; amendments require a written
rationale, an incremented version, an updated `Last Amended` date, and a
propagation pass across all `.specify/templates/` files and `CLAUDE.md`; version
policy: MAJOR for removed or redefined principles, MINOR for new principles or
materially expanded guidance, PATCH for clarifications and wording; every PR
description MUST include a Constitution Check section confirming the seven
principles are satisfied or explicitly justifying any deviation; complexity beyond
what the architecture prescribes MUST be justified in the plan's Complexity
Tracking table; for runtime development guidance refer to `CLAUDE.md` at the
repository root.

**Version**: 1.0.0 | **Ratified**: 2026-03-09 | **Last Amended**: 2026-03-09
