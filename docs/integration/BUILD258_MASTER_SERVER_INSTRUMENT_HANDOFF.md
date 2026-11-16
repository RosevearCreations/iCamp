# Build 258 — Master Server Instrument, YW/iCamp and Home Assistant boundaries

**Primary top-tier Master:** AI Data Platform (`ai-data-platform`). Other Master modules: `rosevear-ai-hub` (original Windows host, Home Assistant/MQTT, local automation and safety) and `rosevear-comms-hub` (external communication). Governed Slave Application Shells: `icamp` and `yw`. Devil n Dove and Rosie Dazzlers are direct Master-connected brand apps.

## Proposed futuristic master instrument panels
- **iCamp:** signed source SHA/time, coarse live booking-capacity counts, migration 0237 adoption status, unresolved security/workflow exception counts, connection freshness and last independently verified ACK.
- **YW:** separately signed YW service/job/route status, incidents and capacity counts from YW's own authorized source schema; never manufacture YW values from iCamp.
- **Server/host:** Home Assistant / MQTT / Ollama/Caddy/Tailscale uptime as observed by the Rosevear AI Hub original physical Windows host; current protected OFF/ON authority, storage/CPU usage and alert severity.
- **Communications:** genuine Comms Hub inbox/telephony/IVR delivery statuses and dead-letter/replay exceptions, not guessed traffic.

## Architecture
1. Each app independently produces an additive protocol 1.1, schema-versioned **non-sensitive source signal**. Read-only legacy 1.0 health remains compatible; unknown capability holds only itself.
2. Master authenticated collectors verify origin/pin/nonce/SHA/audience/TLS/tenant scope/expiry. All 3 Master modules can be visually themed together with `rosevear-master-instrument.v1` without merging deployments or sharing secrets. The two Slave Shells retain their independent themes.
3. Server shell shows `VERIFIED`, `STALE`, `UNREACHABLE`, `HOLD` based on actual signed source receipts. Missing peer never converts stale data into live.
4. Master visualization is **read-only by default**, separates data observations from action controls. Home automation commands execute ONLY from owner-approved original-host Rosevear AI Hub with confirmed role, device identity, safety policy, and audit; fail-safe boundaries exclude life-safety/physical hazards and autonomous control without explicit authorization.

## What Build 258 does and does not do
**Does:** Adds a pure reusable iCamp local source aggregate schema with source SHA/date, non-PII capacity and diagnostics, plus a staff-visible instrument preview. Its contract can be consumed by a future authenticated Master collector. Existing `/api/health/live`, `/api/version` and convergence/manifest endpoints remain unchanged.

**Does not:** Introduce a new public unauthenticated inventory metrics endpoint, write to the AI Data Platform/YW/Home Assistant repos, install a Master remote collector, prove any live YW state, publish tenant data to Masters, sign a fake event, or turn on original-host receiver.

**Master integration validation:** Implement and release an owner-authorized instrument dashboard adapter in `ai-data-platform` (and signed source producer in `yw` where needed); require source enrollment/ACK and independent proof before reporting CONNECTED. It can be developed independently while iCamp is Vercel-held because Build 408 protocol 1.1 is backward compatible.
