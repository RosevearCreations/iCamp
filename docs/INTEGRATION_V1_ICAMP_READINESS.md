# iCamp — Rosevear Integration Contract v1 / QL-243

The AI Data Platform alone brokers cross-app integration. iCamp provides **only** server-side, authenticated, nonproduction readiness checks and cannot read another company's database. No real inter-app connection, independent owner witness, external call, SMS, reservation lookup, or gate operation has been enabled. **State: DISCONNECTED / HOLD.**

## Supported routes and permissions

- `GET /api/integration/v1/health`
- `GET /api/integration/v1/capabilities` (always returns an empty allowlist)
- All other methods return 405; query strings, redirects and non-GET requests are rejected. No events, commands, customer data, site/reservation lookup, gate controls or outbound integrations.

`GET /api/integration/v1/audit/receipts/{receipt_id}` is an **AI Data Platform** route only. iCamp does not create or verify gateway Ed25519 receipts, independently attest an owner identity, or operate the Comms Hub four-GET test.

## Server-only config (NOT browser variables)

| Environment name | Requirement |
| --- | --- |
| `ICAMP_INTEGRATION_V1_ENABLED` | `true` **only after separately approved nonproduction setup**; otherwise HOLD |
| `ICAMP_INTEGRATION_V1_ENVIRONMENT` | Exact `nonproduction` |
| `ICAMP_INTEGRATION_V1_KEY_ID` | Three–80 character identifier; unique per tenant and test source |
| `ICAMP_INTEGRATION_V1_TENANT_ID` | One exact lowercase iCamp campground UUID for this configured key |
| `ICAMP_INTEGRATION_V1_HMAC_KEY_B64` | Base64-encoded **32 random bytes**, provided through an approved server secret manager; never commit, log or place in test fixtures |
| `VERCEL_ENV` | Must be `preview` or `development`; production is always denied |
| `DATABASE_URL` | Existing iCamp server-only PostgreSQL connection; private receipt tables must be migrated |

Rotate or revoke the configured key by disabling integration, replacing the key ID and secret through a secure process, and separately verifying the new active test scope. Old signed requests fail with mismatched key ID or signature. Only one key/tenant entry per running instance is supported today; the multi-tenant credential registry and independent receipt signing remain AI Data Platform responsibilities.

## Canonical QL-243 request

Require these exact headers: `X-Rosevear-Contract: rosevear.integration.v1`, `X-Rosevear-Environment: nonproduction`, `X-Rosevear-Source: ai-data-platform`, `X-Rosevear-Destination: icamp`, `X-Rosevear-Business: icamp`, `X-Rosevear-Tenant: <the scoped campground UUID>`, `X-Rosevear-Key-Id`, `X-Rosevear-Timestamp` (13-digit Unix milliseconds), `X-Rosevear-Nonce` (`np-` plus 32 lowercase random hex), `X-Rosevear-Signature` (43-character unpadded base64url HMAC-SHA256).

Canonical UTF-8, 12 lines joined with `\n` and no final newline:

```text
rosevear.integration.v1
GET
/api/integration/v1/health
<13-digit Unix epoch milliseconds>
np-<32 lowercase hex>
ai-data-platform
icamp
icamp
<the exact campground UUID>
nonproduction
e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855
<scoped key ID>
```

Sign with the 32-byte decoded secret and base64url without padding; verify constant-time. Only requests at most 300 seconds old pass. The gateway must apply DNS/egress/TLS/rate-limit controls separately. Nonproduction GETs do not imply owner authorization for reads or writes. The older Build 134 ad hoc header/hex format is intentionally rejected.

## Durability and evidence

`icamp_private.integration_ql243_request_receipts` uses atomic unique `(source_system,business_id,campground_id,key_id,nonce)` and forced RLS. Private denial receipts contain only status code and exact path (no keys or raw headers), both tables are append-only and visible only to restricted DB roles. `HOLD` is returned even when a valid read-only handshake succeeds. A database outage prevents acceptance.

Proof still **not implemented/independently verified**: live nonproduction origin, gateway's signed health/caps receipts, gateway audit read twice after restart, separate owner/witness/gateway SPKI pins, central per-source credential registry, independent reviewer, owner pilot decision. Do not invent receipt IDs or claim GREEN external connectivity before QL-243's independent owner gates are fulfilled.
