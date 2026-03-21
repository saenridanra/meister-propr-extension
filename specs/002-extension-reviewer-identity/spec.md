# Feature Specification: Reviewer Identity Selection in Extension Settings

**Feature Branch**: `002-extension-reviewer-identity`
**Created**: 2026-03-21
**Status**: Approved

## Clarifications

### Session 2026-03-21

- Q: US2 (clear reviewer identity) assumes the backend accepts an empty string to clear, but backend feature 010 (`PUT /clients/{clientId}/reviewer-identity`) explicitly rejects empty/zero GUIDs — how should clearing be handled? → A: Remove US2 from extension scope. Clearing the reviewer identity is not supported via the extension; administrators who need to clear it must use the admin UI. A future `DELETE /clients/{clientId}/reviewer-identity` endpoint could re-enable this if needed.
- Q: Should extension implementation wait for backend feature 010 to merge before starting, or proceed with mocks and sync later? → A: Block on backend feature 010 merging first. No extension code is written until `api/openapi.json` has been resynced from the backend and `npm run generate:api` has been run successfully, producing the new `GET /clients/{clientId}/profile` endpoint in the generated client.
- Q: Is the reviewer identity UI fully testable using the existing testbed? → A: No — the testbed `backend.ts` only stubs `/reviews`. It must be extended with stubs for `GET /identities/resolve`, `GET /clients/{clientId}/profile`, and `PUT /clients/{clientId}/reviewer-identity` to enable full local testing of the search, pre-population, and save flows.

## User Scenarios & Testing *(mandatory)*

### User Story 1 — Search and Select a Reviewer Identity (Priority: P1)

A project administrator opens the Meister ProPR project settings page and types part of a display name into a reviewer identity field. A dropdown appears listing matching identities from the Azure DevOps organisation. The administrator selects the desired identity, then saves settings. From that point on, the selected identity is used as the bot reviewer for this client.

**Why this priority**: This is the core of the feature — allowing an administrator to choose the reviewer identity without needing access to the separate admin UI. Without it, the feature has no purpose.

**Independent Test**: Open the settings page, type a partial display name in the reviewer identity field, confirm a dropdown of matching identities appears, select one, save, then verify the client's reviewer identity is updated to the selected GUID in the backend.

**Acceptance Scenarios**:

1. **Given** the user has entered valid backend credentials (URL, client key, client ID), **When** they type at least 2 characters into the reviewer identity search field, **Then** a dropdown appears showing matching identities from the organisation.
2. **Given** a list of matching identities is shown, **When** the user selects one, **Then** the field displays the selected identity's display name and the underlying GUID is retained for submission.
3. **Given** a reviewer identity has been selected, **When** the user saves settings, **Then** the selected identity GUID is submitted to the backend and a success confirmation is shown.
4. **Given** a reviewer identity is already configured for this client, **When** the settings page opens, **Then** the reviewer identity field is pre-populated with the currently configured display name.

---

### User Story 2 — Search Returns No Results (Priority: P2)

A project administrator searches for an identity that does not exist in the organisation. The dropdown informs them that no matching identity was found, so they can refine their search rather than silently picking nothing.

**Why this priority**: Feedback on failed searches prevents silent misconfiguration. It is secondary to the happy path but important for usability.

**Independent Test**: Type a display name that does not exist in the organisation and verify that the dropdown shows a "no results" message rather than an empty or missing dropdown.

**Acceptance Scenarios**:

1. **Given** the user types a display name that matches no identity in the organisation, **When** the dropdown opens, **Then** it displays a "no results found" message.
2. **Given** a "no results" state, **When** the user continues typing to refine the search, **Then** the dropdown updates dynamically.

---

### Edge Cases

