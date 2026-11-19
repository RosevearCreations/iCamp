# iCamp Build 264 — Original Migration Certification, Guest Rental Reservation and Supervised Pilot

## Delivered source
- PostgreSQL migration 0240 creates one audited source-equipment reservation for an owned, reviewed guest stay. Physical-equipment only, tenant-scoped, row-locked against overlaps, bounded dates, safe cancellation, immutable original evidence, FORCE RLS and no direct client grants.
- A separate immutable independent staff review records HOLD or INTERNAL PILOT ACCEPTED for an original supervised session. Reviewer cannot be its creator; needs both rental.manage and staff.manage. No horse self-service, ticket, staff dispatch or live payment.
- Guests can read their own staff-reserved physical source asset; management may approve/cancel original source reservations and review independent guided-session safety.
- Cross-workflow SQL guards prevent guest plan withdrawal/decline or insertion of a guided session that conflicts with a currently reserved physical item.
- Read-only original Production PostgreSQL inspections compare exact 0192, 0239 and 0240 SQL SHA-256 source bytes, ledger names, FORCE RLS, original triggers and app role grants. Works only with an actual Production database host pinned separately in deployment; no production migration is applied automatically.

## Sysop statistics and seven-app handoff
- Uses existing encrypted-token-gated, Ed25519 signed aggregate endpoint GET /internal/rosevear/sysop/telemetry/v1 (protocol 1.1).
- With explicit protected ROSEVEAR_SYSOP_TELEMETRY_ENABLE_DB_AGGREGATES=true and a matching independently configured Production DB host pin, reports real aggregate queue depth, last 60-second successful/failed jobs and active unrevoked session counts.
- Read-only metrics are sampled AFTER token authentication. Missing data remains null. No cross-tenant identities, personal records, payment data, messages, photos, credentials or raw logs are transmitted.
- Process uptime is not original Windows host boot evidence; reboot is unverified. No remote reboot, account change, payment, mail, gate unlock or automation action.
- Coordination requirements in docs/integration/BUILD264_SEVEN_APP_SYSOP_HANDOFF.md. Three Masters: AI Data Platform, Comms Hub, AI Hub. Four Slaves: iCamp, YW, Rosie Dazzlers, Devil n Dove.

## Acceptance and limitations
- Source release GREEN requires protected main CI and exact SHA Vercel Production READY.
- Production migration certification requires actual source-pinned DB inspection and separate original custody proof. Ephemeral CI PostgreSQL does not prove Production migrated.
- No real payment provider capture/refund, independent bank settlement, equipment handover, horse insurance, qualified live instructor, guest waiver, customer ticket, statutory filing or host reboot has been verified by this release.
- Pilot review is INTERNAL only. A real live customer pilot requires original venue, equipment, qualified operator and insurance evidence, and separately authorized owner sign-off.
- Feature acceptance percentage increases must be evidence-based. The owner requests material 5–10 point gains per coherent feature milestone; do not alter estimates simply to force that result. Merge fragments into a larger build, or disclose the shortfall.
- Every new feature retains status distinctions SOURCE / ORIGINAL PROD VERIFIED / LIVE ACTIVATED / HOLD.

## Next proposed
iCamp Build 265 — Original rental custody and pickup, guest safety consent and live supervised pilot/7-app receiver receipts, separate payment and Windows-host gates.
