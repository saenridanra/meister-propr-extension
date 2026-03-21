# Research: Reviewer Identity Selection in Extension Settings

## 1. Vanilla DOM Autocomplete Pattern

**Decision**: Build a custom autocomplete using a `<ul>/<li>` list below the text input. Follow the pattern already established in `src/review/review.ts` (PR search dropdown).

**Rationale**: Constitution VI mandates vanilla DOM — no React, Vue, or other UI framework. The `<datalist>` element is insufficient because it does not support rich item data (we need to store a GUID alongside each display name). `review.ts` already implements a complete, working autocomplete; the reviewer identity field should follow the same pattern exactly to stay consistent.

**Pattern** (mirrors `review.ts`):
```html
<div class="autocomplete-wrapper">
  <input type="text" id="reviewer-search" autocomplete="off" spellcheck="false"
         aria-autocomplete="list" aria-controls="reviewer-dropdown" aria-expanded="false">
  <ul id="reviewer-dropdown" class="autocomplete-dropdown" role="listbox" hidden>
    <!-- populated by JS: <li role="option" data-id="GUID">Display Name</li> -->
  </ul>
</div>
```
- `input` event on the text field (≥2 chars) triggers a debounced search.
- Results populate the `<ul>` as `<li role="option">` items carrying the GUID in `data-id`.
- A "no results" message item is rendered when the API returns an empty array.
- Clicking a `<li>` sets the input value to the display name and captures the GUID in a module-level variable; the dropdown is hidden. `mousedown` on the `<li>` calls `e.preventDefault()` to prevent the input `blur` from firing before the click registers.
- `aria-expanded` is toggled on open/close for screen-reader compatibility.
- Keyboard navigation: tracked `focusIndex` variable; ArrowUp/ArrowDown move focus; Enter selects; Escape closes.

**Alternatives considered**:
- `<datalist>`: rejected — cannot attach arbitrary data (GUID) to options.
- `<select>`: rejected — requires eager population; not suitable for async type-ahead.
- Global `document.addEventListener('click', ...)` for click-outside: rejected — see §3.

---

## 2. Debouncing

**Decision**: Inline `setTimeout`/`clearTimeout` debounce — no library.

**Rationale**: One call-site, no dependency cost. The pattern is two lines and well understood.

```typescript
let debounceTimer: ReturnType<typeof setTimeout> | undefined;
input.addEventListener('input', () => {
    clearTimeout(debounceTimer);
    debounceTimer = setTimeout(() => runSearch(), 300);
});
```

**Delay**: 300 ms — standard for search inputs; balances responsiveness against unnecessary API calls.

---

## 3. Click-Outside-to-Close

**Decision**: Use the input's `blur` event with a 150 ms delay — not a global `document.addEventListener('click', ...)`.

**Rationale**: This is the exact pattern used in `review.ts`. The 150 ms delay allows the `<li>` `mousedown` → `click` sequence to complete before blur fires, so item selection is never cancelled by the dropdown closing prematurely. Avoids adding a persistent global listener that can cause memory leaks or interfere with other extension features in the sandboxed iframe.

```typescript
reviewerSearch.addEventListener('blur', () => setTimeout(closeDropdown, 150));
// Prevent blur from firing before click on list items:
reviewerDropdown.addEventListener('mousedown', e => e.preventDefault());
```

---

## 4. Pre-population of Reviewer Display Name

**Decision**: Persist the display name in `IExtensionDataService` (alongside the GUID submitted to the backend) at save time. On page load, read the stored display name and populate the input field.

**Rationale**: `ClientResponse.reviewerId` returns the GUID only. The backend has no reverse GUID→display-name endpoint. Storing the display name locally at save time is the minimal, zero-additional-API-call approach. This follows the same precedent as the now-removed `saveProjectCrawlReviewerName`.

**Storage key**: `reviewerDisplayName` at `Default` scope in `IExtensionDataService`.

**Edge case**: If the stored GUID no longer matches the backend value (e.g. changed from admin UI), the display name shown may be stale. On save, the user's new selection always overwrites both the backend GUID and the stored display name, self-correcting on next save.

**Alternatives considered**:
- Resolve display name from GUID on load via backend endpoint: not available; would require a backend change out of scope for this feature.
- Show GUID directly in the field: poor UX; GUIDs are not human-readable.

---

## 5. Backend Dependency — Auth Change for PUT /clients/{clientId}/reviewer-identity

**Decision**: Extension proceeds with the assumption that the backend will change `PUT /clients/{clientId}/reviewer-identity` to accept `X-Client-Key` (for the owning client). The extension calls this endpoint via the generated client using `X-Client-Key`, identical to all other extension→backend calls.

**Rationale**: User confirmed the backend will be updated (Option A from spec clarification). The endpoint shape (path, body `{ reviewerId }`) is already defined in `openapi.json`. Once the backend auth is relaxed, `api/openapi.json` must be synced and `npm run generate:api` re-run before implementation of the save path can be tested end-to-end.

**Blocking tasks**:
1. Backend updates `PUT /clients/{clientId}/reviewer-identity` to accept `X-Client-Key`.
2. Backend regenerates `openapi.json`.
3. Extension syncs `api/openapi.json` and runs `npm run generate:api`.

---

## 6. New API Client File

**Decision**: Add `src/api/reviewerIdentityClient.ts` for `getClient` and `setReviewerIdentity`. Leave `resolveIdentity` in `crawlConfigClient.ts` (already there and tested with the crawl config client).

**Rationale**: The reviewer identity is a client-level concern, not crawl-config-specific. A dedicated file keeps concerns clean without moving existing code. `getClient` (wrapping `ClientsService.getClients1`) is needed to fetch the current `reviewerId` GUID on page load; comparing it against the locally stored GUID is how we detect a mismatch.

---

## 7. Stale Test Cleanup

**Finding**: `tests/settings-crawl.test.ts` imports `loadProjectCrawlReviewerName` / `saveProjectCrawlReviewerName` from `extensionSettings`, which were removed in the 001 implementation refactor. These tests currently reference the old API and will fail at runtime (import error) or were already excluded from the test run.

**Decision**: Remove `tests/settings-crawl.test.ts` as part of this feature. The relevant crawl-toggle logic is already covered inline by `tests/settings-crawl.test.ts` in terms of create/delete config; the now-removed reviewer-name persistence is no longer a feature. A new `tests/settings-reviewer-identity.test.ts` covers the new identity-selection logic.
