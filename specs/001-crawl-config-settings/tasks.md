# Tasks: Crawl Configuration Settings

**Input**: Design documents from `/specs/001-crawl-config-settings/`
**Prerequisites**: plan.md ✓, spec.md ✓, research.md ✓, data-model.md ✓, contracts/ ✓

**Tests**: Included — constitution mandates TDD with `[TEST]` tasks first in each phase.

**Organization**: Tasks grouped by user story for independent implementation and testing.

## Format: `[ID] [P?] [Story?] Description`

- **[P]**: Can run in parallel (different files, no incomplete dependencies)
- **[Story]**: Which user story this task belongs to ([US1], [US2], [US3])
- **[TEST]**: Write test first — confirm RED before writing implementation

---

## Phase 1: Setup (Jest Test Infrastructure)

**Purpose**: Install and configure the test runner. No test runner means no TDD — must complete before any [TEST] tasks.

- [x] T001 Add `jest`, `ts-jest`, and `@types/jest` to `devDependencies` in `package.json` and add `"test": "jest"` and `"test:watch": "jest --watch"` to `scripts`
- [x] T002 Create `jest.config.js` at repository root with `ts-jest` preset, `testEnvironment: "node"`, `testMatch: ["**/tests/**/*.test.ts"]`, and `moduleNameMapper` entries for `azure-devops-extension-sdk`, `azure-devops-extension-api`, and `axios`
- [x] T003 [P] Create `tests/__mocks__/azure-devops-extension-sdk.ts` exporting jest mock functions for `init`, `getAccessToken`, `getPageContext`, `getHost`, `notifyLoadSucceeded`, and `getExtensionContext`
- [x] T004 [P] Create `tests/__mocks__/azure-devops-extension-api.ts` exporting a jest mock for `CommonServiceIds.ExtensionDataService` and a factory for a mock `IExtensionDataManager` with `getValue` and `setValue` as `jest.fn()`
- [x] T005 [P] Create `tests/__mocks__/axios.ts` exporting `axios.get`, `axios.post`, `axios.delete` as `jest.fn()` returning resolved promises by default

**Checkpoint**: Run `npm test` — should report zero test suites found (no test files yet). Jest setup is confirmed working.

---

## Phase 2: Foundational (ExtensionSettings Extension)

**Purpose**: Extend settings persistence to include `clientId` and per-project crawl reviewer name. All user stories depend on these helpers.

**⚠️ CRITICAL**: No user story work can begin until this phase is complete.

### Tests for Foundational

> **Write these tests FIRST — confirm they FAIL before writing implementation**

- [x] T006 Write failing tests in `tests/extensionSettings.test.ts` covering: (a) `loadSettings` returns `clientId` from extension data; (b) `saveSettings` persists `clientId` via `setValue`; (c) `loadProjectCrawlReviewerName` returns stored string for project ID key; (d) `loadProjectCrawlReviewerName` returns empty string when key missing; (e) `saveProjectCrawlReviewerName` calls `setValue` with key `crawlReviewerDisplayName_{projectId}` and the provided name; (f) `saveProjectCrawlReviewerName` called with empty string clears the stored value

### Implementation for Foundational

- [x] T007 Extend `ExtensionSettings` interface in `src/common/extensionSettings.ts` to add `clientId: string`; update `KEYS` constant with `clientId: 'clientId'`; update `loadSettings()` to read `clientId` and `saveSettings()` to write it
- [x] T008 Add `loadProjectCrawlReviewerName(projectId: string): Promise<string>` function to `src/common/extensionSettings.ts` that reads `crawlReviewerDisplayName_{projectId}` from extension data (returns `''` if not found)
- [x] T009 Add `saveProjectCrawlReviewerName(projectId: string, name: string): Promise<void>` function to `src/common/extensionSettings.ts` that writes or clears `crawlReviewerDisplayName_{projectId}` in extension data

**Checkpoint**: Run `npm test` — `tests/extensionSettings.test.ts` tests should now pass (GREEN). Foundation ready.

