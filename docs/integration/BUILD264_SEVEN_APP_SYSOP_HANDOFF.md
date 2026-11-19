# iCamp Build 264 — Three Masters / Four Slaves: Sysop Telemetry Handoff

## Current origin
iCamp has the existing token-protected Ed25519 signed read-only GET /internal/rosevear/sysop/telemetry/v1 endpoint with protocol rosevear.sysop.statistics.v1 and exact deployed commit binding. Safe bounded production aggregate counters are added in this build only when explicitly activated and original database host pinned. The remainder are null. No actions, tenant IDs, personal data or receipts are authorized.

## Coordination needed
1. AI Data Platform Master (RosevearCreations/ai-data-platform): independently enroll per-app public key identity, bound TLS endpoint and expected exact source revision; verify nonce replay, 60-second expiry and signature; only report CONNECTED on fresh authenticated source/receiver ACK; graph measured error, queue, latency and job stats without inventing missing values.
2. Comms Hub Master (RosevearCreations/rosevear-comms-hub): show verified aggregate incident/ACK and consent-aware operator outbox; no auto-send and no key reuse, payment or reboot action.
3. Rosevear AI Hub Master (RosevearCreations/rosevear-ai-hub): collect machine-original Windows event log, Task Scheduler, VM, MQTT, Home Assistant, Caddy, Ollama and Tailscale boot/service recovery evidence; independently witnessed Windows boot is distinct from Vercel process uptime. No remote physical command without new separate owner authorization.
4. Yard Workers (RosevearCreations/yw): sign source aggregate job, scheduling, queue, worker and field error measurements; exclude tenants, staff identities, addresses and raw logs.
5. Rosie Dazzlers (RosevearCreations/rosiedazzlers): sign bookings/wizard/manual, quote, media error and dispatch queue aggregates only; preserve no-auto-send.
6. Devil n Dove (RosevearCreations/devilndove-site): sign product draft/publish, fulfilment and social job aggregates, excluding customers, media, financial and secret fields.

Each peer should reply with: exact protected production SHA; real endpoint; public signing fingerprint provided via separate protected owner channel (NEVER GitHub); TLS identity; one fresh original signed sample; independently verified receiver ACK; known UNKNOWN/HOLD fields; incident/restart runbook. Never claim 7/7 connected or reboot verified from code alone.

iCamp requires no new cross-peer database privilege. APP telemetry is observation only, not a reboot or Sysop command. All seven applications maintain independent tenant, privacy, branch and release security.
