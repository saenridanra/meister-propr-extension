# Data Model: Crawl Configuration Settings

**Branch**: `001-crawl-config-settings`
**Date**: 2026-03-09

---

## Entities

### ExtensionSettings (extended)

Stored in ADO `IExtensionDataService` at `Default` scope. Existing fields plus new `clientId`.

| Field       | Type   | Scope   | Storage Key   | Description                                         |
|-------------|--------|---------|---------------|-----------------------------------------------------|
| backendUrl  | string | Default | `backendUrl`  | Base URL of the Meister ProPR backend               |
| clientKey   | string | Default | `clientKey`   | Secret key authenticating the client to the backend |
| clientId    | string | Default | `clientId`    | UUID identifying the client (new field)             |

**Validation**:
- `clientId` must be a non-empty string when crawl config operations are attempted; if missing, the UI shows a prerequisite warning.
- All three fields (`backendUrl`, `clientKey`, `clientId`) must be present for the crawl configuration UI to be functional.

---

### ProjectCrawlSettings

Stored in ADO `IExtensionDataService` at `Default` scope, per-project via a keyed naming convention.

| Field                  | Type            | Storage Key Pattern                          | Description                                                        |
|------------------------|-----------------|----------------------------------------------|--------------------------------------------------------------------|
| reviewerDisplayName    | string or null  | `crawlReviewerDisplayName_{projectId}`       | Last-saved reviewer display name for this project; null if unset   |

**Derivation**: `projectId` is the Azure DevOps project GUID obtained from `SDK.getPageContext().webContext.project.id`.

**State semantics**:
- Non-empty string → the project has (or had) a crawl configuration with this reviewer.
- Empty / null → no crawl configuration is configured for this project.

---

### CrawlConfigResponse (backend type, read-only from extension perspective)

Returned by `GET /clients/{clientId}/crawl-configurations`. Defined in `api/openapi.json`.

| Field                 | Type    | Description                                                        |
|-----------------------|---------|--------------------------------------------------------------------|
| id                    | UUID    | Unique identifier of the crawl configuration                       |
| organizationUrl       | string  | ADO organisation URL this config targets                           |
| projectId             | string  | ADO project GUID this config targets                               |
| reviewerId            | UUID    | VSS identity GUID of the assigned reviewer (resolved from name)    |
| crawlIntervalSeconds  | integer | How often the backend scans for new PRs (seconds)                  |

**Matching rule**: A crawl configuration matches the current project when both `organizationUrl` and `projectId` equal the values from the current page context.

---

### CreateCrawlConfigRequest (backend type, write-only from extension perspective)

Sent in `POST /clients/{clientId}/crawl-configurations`. Defined in `api/openapi.json`.

| Field                 | Type    | Value source                          |
|-----------------------|---------|---------------------------------------|
| organizationUrl       | string  | `SDK.getHost().name` → derived URL    |
| projectId             | string  | `SDK.getPageContext().webContext.project.id` |
| reviewerDisplayName   | string  | User input from settings form         |
| crawlIntervalSeconds  | integer | Constant: `300` (hardcoded default)   |

---

## State Transitions

```
Settings Page Load
       │
       ▼
  Load ExtensionSettings (backendUrl, clientKey, clientId)
       │
       ├─ Missing fields? → Show prerequisite warning, disable crawl config section
       │
       ▼
  Load stored reviewerDisplayName for current projectId
       │
       ├─ Found → pre-populate input field
       └─ Not found → leave input field empty
       │
       ▼
  [User edits reviewer display name]
       │
       ▼
  [User clicks Save]
       │
  ┌────┴──────────────────────────────────────┐
  │ reviewerDisplayName non-empty?            │
  │                                           │
  │  YES                    NO               │
  │   │                      │               │
  │   ▼                      ▼               │
  │  List crawl configs    List crawl configs │
  │  for client             for client        │
  │   │                      │               │
  │   ├─ Match found?         ├─ Match found? │
  │   │  YES → no-op (skip)   │  YES → DELETE │
  │   │  NO → CREATE          │  NO → no-op   │
  │   │                       │               │
  └───┼───────────────────────┼───────────────┘
      │                       │
      ▼                       ▼
  Store reviewerDisplayName  Clear stored reviewerDisplayName
  for projectId               for projectId
      │                       │
      └──────────┬────────────┘
                 ▼
          Show success/error message
```