---

## Phase 3: User Story 1 — Enable Automatic Crawling (Priority: P1) 🎯 MVP

**Goal**: Admin enters a reviewer display name and saves → crawl configuration is created on the backend for the current project. Duplicate creation is prevented (idempotent).

**Independent Test**: Open settings for a project with no existing crawl config, enter a valid reviewer display name, click Save — verify `POST /clients/{clientId}/crawl-configurations` was called with the correct org URL, project ID, and display name. Reload and verify no duplicate config is created on a second save.

### Tests for User Story 1

> **Write these tests FIRST — confirm they FAIL before writing implementation**

- [x] T010 [P] Write failing tests in `tests/crawlConfigClient.test.ts` covering `listCrawlConfigs`: (a) returns parsed `CrawlConfigResponse[]` on HTTP 200; (b) throws with message detail on HTTP 401; (c) throws with message detail on HTTP 403; and `createCrawlConfig`: (d) sends correct request body (`organizationUrl`, `projectId`, `reviewerDisplayName`, `crawlIntervalSeconds: 300`) with `X-Client-Key` header; (e) returns parsed `CrawlConfigResponse` on HTTP 201; (f) throws on HTTP 4xx with backend `ProblemDetails.detail` as error message
- [x] T011 [P] Write failing tests in `tests/settings-crawl.test.ts` covering the US1 save logic: (a) reviewer name non-empty + no matching config exists → `createCrawlConfig` is called once with correct args; (b) reviewer name non-empty + matching config already exists → `createCrawlConfig` is NOT called; (c) after successful create, `saveProjectCrawlReviewerName` is called with the display name; (d) `listCrawlConfigs` throws → error message is displayed, no create attempted

### Implementation for User Story 1

- [x] T012 [P] Create `src/api/crawlConfigClient.ts` with: `CrawlConfigResponse` interface, `CreateCrawlConfigRequest` interface, `DEFAULT_CRAWL_INTERVAL_SECONDS = 300` constant, and `listCrawlConfigs(backendUrl, clientKey, clientId): Promise<CrawlConfigResponse[]>` function using `axios.get` with `X-Client-Key` header and error extraction from `ProblemDetails`
- [x] T013 Add `createCrawlConfig(backendUrl, clientKey, clientId, request): Promise<CrawlConfigResponse>` to `src/api/crawlConfigClient.ts` using `axios.post` with `X-Client-Key` header and matching error extraction
- [x] T014 [P] Add Client ID input field (`<input type="text" id="client-id">`) to the form in `settings.html`; add Crawl Configuration section with heading, description paragraph, and reviewer display name input (`<input type="text" id="reviewer-display-name">`) below a `<hr class="section-divider">`
- [x] T015 Update `src/settings/settings.ts` init: read the `client-id` and `reviewer-display-name` DOM elements; populate `client-id` from `settings.clientId`
- [x] T016 Update `src/settings/settings.ts` save handler to include `clientId` from the `client-id` input in the `updated` settings object passed to `saveSettings`
- [x] T017 Implement US1 crawl config create logic in `src/settings/settings.ts` save handler: call `SDK.getPageContext()` and `SDK.getHost()` to get `projectId` and `orgUrl`; if `reviewerDisplayName` is non-empty and `clientId` is set, call `listCrawlConfigs`, check for a match on `organizationUrl` + `projectId`, and if no match call `createCrawlConfig` then `saveProjectCrawlReviewerName`
- [x] T018 [P] Add `.section-divider` (thin border `#eee`, margin top/bottom) and `.section-description` (color `#605e5c`, font-size `0.9em`) styles to `src/settings/settings.css`; add `h3` margin/weight styles matching ADO conventions

**Checkpoint**: All US1 tests GREEN. Manual test: settings page loads, client ID field present, reviewer name field present, saving with a valid name triggers the list+create flow. Save with same name a second time → no second create call.

---

## Phase 4: User Story 2 — Disable Automatic Crawling (Priority: P2)

