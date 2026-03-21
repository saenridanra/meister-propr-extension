# Implementation Plan: Reviewer Identity Selection in Extension Settings

**Branch**: `002-extension-reviewer-identity` | **Date**: 2026-03-21 | **Spec**: [spec.md](spec.md)
**Input**: Feature specification from `/specs/002-extension-reviewer-identity/spec.md`

## Summary

Add a searchable reviewer identity field to the extension settings page. As the user types, the backend's identity resolve endpoint is queried and matching ADO identities are shown in a dropdown. The selected identity's GUID is submitted to the backend on save; the display name is persisted locally for UI pre-population. The backend must first update `PUT /clients/{clientId}/reviewer-identity` to accept `X-Client-Key` before the save path can be fully exercised end-to-end.

## Technical Context

**Language/Version**: TypeScript (strict mode)
**Primary Dependencies**: `azure-devops-extension-sdk`, `azure-devops-extension-api`, `axios`, `openapi-typescript-codegen` (generated client)
**Storage**: `IExtensionDataService` (ADO extension data) — one new key: `reviewerDisplayName`
**Testing**: Jest with `ts-jest`
**Target Platform**: Browser iframe inside Azure DevOps (sandboxed; no Node.js APIs)
**Project Type**: Azure DevOps extension (web)
**Performance Goals**: Identity search results appear within 3 seconds of the user stopping typing
**Constraints**: No frameworks (vanilla DOM only); no secrets beyond `backendUrl` + `clientKey` + `clientId`; `npm run build` and `npx tsc --noEmit` must be clean before merge
**Scale/Scope**: Single settings page addition; 2 new API calls, 1 new persisted key, ~100 LOC net

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principle | Status | Notes |
|-----------|--------|-------|
| I. API-Contract-First | ✅ Pass | All backend calls use generated `ClientsService` and `IdentitiesService`; `api/openapi.json` synced from backend before implementation; client regenerated after backend auth update |
| II. Test-First | ✅ Pass | `[TEST]` tasks precede implementation tasks in `tasks.md`; new test files cover API client, settings persistence, and UI logic |
| III. No Secrets | ✅ Pass | Only `backendUrl`, `clientKey`, `clientId` in extension storage; `reviewerDisplayName` is a display string (not a credential) |
| IV. ADO SDK as Only Integration Layer | ✅ Pass | No direct ADO REST calls; `IExtensionDataService` via SDK for storage; backend calls via generated HTTP client |
| V. Polling Over WebSockets | ✅ Pass | Feature has no async jobs; not applicable |
| VI. Simplicity | ✅ Pass | Vanilla DOM autocomplete mirrors existing `review.ts` pattern; no framework added; complexity justified in Complexity Tracking |
| VII. Build Integrity | ✅ Pass | `api/openapi.json` sync + `npm run generate:api` required step; TypeScript strict mode throughout |

**Post-design re-check**: All principles still satisfied. No violations to justify.

## Complexity Tracking

> No constitution violations. Table included for completeness.

| Decision | Why Needed | Simpler Alternative Rejected Because |
|----------|------------|-------------------------------------|
| Custom autocomplete `<ul>/<li>` dropdown | Must store GUID alongside display name; `<datalist>` cannot carry arbitrary data | `<datalist>` only supports display text — GUID cannot be attached |
| `reviewerDisplayName` in extension storage | No reverse GUID→name endpoint in backend | Showing raw GUIDs to users is unacceptable UX |

## Project Structure

### Documentation (this feature)

```text
specs/002-extension-reviewer-identity/
├── plan.md              ← this file
├── research.md          ← Phase 0 output
├── data-model.md        ← Phase 1 output
├── quickstart.md        ← Phase 1 output
├── contracts/
│   └── reviewer-identity-api.md  ← Phase 1 output
├── checklists/
│   └── requirements.md
└── tasks.md             ← Phase 2 output (/speckit.tasks)
```

### Source Code

```text
src/
├── api/
│   ├── crawlConfigClient.ts       (existing — resolveIdentity already present)
│   └── reviewerIdentityClient.ts  (NEW: getClient, setReviewerIdentity)
├── common/
│   └── extensionSettings.ts       (extend: add reviewerDisplayName key + load/save helpers)
└── settings/
    ├── settings.ts                 (extend: reviewer identity search section)
    └── settings.css                (extend: autocomplete dropdown styles)

settings.html                       (extend: add Reviewer Identity section)

tests/
├── crawlConfigClient.test.ts       (existing — add resolveIdentity test)
├── extensionSettings.test.ts       (existing — extend with reviewerDisplayName)
├── reviewerIdentityClient.test.ts  (NEW)
├── settings-crawl.test.ts          (REMOVE — imports stale helpers no longer in extensionSettings)
└── settings-reviewer-identity.test.ts  (NEW)
```
