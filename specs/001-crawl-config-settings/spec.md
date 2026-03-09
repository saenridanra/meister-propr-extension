# Feature Specification: Crawl Configuration Settings

**Feature Branch**: `001-crawl-config-settings`
**Created**: 2026-03-09
**Status**: Draft
**Input**: User description: "The backend has added the possibility to add crawl configurations. We want to be able to add/remove the crawl configuration of a given project within the settings of the project. For this we simply want to let the user specify the reviewer display name, as it is defined in the API. If it set and the settings saved, the crawl config is added if it does not already exist. If is unset it is removed for the given org and project (first need to list the existing crawl configurations and then use the ID if any matches)."

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Enable Automatic Crawling for a Project (Priority: P1)

A project administrator opens the Meister ProPR project settings page and enters the display name of the identity that should be used as the reviewer for automatic crawling. Upon saving, the system registers a crawl configuration with the backend for the current organization and project, so that pull requests are automatically reviewed going forward.

**Why this priority**: This is the core value of the feature — enabling automated crawling for a project. Without it, the feature has no purpose.

**Independent Test**: Open the settings page for a project that has no existing crawl configuration, enter a valid reviewer display name, click save, then verify the crawl configuration exists in the backend for that org/project.

**Acceptance Scenarios**:

1. **Given** no crawl configuration exists for the current organization and project, **When** the user enters a reviewer display name and saves settings, **Then** a crawl configuration is created for the current organization and project with the specified reviewer.
2. **Given** a crawl configuration already exists for the current organization and project, **When** the user enters a reviewer display name and saves settings, **Then** no duplicate crawl configuration is created (the operation is idempotent).
3. **Given** the reviewer display name field is populated and settings are saved, **When** the backend confirms the crawl configuration was created, **Then** the settings page displays a success confirmation to the user.

---

### User Story 2 - Disable Automatic Crawling for a Project (Priority: P2)

A project administrator opens the settings page and clears the reviewer display name field. Upon saving, the system finds and removes the existing crawl configuration for the current organization and project, stopping future automatic crawl reviews.

**Why this priority**: Administrators must be able to opt out of crawling cleanly. This mirrors the creation flow and is essential for lifecycle management.

**Independent Test**: Open the settings page for a project that has an existing crawl configuration, clear the reviewer display name field, click save, then verify no crawl configuration exists for that org/project in the backend.

**Acceptance Scenarios**:

1. **Given** a crawl configuration exists for the current organization and project, **When** the user clears the reviewer display name field and saves settings, **Then** the matching crawl configuration is removed from the backend.
2. **Given** no crawl configuration exists for the current organization and project, **When** the user saves with an empty reviewer display name field, **Then** no error occurs and the save completes successfully.
3. **Given** the reviewer display name is cleared and settings are saved, **When** the backend confirms the crawl configuration was deleted (or none existed), **Then** the settings page displays a success confirmation to the user.

---

### User Story 3 - View Current Crawl Configuration State (Priority: P3)

A project administrator opens the settings page and immediately sees whether a crawl configuration is currently active for the project — the reviewer display name field is pre-populated if a configuration exists, or empty if none is set.

**Why this priority**: Visibility into the current state reduces confusion and prevents accidental double-configuration. However, the core create/delete flows (P1, P2) deliver value even without pre-population.

**Independent Test**: Create a crawl configuration for a project, then open the settings page and verify the reviewer display name field reflects the configured reviewer name.

**Acceptance Scenarios**:

1. **Given** a crawl configuration exists for the current organization and project, **When** the user opens the project settings page, **Then** the reviewer display name field is pre-populated with the name of the configured reviewer.
2. **Given** no crawl configuration exists for the current organization and project, **When** the user opens the project settings page, **Then** the reviewer display name field is empty.

---

### Edge Cases

- What happens when the reviewer display name does not match any known identity in Azure DevOps? The save should fail with a descriptive error so the user can correct the name.
- What happens when the backend is unreachable during save? The settings page displays an error and does not leave the user uncertain about whether the configuration changed.
- What happens when the backend returns multiple crawl configurations for the same organization and project? The system uses the first matching one for deletion; this scenario indicates a data inconsistency that should be surfaced to the user.
- What happens when the user saves without changing the reviewer display name (no-op save)? The system should avoid making unnecessary backend calls if the state has not changed, or at minimum handle the idempotent case gracefully.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The project settings page MUST include a text field for the reviewer display name used to configure automatic crawling.
- **FR-002**: On save, if the reviewer display name field is non-empty, the system MUST check whether a crawl configuration already exists for the current organization and project before attempting to create one.
- **FR-003**: On save, if the reviewer display name is non-empty and no matching crawl configuration exists, the system MUST create a crawl configuration for the current organization and project using the specified reviewer display name.
- **FR-004**: On save, if the reviewer display name is empty and a crawl configuration exists for the current organization and project, the system MUST delete that crawl configuration.
- **FR-005**: On save, if the reviewer display name is empty and no crawl configuration exists, the system MUST complete the save without error (no-op).
- **FR-006**: On save, if the reviewer display name is non-empty and a crawl configuration already exists for the current organization and project, the system MUST NOT create a duplicate.
- **FR-007**: The system MUST match crawl configurations by both organization URL and project identifier of the current project context.
- **FR-008**: After each save attempt, the settings page MUST display a clear success or error message to the user.
- **FR-009**: On opening the project settings page, the system MUST load and display the current crawl configuration state (reviewer display name pre-populated if a config exists, empty if not).

### Key Entities

- **Crawl Configuration**: A backend record that links a client to a specific organization and project, instructing the system to automatically crawl pull requests in that project and assign reviews to the specified reviewer identity. Identified by a unique ID, scoped to organization URL and project identifier.
- **Reviewer Display Name**: A human-readable name (as defined in Azure DevOps) that identifies the identity to be used as the reviewer for automatically initiated reviews. The backend resolves this name to an internal identity identifier upon creation.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: An administrator can configure or remove automatic crawling for a project within 60 seconds of opening the settings page.
- **SC-002**: After saving a valid reviewer display name, the crawl configuration is reflected in the backend within the same save operation — no additional manual steps required.
- **SC-003**: The settings page accurately reflects the current crawl configuration state on load in 100% of cases where the backend is reachable.
- **SC-004**: Saving with an invalid or unrecognized reviewer display name results in a visible error message, with no partial or inconsistent backend state created.
- **SC-005**: Repeated saves with identical settings produce no duplicate crawl configurations and no errors.

## Assumptions

- The settings page described in this spec is the existing Meister ProPR project-level settings hub where backend URL and client key are already configured.
- The current ADO project context (organization URL and project identifier) is available to the settings page at runtime.
- The backend requires a client identifier (UUID) to scope crawl configuration operations, and the implementation will resolve this identifier from the stored client key — either via a new backend endpoint, or by storing it alongside the client key. This is an implementation concern and not a user-facing requirement.
- A crawl configuration is matched for deletion by finding the one whose organization URL and project identifier match the current project context. If multiple matches exist (data inconsistency), the first match is used.
- The reviewer display name shown to the user on load is derived from the crawl configuration stored in the backend, not from local extension storage.
- Backend URL and client key must already be configured for the crawl configuration feature to function; if they are not, the settings page should indicate that prerequisite settings are missing.
