# API Contract: Crawl Configuration Endpoints

**Source of truth**: `api/openapi.json`
**Auth header**: `X-Client-Key: <clientKey>` (required on all endpoints below)

---

## List Crawl Configurations

```
GET /clients/{clientId}/crawl-configurations
```

**Purpose**: Retrieve all crawl configurations belonging to this client. Used on settings load and before create/delete decisions.

**Path params**:
- `clientId` (UUID) — stored in ExtensionSettings

**Request headers**:
- `X-Client-Key: <clientKey>`

**Response 200**:
```json
[
  {
    "id": "<uuid>",
    "organizationUrl": "https://dev.azure.com/myorg/",
    "projectId": "<project-guid>",
    "reviewerId": "<vss-identity-guid>",
    "crawlIntervalSeconds": 300
  }
]
```

**Response 401**: Missing or invalid X-Client-Key → show "invalid credentials" error, abort save.
**Response 403**: Client key does not own this clientId → show "access denied" error, abort save.

**Matching logic in extension**:
```
match = configs.find(c =>
  c.organizationUrl === currentOrgUrl &&
  c.projectId === currentProjectId
)
```

---

## Create Crawl Configuration

```
POST /clients/{clientId}/crawl-configurations
Content-Type: application/json
```

**Purpose**: Register a new crawl configuration for the current project. Called only when no matching config exists and reviewer display name is non-empty.

**Path params**:
- `clientId` (UUID) — stored in ExtensionSettings

**Request headers**:
- `X-Client-Key: <clientKey>`

**Request body**:
```json
{
  "organizationUrl": "https://dev.azure.com/myorg/",
  "projectId": "<project-guid>",
  "reviewerDisplayName": "<user-entered display name>",
  "crawlIntervalSeconds": 300
}
```

**Response 201**: Crawl configuration created. Extension updates stored display name and shows success.

**Response 401**: Invalid credentials → show error.
**Response 403**: Access denied → show error.
**Response 4xx (other)**: Backend rejected the request (e.g. display name not found in ADO) → show backend error message to user.

---

## Delete Crawl Configuration

```
DELETE /clients/{clientId}/crawl-configurations/{configId}
```

**Purpose**: Remove a crawl configuration. Called only when a matching config exists and reviewer display name is cleared.

**Path params**:
- `clientId` (UUID) — stored in ExtensionSettings
- `configId` (UUID) — the `id` field from the matching `CrawlConfigResponse`

**Request headers**:
- `X-Client-Key: <clientKey>`

**Response 204**: Configuration deleted. Extension clears stored display name and shows success.

**Response 401**: Invalid credentials → show error.
**Response 403**: Access denied → show error.
**Response 404**: Configuration not found (already deleted) → treat as success (idempotent).
