# Data Model: Reviewer Identity Selection

## Persisted State

### IExtensionDataService — new key

| Key | Scope | Type | Description |
|-----|-------|------|-------------|
| `reviewerDisplayName` | `Default` (org-level) | `string` | Display name of the currently configured reviewer identity. Stored at save time alongside the GUID submitted to the backend. Used only for UI pre-population on next page load. |

**Scope rationale**: `Default` (org-level) matches the existing `backendUrl`/`clientKey`/`clientId` keys. The reviewer identity is a client-level setting that applies across all projects within the org, so org-level scope is correct.

---

## Runtime State (in-memory only, not persisted)

| Variable | Type | Description |
|----------|------|-------------|
| `selectedReviewerId` | `string \| null` | The GUID of the identity currently selected in the dropdown, or `null` if the field is empty or the user has typed without selecting a result. Set when the user picks a dropdown item; cleared when the field is emptied. |
| `debounceTimer` | `ReturnType<typeof setTimeout> \| undefined` | Handle for the pending debounce timeout. Cleared on every keystroke; fires the search after 300 ms of inactivity. |

---

## Backend Entities (read-only from extension perspective)

### IdentityResponse (from `GET /identities/resolve`)

| Field | Type | Description |
|-------|------|-------------|
| `id` | `string` | VSS identity GUID — submitted as `reviewerId` in the update call. |
| `displayName` | `string \| null` | Human-readable display name shown in the dropdown and stored locally. |

### ClientResponse (from `GET /clients/{clientId}`)

| Field | Type | Description |
|-------|------|-------------|
| `reviewerId` | `string \| null` | Currently configured reviewer GUID. Read on page load to detect whether an identity is already set; compared against locally stored value to detect out-of-band changes. |

---

## State Transitions

```
Page load
  └── [reviewerDisplayName in storage?]
        ├── YES → populate input with stored display name
        │         set selectedReviewerId = null (GUID not needed until save)
        └── NO  → input empty, selectedReviewerId = null

User types ≥ 2 chars (after 300 ms debounce)
  └── call resolveIdentity → show dropdown results
        ├── results found → user clicks item
        │     └── input = displayName, selectedReviewerId = id
        └── no results → show "no results" message

User clears input
  └── selectedReviewerId = null, dropdown hidden

Save button clicked
  ├── selectedReviewerId != null (new selection)
  │     └── PUT /clients/{clientId}/reviewer-identity { reviewerId }
  │           └── on success: save reviewerDisplayName to extension storage
  ├── input empty (cleared)
  │     └── PUT /clients/{clientId}/reviewer-identity { reviewerId: "" }  [or backend DELETE — TBD by contract]
  │           └── on success: clear reviewerDisplayName from extension storage
  └── input unchanged from pre-populated value (no interaction)
        └── skip reviewer identity update call (no change)
```

**Note on "clear" operation**: The contract section defines the exact shape of the clear call. If the backend accepts an empty/null GUID as a clear signal, a single PUT suffices. If a DELETE endpoint is added, the contract section captures that. This is the only open design point pending the backend update.
