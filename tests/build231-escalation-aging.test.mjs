import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import {
  canRecordHandoffFollowup,
  evaluateHandoffSla,
  normalizeHandoffFollowup,
} from "../lib/amenity-handoffs/core.mjs";

const file = (path) =>
  readFileSync(new URL(`../${path}`, import.meta.url), "utf8");
const createdAt = "2026-11-08T12:00:00.000Z";
const base = {
  kind: "shift_handoff",
  priority: "urgent",
  status: "open",
  createdAt,
};

test("Build 231 escalation clocks classify due-soon and overdue without resetting on reassignment", () => {
  assert.deepEqual(evaluateHandoffSla(base, "2026-11-08T12:30:00.000Z"), {
    state: "on_track",
    phase: "acknowledgement",
    dueAt: "2026-11-08T13:00:00.000Z",
    ageMinutes: 30,
    remainingMinutes: 30,
  });
  const due = evaluateHandoffSla(base, "2026-11-08T12:50:00.000Z");
  assert.equal(due.state, "due_soon");
  assert.equal(due.remainingMinutes, 10);
  assert.equal(
    evaluateHandoffSla(base, "2026-11-08T13:00:00.001Z").state,
    "overdue",
  );
  const overdue = evaluateHandoffSla(
    { ...base, updatedAt: "2026-11-08T14:00:00Z" },
    "2026-11-08T13:01:00.000Z",
  );
  assert.equal(overdue.state, "overdue");
  assert.equal(overdue.dueAt, "2026-11-08T13:00:00.000Z");
  assert.equal(
    evaluateHandoffSla({ ...base, status: "closed" }, "2026-11-09T12:00:00Z")
      .state,
    "complete",
  );
  assert.equal(
    evaluateHandoffSla({ ...base, createdAt: "not a date" }).state,
    "unknown",
  );
});

test("Build 231 tracks acknowledgement and guest-owner decision independently", () => {
  const acknowledged = evaluateHandoffSla(
    { ...base, status: "acknowledged", acknowledgedAt: "2026-11-08T12:30:00Z" },
    "2026-11-08T14:00:00Z",
  );
  assert.equal(acknowledged.phase, "follow_through");
  assert.equal(acknowledged.dueAt, "2026-11-08T16:30:00.000Z");

  const owner = evaluateHandoffSla(
    {
      ...base,
      kind: "guest_review",
      status: "acknowledged",
      acknowledgedAt: "2026-11-09T12:00:00Z",
    },
    "2026-11-08T16:01:00Z",
  );
  assert.equal(owner.phase, "owner_review");
  assert.equal(owner.dueAt, "2026-11-08T16:00:00.000Z");
  assert.equal(owner.state, "overdue");
  const important = evaluateHandoffSla(
    { ...base, priority: "important" },
    "2026-11-08T13:00:00Z",
  );
  assert.equal(important.dueAt, "2026-11-08T16:00:00.000Z");
  const normal = evaluateHandoffSla(
    { ...base, priority: "normal", kind: "guest_review" },
    "2026-11-08T13:00:00Z",
  );
  assert.equal(normal.dueAt, "2026-11-11T12:00:00.000Z");
});

