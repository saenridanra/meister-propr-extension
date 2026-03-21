# Tasks: Reviewer Identity Selection in Extension Settings

**Input**: Design documents from `/specs/002-extension-reviewer-identity/`
**Prerequisites**: plan.md ✅, spec.md ✅, research.md ✅, data-model.md ✅, contracts/ ✅, quickstart.md ✅

**TDD**: Tests are mandatory per the project constitution (Principle II). `[TEST]` tasks MUST be written and confirmed failing before their paired implementation tasks begin.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (US1/US2/US3)

---

## Phase 1: Backend Gate (Blocking — Do Not Proceed Until Complete)

**Purpose**: Ensure the backend contract is finalised and the generated client reflects the new endpoints before any extension code is written.

**⛔ HARD BLOCK**: No extension code is written until this phase is fully complete. All subsequent phases depend on the generated client produced here.

- [x] T001 Confirm backend feature `010-client-reviewer-identity` is merged to the backend main branch
- [x] T002 Sync `api/openapi.json` from the backend: `cp ../meister-propr/meister-propr/openapi.json api/openapi.json`
- [x] T003 Regenerate the typed client: `npm run generate:api` — verify it completes without errors
- [x] T004 Confirm `src/generated/services/ClientsService.ts` now contains a `getClientsProfile` method (or equivalent generated name for `GET /clients/{clientId}/profile`)
- [x] T005 Run `npm run build:dev` and `npx tsc --noEmit` — both must be clean before proceeding

**Checkpoint**: Generated client is up to date, build is clean, `GET /clients/{clientId}/profile` is available in `src/generated/`. Only then proceed to Phase 2.

---

## Phase 2: Setup

**Purpose**: Remove stale code, establish a clean baseline, and extend the testbed so the reviewer identity UI can be exercised locally throughout development.

- [x] T006 Remove `tests/settings-crawl.test.ts` — imports `loadProjectCrawlReviewerName` / `saveProjectCrawlReviewerName` which were removed from `extensionSettings.ts`; the test file no longer compiles and its coverage is superseded by `tests/settings-reviewer-identity.test.ts`
- [x] T007 [P] Extend `testbed/backend.ts` with stub implementations of the three new endpoints, all authenticated via the existing `CLIENT_KEY` check:
  - `GET /identities/resolve?orgUrl=...&displayName=...` → returns a hardcoded array of 1–3 `{ id, displayName }` objects whose `displayName` contains the query string (case-insensitive substring match against a fixed list), or `404` when nothing matches
  - `GET /clients/{clientId}/profile` → returns `{ id: clientId, displayName: "Testbed Client", isActive: true, createdAt: "...", reviewerId: storedReviewerId | null }` where `storedReviewerId` is the last value written by the PUT
  - `PUT /clients/{clientId}/reviewer-identity` → validates `reviewerId` is a non-empty string, stores it in a module-level `Map<string, string>`, returns `204`; also update `setCorsHeaders` to include `PUT` in `Access-Control-Allow-Methods`

**Checkpoint**: `npm run testbed:build && npm run testbed:backend` starts cleanly; opening `http://localhost:3000/settings` loads the settings page; identity search, pre-population, and save all work end-to-end against the local testbed.

---

## Phase 3: Foundational (Blocking Prerequisites)

**Purpose**: Core infrastructure that MUST be complete before any user story work begins. Both additions are independent of each other and can be built in parallel.

**⚠️ CRITICAL**: No user story work can begin until this phase is complete.

### Extension Settings — reviewerDisplayName key

- [x] T008 [TEST] Write failing tests for `reviewerDisplayName` key in `tests/extensionSettings.test.ts`: add cases that call `loadReviewerDisplayName()` (expect `''` when key absent) and `saveReviewerDisplayName('Meister Bot')` (expect `dm.setValue` called with key `'reviewerDisplayName'` and value `'Meister Bot'` at `Default` scope)
- [x] T009 Add `reviewerDisplayName` key to the `KEYS` map, and export `loadReviewerDisplayName(): Promise<string>` and `saveReviewerDisplayName(name: string): Promise<void>` helpers in `src/common/extensionSettings.ts` — drive T008 green

### Reviewer Identity API Client

- [x] T010 [P] [TEST] Write failing tests for `src/api/reviewerIdentityClient.ts` in `tests/reviewerIdentityClient.test.ts`: mock `ClientsService`; test `getClientProfile(backendUrl, clientKey, clientId)` calls the generated `getClientsProfile(clientId)` method and returns the result; test `setReviewerIdentity(backendUrl, clientKey, clientId, 'guid-123')` calls `ClientsService.putClientsReviewerIdentity(clientId, { reviewerId: 'guid-123' })`
- [x] T011 [P] Create `src/api/reviewerIdentityClient.ts` exporting `getClientProfile(backendUrl, clientKey, clientId)` (wraps the generated `GET /clients/{clientId}/profile` method) and `setReviewerIdentity(backendUrl, clientKey, clientId, reviewerId: string)` (wraps `ClientsService.putClientsReviewerIdentity`) — drive T010 green

