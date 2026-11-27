# Build 284 — scheduler discovery and controlled relay failover

Migration 0258 records authenticated scheduler observations and deduplicated
recovery discoveries. Only original signed historical acknowledgments qualify.
Readback failures are not proof of compromise. The scheduler cannot impersonate
an AAL2 reviewer; discoveries are surfaced for authorized Build 282 opening.
The existing independent closure gate is unchanged.

POST /api/internal/build284-monitor is production-only and opt-in using
ICAMP284_SCHEDULER_ENABLED and ICAMP284_SCHEDULER_SECRET. No scheduler is
enrolled by this code. A separate approved runner must invoke it. No genuine
original database migration, provider receipt or scheduler is claimed.

Optional secondary relay uses ICAMP284_RELAY_ENABLED, ICAMP284_RELAY_URL,
ICAMP284_RELAY_TOKEN and ICAMP284_SHARED_IDEMPOTENCY_CONFIRMED. The same original
provider identity and signing key remain required. This is transport relay
failover, not enrollment of a second independent signing provider. The relay
must actually share global incident idempotency with the primary before
activation. No new destination is accepted from user input. Existing
three-attempt and one-hour cooldown limits remain. HTTP acceptance is not
delivery. A new independent provider requires separate trusted enrollment.

## Source of Truth adoption: first product journey

After protected Build 284 promotion, establish the Camp Rosevear Site 12
baseline: guest phone plus staff tablet, authorized aerial map, free fault and
paid firewood, distinct work indicators, reconnect, resolve only one, verify
folio/inventory/ledger and cross-tenant denial. Use existing test accounts and
disposable data; never charge real payment methods. Select the next build from
the first observed failed step. Do not assume prior map or booking code proves
the full workflow. Keep release health, observed journeys, and original field
acceptance separate.
