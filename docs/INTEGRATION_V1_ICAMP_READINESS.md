# iCamp — Rosevear Integration Contract v1 safe gateway readiness

The supplied `ROSEVEAR_INTEGRATION_CONTRACT_V1_HANDOFF` identifies **AI Data Platform** as the only integration gateway. iCamp owns its campground, site, reservation, guest and pass records. This readiness implementation introduces no live cross-business APIs or records.

## Disabled by default

The server-only endpoints are:

- `GET /api/integration/v1/health`
- `GET /api/integration/v1/capabilities`

No authentication success, customer payload, or capabilities are available until server-side owner configuration. To prepare a gated internal TESTING handshake, configure **server environment variables only** (not `NEXT_PUBLIC_*`):

| Variable | Requirement |
| --- | --- |
| `ICAMP_INTEGRATION_V1_ENABLED` | Exact string `true` after owner approval; otherwise HOLD |
| `ICAMP_INTEGRATION_V1_KEY_ID` | Gateway key identifier, 3–80 characters; rotate with its key |
| `ICAMP_INTEGRATION_V1_HMAC_SECRET` | At least 32 characters, unique for iCamp and each environment, never shared in browser/UI |
| `ICAMP_INTEGRATION_V1_ALLOWED_CAMPGROUNDS` | Explicit comma-separated UUID allowlist of campgrounds approved for TESTING |
| `ICAMP_APPLICATION_VERSION` | Optional non-secret version label |
| `DATABASE_URL` | Existing server-only iCamp DB connection, used for durable nonce receipts |

Rotating or revoking the key means changing the server environment and setting `ICAMP_INTEGRATION_V1_ENABLED=false` until a fresh owner-approved handshake. Previously signed requests are not accepted with a rotated key ID/secret.

## Signed request format

Gateway sends headers `x-rosevear-issuer: ai-data-platform`, `x-rosevear-key-id`, `x-rosevear-timestamp` (UTC ISO 8601 with milliseconds), `x-rosevear-nonce` (new UUID per request), `x-rosevear-tenant-id` (campground UUID) and `x-rosevear-signature: sha256=<lowercase 64-character hex>`.

Compute HMAC-SHA256 over exactly these newline-separated lines (no trailing newline):

```text
GET
/api/integration/v1/health
<timestamp>
<nonce>
ai-data-platform
<lowercase campground UUID>
e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855
```

The last line is SHA-256 of the empty GET request body. For `/capabilities`, substitute that exact path. Each request's server timestamp must be within five minutes of receipt. Duplicate `(issuer, key_id, nonce)` is rejected atomically with HTTP 409 by a unique private PostgreSQL receipt. Scoped but unauthorized campground UUIDs return HOLD/403. Missing config returns HOLD/503. Invalid signatures return 401 without leaking the shared secret or a customer record.

Responses provide iCamp identity, environment, `rosevear.integration.v1`, timestamp and `TESTING` state. Capabilities remain `[]`; no reservation reference lookup has been exposed. Production connection, reservation reference reads, events, commands and Comms Hub dispatch each require separate owner permission and negative tenant tests.

The database cannot independently rotate an environment secret, so key rotation remains an explicit operator task. For a later phase, add secured owner-managed grant persistence and signed receipt inspection. No automatic service activation is implied by these two endpoints.