**Goal**: Admin clears the reviewer display name and saves → the matching crawl configuration is deleted from the backend. If no config exists, save completes silently (no error).

**Independent Test**: With an existing crawl config for the project, clear the reviewer display name field, click Save — verify `DELETE /clients/{clientId}/crawl-configurations/{configId}` was called with the correct config ID. Verify that saving again (still empty) produces no error and no second delete call.

### Tests for User Story 2

> **Write these tests FIRST — confirm they FAIL before writing implementation**

- [x] T019 [P] Add failing tests to `tests/crawlConfigClient.test.ts` covering `deleteCrawlConfig`: (a) sends DELETE to correct URL with `X-Client-Key` header on HTTP 204; (b) treats HTTP 404 as success (idempotent); (c) throws on HTTP 401; (d) throws on HTTP 403
- [x] T020 [P] Add failing tests to `tests/settings-crawl.test.ts` covering the US2 save logic: (a) reviewer name empty + matching config exists → `deleteCrawlConfig` called with correct `configId`; (b) reviewer name empty + no matching config → `deleteCrawlConfig` NOT called; (c) after successful delete, `saveProjectCrawlReviewerName` called with empty string; (d) `deleteCrawlConfig` returns 404 → treated as success, no error shown

### Implementation for User Story 2

- [x] T021 Add `deleteCrawlConfig(backendUrl, clientKey, clientId, configId): Promise<void>` to `src/api/crawlConfigClient.ts` using `axios.delete` with `X-Client-Key` header; treat HTTP 404 response as success; extract and throw `ProblemDetails` detail for other errors
- [x] T022 Extend save logic in `src/settings/settings.ts` to handle empty reviewer display name: call `listCrawlConfigs`, find the matching config for current org + project, if found call `deleteCrawlConfig` with its `id`, then call `saveProjectCrawlReviewerName` with `''`; if no matching config found, complete silently

**Checkpoint**: All US2 tests GREEN. Manual test: with an existing config, clearing the name and saving removes the config. Saving again (still empty) produces no error.

---

## Phase 5: User Story 3 — View Current Crawl Configuration State (Priority: P3)

**Goal**: When the settings page loads, the reviewer display name field is pre-populated if a config was previously saved. If prerequisites (backendUrl/clientKey/clientId) are missing, the crawl section is disabled with a hint.

**Independent Test**: Save a reviewer name for a project, reload the settings page — the reviewer display name field is pre-populated. Clear backendUrl and reload — the reviewer display name field is disabled.

### Tests for User Story 3

> **Write these tests FIRST — confirm they FAIL before writing implementation**

- [x] T023 [P] Add failing tests to `tests/settings-crawl.test.ts` covering the US3 load logic: (a) stored display name for current project → reviewer display name input is pre-populated; (b) no stored name → reviewer display name input remains empty; (c) backendUrl, clientKey, or clientId missing → reviewer display name input has `disabled` attribute and a warning hint is visible

### Implementation for User Story 3

- [x] T024 Update `src/settings/settings.ts` init to call `loadProjectCrawlReviewerName(projectId)` after the page context is acquired and populate the `reviewer-display-name` input with the result
- [x] T025 Add prerequisite guard in `src/settings/settings.ts` init: if `settings.backendUrl`, `settings.clientKey`, or `settings.clientId` are empty/missing, set the `reviewer-display-name` input to `disabled` and display a hint element reading "Configure Backend URL, Client Key, and Client ID first"

**Checkpoint**: All US3 tests GREEN. All user stories functional and independently verifiable.

---

## Phase 6: Polish & Cross-Cutting Concerns

**Purpose**: Build integrity verification and final checks.

