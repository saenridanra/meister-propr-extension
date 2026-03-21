# Developer Quickstart: Reviewer Identity Selection

## Prerequisites

1. Complete the backend change: `PUT /clients/{clientId}/reviewer-identity` must accept `X-Client-Key`.
2. Sync and regenerate the API client:
   ```bash
   cp ../meister-propr/meister-propr/openapi.json api/openapi.json
   npm run generate:api
   ```
3. Verify build is clean:
   ```bash
   npm run build:dev
   npx tsc --noEmit
   ```

## Files to touch

| File | Change |
|------|--------|
| `src/common/extensionSettings.ts` | Add `reviewerDisplayName` key + `loadReviewerDisplayName` / `saveReviewerDisplayName` helpers |
| `src/api/reviewerIdentityClient.ts` | **New** — `getClient`, `setReviewerIdentity` |
| `src/settings/settings.ts` | Add reviewer identity section (search input + dropdown + save logic) |
| `src/settings/settings.css` | Add `.autocomplete-wrapper`, `.autocomplete-dropdown`, `.autocomplete-item` styles |
| `settings.html` | Add Reviewer Identity `<section>` with search input and dropdown container |
| `tests/reviewerIdentityClient.test.ts` | **New** — unit tests for the new API client |
| `tests/settings-reviewer-identity.test.ts` | **New** — unit tests for settings identity logic |
| `tests/settings-crawl.test.ts` | **Remove** — imports stale `loadProjectCrawlReviewerName` which no longer exists |

## Implementation order (TDD)

1. Write failing tests for `reviewerIdentityClient.ts` → implement → green
2. Write failing tests for `extensionSettings.ts` additions → implement → green
3. Write failing tests for settings identity logic → implement → green
4. Update `settings.html` + `settings.css`
5. Wire up `settings.ts` DOM logic
6. `npm run build` + `npx tsc --noEmit` — must be clean

## Key behaviour to implement in settings.ts

```
onInput (debounced 300ms, ≥2 chars):
  resolveIdentity(backendUrl, clientKey, orgUrl, query)
    → populate dropdown with results (or "no results" item)
    → show dropdown

onDropdownItemClick:
  selectedReviewerId = item.dataset.id
  input.value = item.textContent
  hide dropdown

onDocumentClick (outside wrapper):
  hide dropdown

onPageLoad:
  loadReviewerDisplayName() → if non-empty, populate input

onSave:
  if input.value === '' && hadReviewerOnLoad:
    setReviewerIdentity(backendUrl, clientKey, clientId, '')
    saveReviewerDisplayName('')
  else if selectedReviewerId !== null:
    setReviewerIdentity(backendUrl, clientKey, clientId, selectedReviewerId)
    saveReviewerDisplayName(input.value)
  // else: no change — skip identity update call
```

## Testing the feature manually

1. Open the Meister ProPR settings page for any ADO project.
2. Enter valid Backend URL, Client Key, and Client ID.
3. Type at least 2 characters of a known identity display name in the "Reviewer Identity" field.
4. Verify the dropdown appears with matching results within ~3 seconds.
5. Select a result — input should show the display name.
6. Click Save — verify success message and that the backend's client record shows the new `reviewerId`.
7. Reload the page — verify the display name is pre-populated.
8. Clear the field and save — verify `reviewerId` is cleared in the backend.
