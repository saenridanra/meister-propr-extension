# Research: Crawl Configuration Settings

**Branch**: `001-crawl-config-settings`
**Date**: 2026-03-09
**Status**: Complete — all unknowns resolved

---

## Decision 1: ClientId Resolution

**Unknown**: The backend crawl configuration endpoints (`GET/POST /clients/{clientId}/crawl-configurations`, `DELETE /clients/{clientId}/crawl-configurations/{configId}`) require a `clientId` UUID in the URL path. The extension currently only stores `clientKey`. No "resolve self" endpoint (e.g. `/clients/me`) exists in the OpenAPI spec.

**Decision**: Add `clientId` (UUID string) to `ExtensionSettings`. The administrator who registers a client with the backend receives both a `clientId` and a `clientKey`. Both are stored in the extension settings hub alongside `backendUrl`.

**Rationale**: This is the simplest approach with no backend changes required. It follows the existing settings pattern. The `clientId` is non-sensitive (it is a public identifier, unlike `clientKey`) and safe to store in extension data.

**Alternatives considered**:
- *Backend endpoint `/clients/me`*: Would be cleaner but requires coordinated backend change outside this feature's scope.
- *Derive clientId from a review job response*: Review job responses do not include `clientId`.
- *Admin-only `GET /clients` scan*: Requires `X-Admin-Key`, which the extension must never hold.

---

## Decision 2: Reviewer Display Name Pre-Population on Settings Load

**Unknown**: `CrawlConfigResponse` returns `reviewerId` (a VSS identity UUID), not the original `reviewerDisplayName` string. No reverse-lookup endpoint (UUID → display name) exists in the API. The spec requires the reviewer display name to be pre-populated when the settings page loads.

**Decision**: Store the reviewer display name in extension data service using a project-scoped key (`crawlReviewerDisplayName_{projectId}`). On load, display the stored value. When a crawl config is created or deleted, update the stored value accordingly.

**Rationale**: Avoids any need for a reverse-lookup endpoint. Consistent with how the extension manages all settings — via `IExtensionDataService`. The stored value stays in sync because only the extension UI modifies it (for this org+project scope).

**Alternatives considered**:
- *Display reviewer UUID instead of name*: Not user-friendly.
- *Backend reverse-lookup API*: Does not exist; would require backend changes.
- *Always show blank, require re-entry on each save*: Breaks the P3 user story (view current state) and degrades UX.

**Accepted limitation**: If the crawl configuration is modified directly via the backend API (e.g. by an admin tool), the stored display name may become stale. This is acceptable for V1.

---

## Decision 3: Project Context Acquisition

**Unknown**: How does the project-scoped settings page know the current organisation URL and project ID?

**Decision**: Use `SDK.getPageContext().webContext.project.id` for project ID, and construct the org URL as `https://dev.azure.com/${SDK.getHost().name}/`. This is the exact same pattern used in `src/review/review.ts`.

**Rationale**: Established pattern in the codebase. Works reliably in the project-admin hub context. No alternative needed.

---

## Decision 4: Default crawlIntervalSeconds

**Unknown**: The `CreateCrawlConfigRequest` requires a `crawlIntervalSeconds` value. The feature spec does not expose this to the user.

**Decision**: Use a hardcoded default of `300` (5 minutes). This value is baked into the client code as a named constant `DEFAULT_CRAWL_INTERVAL_SECONDS = 300`.

**Rationale**: 5-minute polling is a reasonable default for PR discovery. Not exposing it to the user keeps the settings page focused and reduces cognitive load. Can be made configurable in a future iteration.

**Alternatives considered**:
- *60 seconds*: Too aggressive for a production backend.
- *3600 seconds*: Too slow for timely PR reviews.

---

## Decision 5: Test Framework Setup

**Unknown**: No test infrastructure exists in the repository. The constitution mandates TDD with tests covering settings persistence via mocked `IExtensionDataService`.

**Decision**: Add Jest with `ts-jest` as the test runner. Tests live in a `tests/` directory at the repository root. The constitution mandates this test coverage:
- Settings persistence via mocked `IExtensionDataService`
- Crawl config list/create/delete logic (mocked API calls)
- UI state transitions (save button enabled/disabled, status messages)
- Error handling paths (network failure, 401, 403, 404 responses)

**Rationale**: Jest + ts-jest is the standard TypeScript testing stack. It integrates cleanly with the existing `ts-loader`/`tsconfig.json` setup. No browser environment needed for unit tests — all ADO SDK interactions are mocked.

**Alternatives considered**:
- *Vitest*: Not standard for Azure DevOps extension projects; no meaningful advantage here.
- *No tests (defer)*: Constitution violation — non-negotiable.

---

## Decision 6: Extension Settings Storage Scope

**Unknown**: How to scope the reviewer display name per project in `IExtensionDataService`.

**Decision**: Use `Default` scope (organisation-wide) with a key that includes the project ID: `crawlReviewerDisplayName_{projectId}`. This avoids the complexity of document-based storage while achieving effective per-project isolation.

**Rationale**: The existing `backendUrl` and `clientKey` use `Default` scope. Adding a per-project key with the same scope is the simplest extension of the existing pattern. There is no need for true project-scoped ADO storage for this use case.

**Alternatives considered**:
- *ADO document storage with project scope*: More correct semantically but adds unnecessary API complexity.
- *Store all project configs as a JSON object under a single key*: Race conditions on concurrent saves; harder to manage.
