# Quickstart: Crawl Configuration Settings

**Branch**: `001-crawl-config-settings`
**Date**: 2026-03-09

---

## Prerequisites

- Node.js installed, `npm install` run at repo root
- Azure DevOps extension SDK testbed available (`npm run testbed:serve`)
- Backend running (local or remote) with crawl configuration endpoints available
- Extension settings pre-configured: `backendUrl`, `clientKey`, `clientId`

---

## Setting Up Jest for TDD

Before writing any implementation code, install and configure the test runner:

```bash
npm install --save-dev jest ts-jest @types/jest
```

Add to `package.json` scripts:
```json
"test": "jest",
"test:watch": "jest --watch"
```

Add `jest.config.js`:
```js
module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  testMatch: ['**/tests/**/*.test.ts'],
  moduleNameMapper: {
    'azure-devops-extension-sdk': '<rootDir>/tests/__mocks__/azure-devops-extension-sdk.ts',
    'azure-devops-extension-api': '<rootDir>/tests/__mocks__/azure-devops-extension-api.ts',
    'axios': '<rootDir>/tests/__mocks__/axios.ts',
  },
};
```

---

## TDD Workflow for This Feature

1. Write a failing test in `tests/`
2. Run `npm test` — confirm it fails (RED)
3. Write the minimum implementation to make it pass
4. Run `npm test` — confirm it passes (GREEN)
5. Refactor without changing behaviour
6. Run `npm test` again — confirm still green

---

## Build Verification

After each implementation step:

```bash
npx tsc --noEmit      # type-check
npm run build         # full production build
npm test              # all tests green
```

---

## Testing the Settings UI Manually

1. Start the testbed: `npm run testbed:serve`
2. Navigate to the project settings hub (mocked in testbed)
3. Verify:
   - `clientId` field appears alongside `backendUrl` and `clientKey`
   - Reviewer display name field appears in the Crawl Configuration section
   - Entering a name and saving calls `POST /clients/{clientId}/crawl-configurations`
   - Clearing the name and saving calls `DELETE /clients/{clientId}/crawl-configurations/{configId}`
   - Reloading the page pre-populates the reviewer display name from stored settings

---

## Key Files Modified / Created

| File | Change |
|------|--------|
| `src/common/extensionSettings.ts` | Add `clientId` field to `ExtensionSettings` |
| `src/api/crawlConfigClient.ts` | New: list, create, delete crawl config API calls |
| `src/settings/settings.ts` | Add crawl config section load/save logic |
| `settings.html` | Add Client ID input + Crawl Configuration section |
| `src/settings/settings.css` | Add section separator styles (minor) |
| `tests/crawlConfigClient.test.ts` | New: unit tests for API calls |
| `tests/settings.test.ts` | New: unit tests for settings save/load logic |
| `jest.config.js` | New: Jest configuration |
