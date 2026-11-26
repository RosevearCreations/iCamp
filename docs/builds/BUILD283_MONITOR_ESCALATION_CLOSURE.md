# Build 283 — scheduled provider delivery monitoring and independent closure

Migration 0257 adds private immutable scheduler samples, reserved transport
attempts, outcomes and separate closure records. The protected Sysop dashboard
never treats HTTP submission or an old sample as current recovery.

## Activation and limits

The route POST /api/internal/build283-monitor is disabled unless production
ICAMP283_MONITOR_ENABLED=true and a private 32–256 character
ICAMP283_MONITOR_SECRET is configured. An independently administered scheduler
must invoke it with the bearer secret over HTTPS. No scheduler is enrolled
by the release. Use the original production database only after confirming
identity and applying migration 0257 with the approved migration runner.

Set ICAMP283_AUTO_ESCALATION=true only after independently authorizing the
existing Build 282 provider endpoint, token and provider ID. The monitor
reuses that fixed transport, never accepts a destination from the request,
and only submits previously opened original incidents. It reserves attempts
before sending, limits each run to three incidents and each incident to
three attempts at least one hour apart. A crashed attempt remains counted.
The Build 282 incident idempotency key is unchanged. Missing or invalid
signed delivery remains HOLD; recorded receipts stop automatic retries.
There is no automated owner login, incident opening, or production restore.

A separate authorized AAL2 operator may close a historical incident only
after rechecking its original signed delivery receipt, a newer matching
provider/source restore acknowledgment, current seven-source monitoring and
owner MFA. Closure is a historical review, not continuing certification.

A scheduled invocation, genuine provider delivery, migration adoption and
independent field review remain unverified until original evidence exists.
