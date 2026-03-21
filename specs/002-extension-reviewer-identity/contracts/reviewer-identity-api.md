# API Contract: Reviewer Identity

This document defines the backend endpoints consumed by the extension for reviewer identity management. All endpoints use `X-Client-Key` for authentication.

---

## GET /identities/resolve

Search for ADO identities by display name.

**Auth**: `X-Client-Key`
**Already available**: Yes (no backend change required)

### Request

```
GET /identities/resolve?orgUrl={orgUrl}&displayName={displayName}
X-Client-Key: {clientKey}
```

| Parameter | Required | Description |
|-----------|----------|-------------|
| `orgUrl` | Yes | Azure DevOps organisation URL, e.g. `https://dev.azure.com/my-org` |
| `displayName` | Yes | Partial or full display name to search for |

### Response — 200 OK

```json
[
  { "id": "xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx", "displayName": "Meister Bot" },
  { "id": "yyyyyyyy-yyyy-yyyy-yyyy-yyyyyyyyyyyy", "displayName": "Meister Reviewer" }
]
```

### Error Responses

| Status | Meaning |
|--------|---------|
| 400 | `orgUrl` or `displayName` missing |
| 404 | No identity matches the display name |

---

## GET /clients/{clientId}

Fetch the current client record, including the configured `reviewerId`.

**Auth**: `X-Client-Key`
**Already available**: Yes (no backend change required)

### Request

```
GET /clients/{clientId}
X-Client-Key: {clientKey}
```

### Response — 200 OK

```json
{
  "id": "xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx",
  "displayName": "My Client",
  "isActive": true,
  "reviewerId": "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa"
}
```

`reviewerId` is `null` if no reviewer identity has been configured.

---

## PUT /clients/{clientId}/reviewer-identity

Set or replace the reviewer identity GUID for the client.

**Auth**: `X-Client-Key` (**BACKEND CHANGE REQUIRED** — currently requires `X-Admin-Key`)
**Status**: Pending backend update

### Request

```
PUT /clients/{clientId}/reviewer-identity
X-Client-Key: {clientKey}
Content-Type: application/json

{ "reviewerId": "xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx" }
```

### Response — 204 No Content

No body on success.

### Error Responses

| Status | Meaning |
|--------|---------|
| 400 | `reviewerId` is present but not a valid GUID |
| 401 | Missing or invalid `X-Client-Key` |
| 403 | `X-Client-Key` does not own this client |
| 404 | Client not found |

### Clearing the reviewer identity

Send `{ "reviewerId": "" }` or omit the field. If the backend does not accept an empty string as a clear signal, a separate `DELETE /clients/{clientId}/reviewer-identity` endpoint may be needed — this must be confirmed with the backend owner before implementing the clear path.

---

## Dependency Checklist

- [ ] Backend updates `PUT /clients/{clientId}/reviewer-identity` to accept `X-Client-Key`
- [ ] Backend confirms clear behaviour (empty string vs. separate DELETE)
- [ ] Backend regenerates `openapi.json`
- [ ] Extension syncs `api/openapi.json` and runs `npm run generate:api`
- [ ] Extension regenerates `src/generated/` before starting implementation of the save path
