import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import {
  handoffActorCanAct,
  normalizeHandoffCreate,
  normalizeHandoffDecision,
} from "../lib/amenity-handoffs/core.mjs";

const file = (path) =>
  readFileSync(new URL(`../${path}`, import.meta.url), "utf8");

test("Build 230 rejects invalid or unreadable handoff content", () => {
  assert.throws(
    () =>
      normalizeHandoffCreate({
        kind: "guessed",
        summary: "Valid issue",
        nextAction: "Take action",
      }),
    /type/,
  );
  assert.throws(
    () =>
      normalizeHandoffCreate({
        kind: "shift_handoff",
        priority: "emergency",
        summary: "Valid issue",
        nextAction: "Take action",
      }),
    /priority/,
  );
  assert.throws(
    () =>
      normalizeHandoffCreate({
        kind: "shift_handoff",
        summary: "Short",
        nextAction: "Take action",
      }),
    /8–500/,
  );
  assert.throws(
    () =>
      normalizeHandoffCreate({
        kind: "shift_handoff",
        summary: "A\u0000protected issue",
        nextAction: "Take action",
      }),
    /readable/,
  );
  assert.throws(
    () =>
      normalizeHandoffCreate({
        kind: "guest_review",
        summary: "A".repeat(501),
        nextAction: "Take action",
      }),
    /8–500/,
  );
  assert.deepEqual(
    normalizeHandoffCreate({
      kind: "shift_handoff",
      priority: "urgent",
      summary: "  Pool filter needs inspection  ",
      nextAction: "  Ask supervisor to inspect  ",
    }),
    {
      kind: "shift_handoff",
      priority: "urgent",
      summary: "Pool filter needs inspection",
      nextAction: "Ask supervisor to inspect",
    },
  );
});

test("Build 230 requires revisions and a meaningful close decision", () => {
  assert.throws(
    () => normalizeHandoffDecision({ action: "reopen", expectedRowVersion: 2 }),
    /action/,
  );
  assert.throws(
    () => normalizeHandoffDecision({ action: "assign", expectedRowVersion: 0 }),
    /Refresh/,
  );
  assert.throws(
    () =>
      normalizeHandoffDecision({
        action: "close",
        expectedRowVersion: 2,
        resolutionNote: "Done",
      }),
    /8–500/,
  );
  assert.deepEqual(
    normalizeHandoffDecision({
      action: "close",
      expectedRowVersion: "12",
      resolutionNote: "  Checked with campground office  ",
    }),
    {
      action: "close",
      expectedRowVersion: 12,
      resolutionNote: "Checked with campground office",
    },
  );
});

test("Build 230 enforces independent assignment, acknowledgement and owner review authority", () => {
  const base = {
    kind: "shift_handoff",
    status: "open",
    actorId: "alice",
    assignedToUserId: "bob",
    canAssign: false,
    canComplete: false,
    canPublish: false,
  };
  assert.equal(handoffActorCanAct({ ...base, action: "assign" }), false);
  assert.equal(handoffActorCanAct({ ...base, action: "acknowledge" }), false);
  assert.equal(
    handoffActorCanAct({ ...base, action: "acknowledge", actorId: "bob" }),
    true,
  );
  assert.equal(
    handoffActorCanAct({ ...base, action: "assign", canAssign: true }),
    true,
  );
  assert.equal(
    handoffActorCanAct({ ...base, action: "close", canComplete: true }),
    true,
  );
  assert.equal(
    handoffActorCanAct({
      ...base,
      action: "close",
      kind: "guest_review",
      canComplete: true,
    }),
    false,
  );
  assert.equal(
    handoffActorCanAct({
      ...base,
      action: "close",
      kind: "guest_review",
      canPublish: true,
    }),
    true,
  );
  assert.equal(
    handoffActorCanAct({
      ...base,
      action: "close",
      status: "closed",
      canPublish: true,
    }),
    false,
  );
});

test("Build 230 migration provides private tenant-scoped, versioned workflow persistence", () => {
  const sql = file(
    "database/migrations/0217_build230_amenity_shift_handoff_ledger.sql",
  );
  assert.match(sql, /create table public\.amenity_shift_handoffs/i);
  assert.match(sql, /foreign key \(organization_id,campground_id,asset_id\)/i);
  assert.match(
    sql,
    /references public\.operational_assets\(organization_id,campground_id,id\)/i,
  );
  assert.match(sql, /row_version bigint not null default 1/i);
  assert.match(sql, /one_pending_guest_review/i);
  assert.match(
    sql,
    /alter table public\.amenity_shift_handoffs force row level security/i,
  );
  assert.match(sql, /create policy amenity_shift_handoffs_staff_create/i);
  assert.match(sql, /created_by_user_id = nullif/i);
  assert.match(sql, /create trigger amenity_shift_handoffs_guard/i);
  assert.match(
    sql,
    /case when old\.kind='guest_review' then can_publish else can_complete end/i,
  );
  assert.doesNotMatch(sql, /grant .* to (anon|authenticated)/i);
});

test("Build 230 backend checks tenant, active assignees, optimistic version and audit on every mutation", () => {
  const repo = file("lib/amenity-handoffs/postgres.mjs");
  assert.match(repo, /await capabilities\(actorUserId, campgroundId\)/);
  assert.match(repo, /if \(!grant\.canCreate\)/);
  assert.match(repo, /assertAssignedStaff\(campgroundId/);
  assert.match(repo, /asset_class='facility'/);
  assert.match(repo, /where id=\$1 and campground_id=\$2 limit 1 for update/);
  assert.match(repo, /before\.row_version\) !== decision\.expectedRowVersion/);
  assert.match(repo, /handoffActorCanAct\(/);
  assert.match(repo, /row_version=\$3 returning \*/);
  assert.match(repo, /appendAuditEvent\(client/);
  assert.match(repo, /reset role/);
  assert.match(repo, /set local role icamp_app/);
  assert.doesNotMatch(
    repo,
    /update icamp_private\.campground_wayfinding_publications/i,
  );
});

test("Build 230 handoff UI is staff-scoped, mobile-friendly and fail-closed if migration unavailable", () => {
  const page = file(
    "app/workspaces/management/campgrounds/amenity-status/handoffs/page.tsx",
  );
  const action = file(
    "app/workspaces/management/campgrounds/amenity-status/handoffs/actions.ts",
  );
  const css = file(
    "app/workspaces/management/campgrounds/amenity-status/handoffs/handoffs.module.css",
  );
  const board = file(
    "app/workspaces/management/campgrounds/amenity-status/page.tsx",
  );
  assert.match(page, /requireStaff\(path\)/);
  assert.match(page, /getCampgroundAuthorization/);
  assert.match(page, /!ledger\.migrationReady/);
  assert.match(page, /ledger\.permissions\.canCreate/);
  assert.match(page, /ledger\.permissions\.canAssign/);
  assert.match(page, /handoffActorCanAct/);
  assert.match(page, /Review official published service information/);
  assert.match(page, /guest information was published/);
  assert.match(action, /requireStaff\(path\)/);
  assert.match(action, /revalidatePath\(path\)/);
  assert.match(css, /@media \(max-width: 760px\)/);
  assert.match(board, /Shift handoffs &amp; guest review queue/);
});
