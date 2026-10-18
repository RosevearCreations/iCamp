# Build 059 — Manual Gate Open/Close Override

## Status
**IMPLEMENTED — promotion verification in progress.**

## Roadmap scope
Build 059 adds the high-risk server command path for manual gate/barrier open and close overrides:
- command-specific permission control;
- required operational reason;
- recent re-authentication;
- per-actor/device rate limiting;
- append-only command evidence;
- normalized provider outcome evidence;
- complete privileged audit evidence.

## Authorization and safety
Open and close remain separate high-risk permissions:
- `gate.override.open`;
- `gate.override.close`.

The canonical Build 006 privileged-action control requires a reason and recent re-authentication. Build 059 additionally verifies the active server session against the stored session re-authentication timestamp before the database accepts a command request.

The target device must be active and declare the corresponding Build 057 capability:
- `remote_open`;
- `remote_close`.

Build 059 never bypasses physical emergency releases, fire/life-safety egress, legally required manual controls or hardware safety interlocks.

## Rate limiting
The database serializes each actor/device command stream and permits at most **3 accepted override requests per 60 seconds**. Retries using the same campground/request ID are treated as idempotent by the server command layer and do not intentionally reissue a physical command.

## Evidence
Migration `0077_manual_gate_override.sql` adds:
- `public.gate_override_requests` — immutable accepted command requests;
- `public.gate_override_outcomes` — immutable normalized provider outcomes.

Direct writes through `icamp_app`, `anon` and `authenticated` are denied. Command creation is server-only.

Provider secrets, passwords, API tokens, raw controller credentials and raw credential payloads are prohibited from both tables. Only bounded provider identifiers, command references, statuses, safe summaries and metadata are retained.

## Application contract
`lib/access-control/override.mjs` provides command, permission, capability, privileged-control and provider-outcome normalization.

`lib/access-control/postgres.mjs` provides the canonical server execution path:
1. duplicate request detection;
2. command-specific authorization;
3. device/capability validation;
4. database-enforced session freshness and rate limit;
5. immutable request + privileged audit evidence;
6. provider dispatch;
7. immutable normalized provider outcome + final audit evidence.

If no gate provider is configured, iCamp records an `unsupported` provider outcome rather than pretending a device moved.

## Build boundaries
- **Build 058** remains the monitoring/event ledger.
- **Build 060** owns enforceable access zones, schedules and subject rules.
- Build 059 does not infer access authorization from the Build 057 descriptive zone reference.

## Channel contract
- **Web/PWA:** full privileged command flow with explicit confirmation/reason and recent re-authentication.
- **IVR/DTMF:** only strongly verified staff may reach the same canonical server command; command, reason/confirmation and result must be auditable.
- **SMS/MMS:** no casual text shortcut. A privileged verified workflow or secure-link/staff-assisted handoff must invoke the same server command authority.

## Cost and portability
No paid gate provider is required. A provider-neutral adapter boundary permits free/mock testing now and future commercial controller integrations later.

## Manual action
**None required for source implementation.**

## Next build
**Build 060 — Access Zones, Schedules & Rules**