- What if the backend is unreachable when the identity search is triggered? The search field shows an error and the dropdown does not open; existing selection is preserved.
- What if the identity GUID stored in the backend no longer corresponds to a valid ADO identity? The pre-population falls back to displaying the raw GUID with a warning that the identity could not be resolved.
- What if the user types and then clears the field before saving? The state is treated as "no selection" and the save is a no-op for the reviewer identity field — the existing backend value is left unchanged.
- What if multiple identities share the same display name? All matches are shown in the dropdown; the user must choose among them (each entry is distinct by GUID).
- What if the user saves without changing the reviewer identity field? The field is not resubmitted; only a change triggers an identity update call.
- What if the user wants to remove the reviewer identity? This is out of scope — use the admin UI. A future backend DELETE endpoint could enable self-service clearing.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The settings page MUST include a reviewer identity search field that queries the backend for matching ADO identities as the user types.
- **FR-002**: Search results MUST be presented in a dropdown listing each match by display name; selecting an entry captures its underlying GUID.
- **FR-003**: The reviewer identity field MUST be pre-populated on page load if a reviewer identity is already configured for the client, using the new `GET /clients/{clientId}/profile` endpoint (authenticated with `X-Client-Key`).
- **FR-004**: On save, if a new identity is selected, the system MUST submit the identity GUID to the backend to update the client's reviewer identity.
- **FR-005**: On save, if the user has not made a new selection (field unchanged or cleared without selecting), the reviewer identity update call MUST be skipped — the existing backend value is preserved.
- **FR-006**: The reviewer identity field MUST be disabled until the backend URL, client key, and client ID fields are all populated (same prerequisite guard as existing fields).
- **FR-007**: Search MUST be triggered after the user has typed at least 2 characters, to avoid unnecessary requests on single keystrokes.
- **FR-008**: The system MUST display a clear error message if the identity search or identity update call fails.
- **FR-009**: Both the identity search and the reviewer identity update MUST authenticate using the existing `X-Client-Key`. Pre-population uses `GET /clients/{clientId}/profile` (client-key authenticated, added by backend feature 010); no new credential field is required in the extension settings page.

### Key Entities

- **Reviewer Identity**: The ADO identity (service account or managed identity) used by the backend bot when posting review comments. Has a display name (shown to users) and a GUID (used in API calls). Once set via the extension, can only be changed to a new valid identity — clearing requires the admin UI.
- **Identity Search Result**: A candidate identity returned by the backend's resolve endpoint, containing display name and GUID.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: An administrator can select and save a reviewer identity in under 2 minutes without leaving the extension settings page.
- **SC-002**: Identity search results appear within 3 seconds of the user stopping typing.
- **SC-003**: The reviewer identity field correctly reflects the currently configured identity on 100% of settings page loads (when the backend is reachable).
- **SC-004**: Zero administrator visits to the separate admin UI are required to configure or update the reviewer identity for a client, once this feature is available.

## Assumptions

- The backend's `GET /identities/resolve` endpoint (authenticated with `X-Client-Key`) is sufficient for searching identities — no additional ADO SDK calls from the extension are required for lookup.
- Pre-population uses the new `GET /clients/{clientId}/profile` endpoint (backend feature 010) which returns `reviewerId` directly via `X-Client-Key`. The stored `reviewerDisplayName` in extension storage provides the display name; the `reviewerId` from the profile endpoint is used to detect out-of-band changes.
- Clearing the reviewer identity is out of scope for this feature. The backend `PUT /clients/{clientId}/reviewer-identity` endpoint rejects empty/zero GUIDs.
- The identity selector is scoped to the organisation inferred from the org context already present in the settings page.
- Debouncing the search input (300 ms after the user stops typing) is an implementation detail and is assumed standard.
- **Blocking dependency**: Extension implementation does not begin until backend feature 010 (`010-client-reviewer-identity`) is merged, `api/openapi.json` is resynced (`cp ../meister-propr/meister-propr/openapi.json api/openapi.json`), and `npm run generate:api` runs cleanly — the generated `GET /clients/{clientId}/profile` endpoint must be present in `src/generated/` before any extension code is written.
- The testbed dummy backend (`testbed/backend.ts`) must be extended with stubs for `GET /identities/resolve`, `GET /clients/{clientId}/profile`, and `PUT /clients/{clientId}/reviewer-identity` so the full identity search → select → save flow can be exercised locally without the real backend. This is part of the implementation scope for this feature.
