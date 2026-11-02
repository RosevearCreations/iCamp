# Build 076 — Offline Maintenance Workspace

## Status
**FULLY PROMOTED — `main` GREEN.**

## Queue authority
Build 076 advances the active maintenance roadmap after Build 075 and implements
the historical roadmap's Build 077 offline-maintenance capability.

## Delivered scope
- authenticated Web/PWA workspace at `/workspaces/maintenance/offline`;
- cached snapshots limited to work orders assigned to the current staff user;
- cached Build 068 in-progress inspection checklists assigned to the current
  inspector;
- IndexedDB device queue for:
  - work-order notes;
  - checklist pass/fail/not-applicable answers and notes;
  - validated internal field media;
- automatic retry after connectivity returns;
- explicit pending, conflict and blocked device states;
- device-cache clear control;
- append-only durable sync receipts keyed by actor/campground/client-operation ID;
- deterministic payload fingerprints so a reused operation ID cannot silently
  apply different evidence;
- exact work-order, inspection-occurrence and inspection-result row-version
  checks before queued evidence is accepted;
- restricted `maintenance.offline.media` authority for internal maintenance
  evidence without granting broad `media.manage`;
- Build 008 file-signature, MIME, extension and size validation before secure
  storage upload;
- deterministic media identity/object key and storage cleanup on failed database
  reconciliation;
- public static service-worker fallback shell for cold-start field access without
  caching an authenticated staff page.

## Canonical authority boundaries
Build 076 does **not** create another maintenance task or inspection system.

- Build 065 remains the maintenance work-order authority.
- Build 068 remains the versioned inspection/checklist/sign-off authority.
- Build 008 remains the secure-media validation/storage model.
- Build 076 stores only device-local queue state plus append-only server sync
  receipts.
- Successful sync writes directly into the existing canonical note,
  inspection-result and work-order-media evidence tables.

## Conflict and retry model
Every queued operation receives a client UUID.

1. The server fingerprints the normalized operation payload.
2. A matching prior receipt returns `already_applied`, making retries safe.
3. Reusing the same client UUID for different evidence is rejected as a conflict.
4. Notes/media require the cached work-order row version to remain current.
5. Checklist edits require the cached inspection occurrence row version and the
   cached item-result row version to remain current.
6. A mismatch is returned as HTTP 409 and remains visible in the device queue.
7. The client never silently overwrites newer server evidence.

## Offline safety boundary
Offline mode intentionally excludes final/high-risk decisions:
- complete or cancel work orders;
- change assignees or canonical work-order status;
- submit or sign off inspections;
- create corrective work from final inspection submission;
- acknowledge/resolve escalations;
- publish public media;
- perform privileged configuration/owner approvals.

Those operations require a live authenticated server round-trip through their
existing canonical workflows.

## PWA and local-data behavior
The service worker caches:
- the manifest;
- the static Build 076 offline shell;
- the Build 076 static JavaScript and CSS.

It does **not** add the authenticated offline-maintenance page response to the
precache. The static shell reads the previously authorized IndexedDB snapshot and
pending queue. The operator can clear all Build 076 device-local data explicitly.

## Omnichannel contract
- Web/PWA: full Build 076 offline queue and reconciliation workflow.
- IVR/DTMF: no device-local offline cache; when telephone service is available it
  continues to use canonical guided maintenance commands.
- SMS/MMS: no browser offline cache; queued browser media is not converted into
  SMS/MMS. Existing verified SMS/MMS maintenance flows remain server-authoritative.
- Visual/file-heavy conflict resolution returns to Web/PWA.

## Theme architecture
Build 076 uses the existing semantic presentation variables and does not create a
theme fork. The documented standard multi-theme token/ruleset prerequisite
continues to govern future visual redesign.

## Database/security controls
- one new public append-only receipt table;
- forced RLS;
- direct `anon`/`authenticated` Data API access revoked;
- application role receives SELECT/INSERT only;
- covering indexes for campground and actor foreign keys;
- device queue contents are never persisted in the server receipt table;
- audit events identify successful offline sync operations.

## Cost / infrastructure
No new paid service, hosted project, Worker, D1 database, R2 bucket or Vercel
project is introduced. Existing Postgres, PWA and Supabase Storage infrastructure
is reused.

## Manual action
**None expected.**

## Production evidence
- `main` production SHA `970d85ad4554079f868ed4837673fe370fc2f5ec`;
- exact production push CI #39956044346, CodeQL #39956044360 and Secret Scan #39956044408 all GREEN;
- hosted `offline_maintenance_workspace` migration and repository verification SQL passed;
- Supabase Security Advisor returned zero findings.

## Next build after successful promotion
**Build 077 — Camper Assistance Request Interface**, advancing historical
Build 078.