### Autocomplete CSS

- [x] T012 [P] Add autocomplete dropdown styles to `src/settings/settings.css`: `.autocomplete-wrapper` (position: relative), `.autocomplete-dropdown` (position: absolute, z-index, border, background, max-height with overflow-y: auto), `.autocomplete-item` (padding, cursor: pointer), `.autocomplete-item:hover` / `.autocomplete-item--focused` (highlight colour matching ADO blue `#0078d4`), `.autocomplete-item--no-results` (italic, muted colour `#605e5c`)

### Resolve Identity — add missing test

- [x] T013 [P] Add `resolveIdentity` test to `tests/crawlConfigClient.test.ts`: mock `IdentitiesService.getIdentitiesResolve`; verify it is called with `(orgUrl, displayName)` and that the result is returned unchanged

**Checkpoint**: `npm run test` passes. `npx tsc --noEmit` clean.

---

## Phase 4: User Story 1 — Search and Select a Reviewer Identity (Priority: P1) 🎯 MVP

**Goal**: User types in a search field, sees matching identities in a dropdown, selects one, saves — GUID is sent to the backend and display name is persisted locally. Pre-populated on next load.

**Independent Test**: Open the settings page with valid backend credentials. Type a partial display name (≥ 2 chars). Confirm a dropdown appears. Select an item. Click Save. Verify the backend client record shows the new `reviewerId` and the field is pre-populated on next page load.

- [x] T014 [TEST] [US1] Write failing tests in `tests/settings-reviewer-identity.test.ts` for the search and select + save flow: mock `resolveIdentity`, `setReviewerIdentity`, `saveReviewerDisplayName`, `loadReviewerDisplayName`, `loadSettings`; test (a) `resolveIdentity` is called after user input of ≥ 2 chars; (b) a selected identity's GUID is passed to `setReviewerIdentity` on save; (c) display name is passed to `saveReviewerDisplayName` on save; (d) `loadReviewerDisplayName` result is used to pre-populate the field value on load; (e) the reviewer identity section is disabled when `clientId` is empty; (f) save is a no-op for reviewer identity when `selectedReviewerId` is null
- [x] T015 [US1] Add Reviewer Identity section to `settings.html` below the Crawl Configuration section: `<hr class="section-divider">`, `<h3>Reviewer Identity</h3>`, description paragraph, `<div class="autocomplete-wrapper">` containing `<input type="text" id="reviewer-search" autocomplete="off" spellcheck="false" aria-autocomplete="list" aria-controls="reviewer-dropdown" aria-expanded="false">` and `<ul id="reviewer-dropdown" class="autocomplete-dropdown" role="listbox" hidden></ul>`, and `<div id="reviewer-hint" class="input-hint"></div>`
- [x] T016 [US1] In `src/settings/settings.ts`: add element references (`reviewerSearchInput`, `reviewerDropdown`, `reviewerHint`); declare module-level `let selectedReviewerId: string | null = null` and `let debounceTimer: ReturnType<typeof setTimeout> | undefined`
- [x] T017 [US1] In `src/settings/settings.ts`: implement `openDropdown()` / `closeDropdown()` helpers that toggle `reviewerDropdown.hidden` and `reviewerSearchInput.setAttribute('aria-expanded', ...)`. Attach `reviewerSearchInput.addEventListener('blur', () => setTimeout(closeDropdown, 150))` and `reviewerDropdown.addEventListener('mousedown', e => e.preventDefault())` to prevent blur racing the click
- [x] T018 [US1] In `src/settings/settings.ts`: attach `input` event to `reviewerSearchInput`; clear `selectedReviewerId` on any input; debounce 300 ms; if value.trim().length < 2 call `closeDropdown()` and return; otherwise call `resolveIdentity(backendUrl, clientKey, orgUrl, value)` and populate `reviewerDropdown` with `<li role="option" data-id="{id}">{displayName}</li>` items (or a `<li class="autocomplete-item--no-results">No results found</li>` when array is empty), then call `openDropdown()`
- [x] T019 [US1] In `src/settings/settings.ts`: attach `click` delegated listener on `reviewerDropdown`; when a `<li[data-id]>` is clicked set `selectedReviewerId = item.dataset.id`, `reviewerSearchInput.value = item.textContent`, `closeDropdown()`
- [x] T020 [US1] In `src/settings/settings.ts`: on page load call `loadReviewerDisplayName()` and set `reviewerSearchInput.value` to the result (non-empty string only)
- [x] T021 [US1] In `src/settings/settings.ts`: extend the save handler — after saving core settings, if `selectedReviewerId !== null` call `setReviewerIdentity(backendUrl, clientKey, clientId, selectedReviewerId)` then `saveReviewerDisplayName(reviewerSearchInput.value.trim())`; if `selectedReviewerId` is null skip the identity update entirely; extend the prerequisite guard to also disable `reviewerSearchInput` when core credentials are missing

**Checkpoint**: Search field appears, dropdown populates, selection captured, save calls backend and persists display name, field pre-populated on reload.

---

