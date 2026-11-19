# AIDP Build 423 — iCamp Sysop telemetry source handoff

iCamp now exposes the common read-only source path `GET /internal/rosevear/sysop/telemetry/v1`.

It emits only the canonical `rosevear.sysop.statistics.v1` non-sensitive aggregate envelope and only when server-side `ROSEVEAR_SYSOP_TELEMETRY_READ_TOKEN`, `ROSEVEAR_SYSOP_TELEMETRY_PRIVATE_KEY_PEM` and the exact deployed commit are present. Missing enrollment returns NOT_ENROLLED/HOLD.

Tenant, guest, campsite, payment, message, photo, vehicle and reservation data never enter this envelope. Unknown counters are null, not zero. iCamp may report process heartbeat/restart observations but never host boot evidence. The payload cannot authorize a reboot, message, payment, recovery or data export.

Controller handoff: RosevearCreations/ai-data-platform Build 423. Coordination issue: #645.
