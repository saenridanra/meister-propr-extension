# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Requirements

> Always read `Requirements.md` before implementing features or making architectural decisions.

## Project

`meister-propr-extension` — Azure DevOps extension ("Meister ProPR") that adds AI-powered code review to pull requests using Microsoft Foundry agents.

The backend is maintained in a **separate repository**. This repository contains only the extension.

## Extension (`extension/`)

**Build commands:**
- `npm run build` — production webpack build
- `npm run build:dev` — development webpack build
- `npm run generate:api` — generate typed TS client from `../backend/openapi.json`
- `npm run package` — package as `.vsix` via tfx-cli

**TypeScript check:** `npx tsc --noEmit`

**Key dependencies:** `azure-devops-extension-sdk`, `azure-devops-extension-api`, `axios`

## Architecture notes

- **Configuration storage:** ADO extension data storage (`IExtensionDataService`) — Backend URL and client key only
- **Client registry:** EF Core database in the backend validates incoming client keys (backend repo)
- **Foundry credentials:** Foundry endpoint and API key are configured in the backend deployment (environment variables or Azure Key Vault) — never stored in the extension or sent by the browser
- **Auth flow:** Extension → `POST /reviews` with `X-Client-Key` + `X-Ado-Token` headers + `{ organizationUrl, projectId, repositoryId, pullRequestId, iterationId }` → backend validates key → enqueues job → returns `202` with `jobId` → extension polls `GET /reviews/{jobId}` until `completed` or `failed`
- **ADO token:** `SDK.getAccessToken()` provides the user's ADO token; sent to the backend so it can fetch changed files and post review comments directly via the ADO API
- **ADO integration:** `GitRestClient` fetches PR iterations to resolve the latest `iterationId`; `IExtensionDataService` persists settings
- **API contract:** defined in `../backend/openapi.json`; generate typed client with `npm run generate:api`