## Phase 5: User Story 2 — No Results Feedback (Priority: P2)

**Goal**: When the search returns no matching identities, the user sees a clear "No results found" message in the dropdown rather than an empty or invisible list.

**Independent Test**: Type a display name that matches nothing in the org. Verify the dropdown opens and shows "No results found" as a non-selectable item.

- [x] T022 [TEST] [US2] Add failing tests to `tests/settings-reviewer-identity.test.ts`: mock `resolveIdentity` returning `[]`; verify the dropdown contains one `<li class="autocomplete-item--no-results">` item; verify clicking that item does NOT set `selectedReviewerId`
- [x] T023 [US2] In `src/settings/settings.ts`: in the dropdown-render path, when `resolveIdentity` returns an empty array, append a single `<li class="autocomplete-item autocomplete-item--no-results">No results found</li>` (no `data-id`); update the `click` delegated listener to skip items with no `data-id`
- [x] T024 [US2] In `src/settings/settings.ts`: handle `resolveIdentity` throwing (network error / 400): catch the error, set `reviewerHint.textContent = 'Could not search identities. Check your backend URL and client key.'` with `className = 'input-hint status-error'`, and call `closeDropdown()` without surfacing an exception to the save handler

**Checkpoint**: Empty search result shows "No results found"; network errors show an inline hint; neither sets a reviewer identity.

---

## Phase 6: Polish & Cross-Cutting Concerns

**Purpose**: Keyboard navigation, accessibility, build verification, and final validation.

- [x] T025 [P] In `src/settings/settings.ts`: add keyboard navigation to `reviewerSearchInput` `keydown` listener — ArrowDown/ArrowUp move a `focusIndex` variable and toggle `.autocomplete-item--focused` class on list items; Enter selects the focused item (same as click); Escape calls `closeDropdown()`; call `item.scrollIntoView({ block: 'nearest' })` on focus change
- [x] T026 [P] Verify `npm run build` produces zero TypeScript errors and zero webpack errors; verify `npx tsc --noEmit` is clean
- [ ] T027 Run manual end-to-end validation per `specs/002-extension-reviewer-identity/quickstart.md` — confirm all 8 steps pass

---

## Dependencies & Execution Order

### Phase Dependencies

- **Phase 1 (Backend Gate)**: No dependencies — but BLOCKS everything; do not start Phase 2+ until T001–T005 are complete
- **Phase 2 (Setup)**: Depends on Phase 1; T006 and T007 are independent and can run in parallel
- **Phase 3 (Foundational)**: Depends on Phase 2; T010/T011/T012/T013 can run in parallel with T008/T009
- **Phase 4 (US1)**: Depends on Phase 3 complete
- **Phase 5 (US2)**: Depends on Phase 4 complete (extends search render path)
- **Phase 6 (Polish)**: Depends on Phases 4–5 complete

### Within Each Phase: TDD Order

1. Write `[TEST]` task — confirm it FAILS before proceeding
2. Write implementation task — drive test green
3. Refactor without changing behaviour
4. Commit and move to next task

### Parallel Opportunities

- T006 (remove stale test) and T007 (testbed stubs) are independent within Phase 2
- T010/T011 (API client tests + impl) can proceed in parallel with T008/T009 (settings extensions)
- T012 (CSS) and T013 (resolve identity test) are fully independent of the above
- T025 (keyboard nav) can proceed in parallel with T026 (build check)

---

## Parallel Example: Phase 3

```text
Parallel stream A: T008 → T009 (extensionSettings additions)
Parallel stream B: T010 → T011 (reviewerIdentityClient)
Parallel stream C: T012         (autocomplete CSS)
Parallel stream D: T013         (crawlConfigClient resolveIdentity test)

All streams converge at Phase 4 checkpoint.
```

---

## Implementation Strategy

### MVP (User Story 1 only)

1. Phase 1: Backend gate — wait for backend feature 010 to merge, resync `api/openapi.json`, run `npm run generate:api`
2. Phase 2: Setup — remove stale test (T006) + extend testbed backend (T007)
3. Phase 3: Foundational — all four parallel streams (T008–T013)
4. Phase 4: US1 — search, select, save, pre-populate
5. **STOP AND VALIDATE**: Manually verify the full select + save + reload cycle
6. Deploy if ready

### Incremental Delivery

- After Phase 4: Identity can be set from the extension ✅
- After Phase 5: No-results and error states polished ✅
- After Phase 6: Keyboard accessible, build clean ✅

---

## Notes

- `[P]` tasks touch different files — safe to parallelise
- `[Story]` labels map each task to its user story for traceability
- **Hard dependency**: All tasks are blocked on Phase 1 (backend gate). Do not start Phase 2+ until `GET /clients/{clientId}/profile` is present in `src/generated/`
- Clearing the reviewer identity is out of scope — backend rejects empty/zero GUIDs; admin UI must be used to clear
- After Phase 1 regenerates the client, verify the exact generated method name for `GET /clients/{clientId}/profile` in `src/generated/services/ClientsService.ts` and use it in T010/T011
- Commit after each `[TEST]` + implementation pair