- [x] T026 [P] Run `npx tsc --noEmit` and resolve any TypeScript type errors introduced by the new `clientId` field, new interfaces in `crawlConfigClient.ts`, and updated `extensionSettings.ts` signatures
- [x] T027 [P] Run `npm run build` and confirm the production webpack bundle compiles cleanly with no errors
- [x] T028 Run `npm test` and confirm all test suites pass (extensionSettings.test.ts, crawlConfigClient.test.ts, settings-crawl.test.ts)

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies — start immediately
- **Foundational (Phase 2)**: Depends on Phase 1 completion — BLOCKS all user stories
- **User Stories (Phase 3, 4, 5)**: All depend on Foundational phase completion
  - US1 (Phase 3): No dependency on US2 or US3
  - US2 (Phase 4): Depends on Phase 3 (shares `crawlConfigClient.ts` and save logic); adds delete path
  - US3 (Phase 5): Depends on Phase 3 (load path extends Phase 3 init code)
- **Polish (Phase 6)**: Depends on all desired user stories being complete

### User Story Dependencies

- **US1 (P1)**: Can start after Foundational — no dependency on US2 or US3
- **US2 (P2)**: Shares `crawlConfigClient.ts` and settings.ts — implement after US1 to avoid merge conflicts
- **US3 (P3)**: Extends the settings.ts init function started in US1 — implement after US1

### Within Each Phase

- `[TEST]` tasks MUST be written first and confirmed FAILING before any implementation task in that phase begins
- Implementation tasks within a story follow: interfaces → API client functions → HTML → TypeScript logic → CSS
- Same-file tasks are sequential; different-file tasks marked `[P]` may run in parallel

### Parallel Opportunities

- T003, T004, T005 (mock files) — fully parallel
- T010, T011 (US1 test files) — fully parallel (different files)
- T012, T014, T018 (crawlConfigClient.ts, settings.html, settings.css) — parallel with each other; T012 must complete before T013
- T019, T020 (US2 test files) — fully parallel
- T026, T027 (build checks) — fully parallel

---

## Parallel Example: User Story 1

```bash
# After T009 (Foundational complete), launch in parallel:
Task T010: Write failing tests for listCrawlConfigs and createCrawlConfig in tests/crawlConfigClient.test.ts
Task T011: Write failing tests for US1 save logic in tests/settings-crawl.test.ts

# After T011 confirmed RED, launch in parallel:
Task T012: Create crawlConfigClient.ts with listCrawlConfigs in src/api/crawlConfigClient.ts
Task T014: Add Client ID and reviewer display name fields to settings.html
Task T018: Add section-divider and section-description styles to src/settings/settings.css

# Sequential after T012:
Task T013: Add createCrawlConfig to src/api/crawlConfigClient.ts

# Sequential after T013, T014:
Task T015: Populate clientId input on load in src/settings/settings.ts
Task T016: Save clientId from form in src/settings/settings.ts
Task T017: Implement create logic in src/settings/settings.ts
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 1: Setup (Jest infrastructure)
2. Complete Phase 2: Foundational (ExtensionSettings extension)
3. Complete Phase 3: User Story 1 (enable crawling)
4. **STOP and VALIDATE**: settings page shows clientId + reviewer name fields, save creates crawl config
5. Ship or demo — administrators can now enable auto-crawling per project

### Incremental Delivery

1. Complete Setup + Foundational → foundation ready
2. Add US1 (create) → independently testable → MVP
3. Add US2 (delete) → admins can disable crawling → V1 complete
4. Add US3 (pre-populate) → improved UX → V1.1

### Parallel Team Strategy

With two developers after Foundational is complete:
- Developer A: US1 (create path — `listCrawlConfigs`, `createCrawlConfig`, settings.ts create logic)
- Developer B: US2 (delete path — `deleteCrawlConfig`, settings.ts delete logic)

Stories touch overlapping files (`settings.ts`, `crawlConfigClient.ts`); coordinate on merge order.

---

## Notes

- `[P]` tasks = different files with no incomplete upstream dependencies — safe to run in parallel
- `[TEST]` tasks MUST be confirmed FAILING (RED) before any implementation in that story begins
- Each user story phase is independently completable and testable
- Commit after each checkpoint (T009, T018, T022, T025, T028)
- Avoid running Polish phase tasks (T026–T028) until all desired user stories are complete