test("Build 231 enforces event shape, revision, ownership and no publication claims", () => {
  assert.throws(
    () =>
      normalizeHandoffFollowup({
        eventKind: "publish",
        note: "Review needed",
        expectedRowVersion: 1,
      }),
    /type/,
  );
  assert.throws(
    () =>
      normalizeHandoffFollowup({
        eventKind: "guest_followup",
        outcome: "published",
        note: "Review needed",
        expectedRowVersion: 1,
      }),
    /outcome/,
  );
  assert.throws(
    () =>
      normalizeHandoffFollowup({
        eventKind: "escalation",
        outcome: "verified_no_change",
        note: "Review needed",
        expectedRowVersion: 1,
      }),
    /cannot claim/,
  );
  assert.throws(
    () =>
      normalizeHandoffFollowup({
        eventKind: "escalation",
        note: "Short",
        expectedRowVersion: 1,
      }),
    /8–500/,
  );
  assert.throws(
    () =>
      normalizeHandoffFollowup({
        eventKind: "escalation",
        note: "Proper note",
        expectedRowVersion: 0,
      }),
    /Refresh/,
  );
  assert.deepEqual(
    normalizeHandoffFollowup({
      eventKind: "guest_followup",
      outcome: "needs_more_evidence",
      note: "  Await manager photos  ",
      expectedRowVersion: "4",
    }),
    {
      eventKind: "guest_followup",
      outcome: "needs_more_evidence",
      note: "Await manager photos",
      expectedRowVersion: 4,
    },
  );
  const actor = {
    kind: "shift_handoff",
    status: "open",
    canAssign: false,
    canComplete: false,
    canPublish: false,
  };
  assert.equal(
    canRecordHandoffFollowup({ ...actor, eventKind: "escalation" }),
    false,
  );
  assert.equal(
    canRecordHandoffFollowup({
      ...actor,
      eventKind: "escalation",
      canAssign: true,
    }),
    true,
  );
  assert.equal(
    canRecordHandoffFollowup({
      ...actor,
      eventKind: "escalation",
      canComplete: true,
    }),
    true,
  );
  assert.equal(
    canRecordHandoffFollowup({
      ...actor,
      eventKind: "guest_followup",
      canPublish: true,
    }),
    false,
  );
  assert.equal(
    canRecordHandoffFollowup({
      ...actor,
      eventKind: "guest_followup",
      kind: "guest_review",
      canPublish: true,
    }),
    true,
  );
  assert.equal(
    canRecordHandoffFollowup({
      ...actor,
      eventKind: "guest_followup",
      kind: "guest_review",
      canPublish: true,
      status: "closed",
    }),
    false,
  );
});

test("Build 231 migration is scoped, append-only, permissioned and does not alter guest service information", () => {
  const migration = file(
    "database/migrations/0218_build231_amenity_escalation_followup_events.sql",
  );
  assert.match(
    migration,
    /create table public\.amenity_handoff_followup_events/i,
  );
  assert.match(
    migration,
    /foreign key \(organization_id,campground_id,handoff_id\)/i,
  );
  assert.match(migration, /force row level security/i);
  assert.match(
    migration,
    /grant select,insert on public\.amenity_handoff_followup_events to icamp_app/i,
  );
  assert.doesNotMatch(
    migration,
    /grant (update|delete|all) on public\.amenity_handoff_followup_events to icamp_app/i,
  );
  assert.match(migration, /h\.status <> 'closed'/i);
  assert.match(
    migration,
    /h\.row_version=amenity_handoff_followup_events\.handoff_row_version/i,
  );
  assert.match(migration, /h\.kind='guest_review'/i);
  assert.match(migration, /campground\.map\.publish/i);
  assert.doesNotMatch(
    migration,
    /update .*wayfinding_publications|alter table .*wayfinding_publications/i,
  );
});

test("Build 231 backend validates tenant, revision and permissions, then audits private follow-up", () => {
  const backend = file("lib/amenity-handoffs/postgres.mjs");
  assert.match(backend, /async function followupMigrationReady/);
  assert.match(backend, /recordAmenityHandoffFollowup/);
  assert.match(
    backend,
    /where id=\$1 and campground_id=\$2 limit 1 for update/,
  );
  assert.match(
    backend,
    /Number\(before\.row_version\) !== decision\.expectedRowVersion/,
  );
  assert.match(backend, /canRecordHandoffFollowup/);
  assert.match(
    backend,
    /created_at > statement_timestamp\(\) - interval '15 minutes'/,
  );
  assert.match(backend, /insert into public\.amenity_handoff_followup_events/);
  assert.match(backend, /appendAuditEvent\(client/);
  assert.match(backend, /await client\.query\("reset role"\)/);
  assert.doesNotMatch(backend, /update .*wayfinding_publications/i);
});

test("Build 231 UI exposes deadline filters, review follow-up and migration fallback", () => {
  const page = file(
    "app/workspaces/management/campgrounds/amenity-status/handoffs/page.tsx",
  );
  const actions = file(
    "app/workspaces/management/campgrounds/amenity-status/handoffs/actions.ts",
  );
  assert.match(page, /evaluateHandoffSla/);
  assert.match(page, /Overdue response targets/);
  assert.match(page, /Due soon/);
  assert.match(page, /!ledger\.followupReady/);
  assert.match(page, /canRecordHandoffFollowup/);
  assert.match(page, /recordAmenityFollowupAction/);
  assert.match(page, /Record escalation/);
  assert.match(page, /Save owner follow-up/);
  assert.match(page, /publication remains separate/i);
  assert.match(actions, /requireStaff\(path\)/);
  assert.match(actions, /revalidatePath\(path\)/);
});
