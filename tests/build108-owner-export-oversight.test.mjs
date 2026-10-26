import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  normalizeOversightScope,
  normalizeOversightWindow,
  classifyExceptionOversight,
} from "../lib/permanent-unit-owner-retention/oversight-core.mjs";

const source = "108b0000-0000-4000-8000-000000000001";
const target = "108b0000-0000-4000-8000-000000000002";
const outsider = "108b0000-0000-4000-8000-000000000003";
const now = new Date("2026-10-25T14:00:00.000Z");
const read = (file) =>
  readFileSync(new URL(file, import.meta.url), "utf8").toLowerCase();

test("oversight time windows only permit explicit bounded choices", () => {
  assert.equal(normalizeOversightWindow(30), 30);
  assert.equal(normalizeOversightWindow("90"), 90);
  assert.equal(normalizeOversightWindow(180), 180);
  for (const input of [0, "all", -90, 10000, "90days", Infinity])
    assert.equal(normalizeOversightWindow(input), 90);
});

test("all authorized pairs or exact dual campground scope: never half-scoped or forged", () => {
  assert.deepEqual(normalizeOversightScope("", "", [source, target]), {
    source: null,
    target: null,
  });
  assert.deepEqual(normalizeOversightScope(source, target, [source, target]), {
    source,
    target,
  });
  for (const [a, b] of [
    [source, ""],
    ["", target],
    [source, source],
    [source, outsider],
    [outsider, target],
  ])
    assert.throws(() => normalizeOversightScope(a, b, [source, target]));
});

test("owner oversight classifies observed case lifecycle without auto-closure", () => {
  const past = "2026-10-24T14:00:00.000Z";
  const future = "2026-10-26T14:00:00.000Z";
  assert.equal(
    classifyExceptionOversight({ accepted: true, actionDueAt: past }, now),
    "closed",
  );
  assert.equal(
    classifyExceptionOversight({ outcomeKind: "review_ready" }, now),
    "review_pending",
  );
  assert.equal(
    classifyExceptionOversight(
      { outcomeKind: "review_ready", outcomeReviewKind: "needs_followup" },
      now,
    ),
    "returned",
  );
  assert.equal(
    classifyExceptionOversight({ actionDueAt: past }, now),
    "overdue",
  );
  assert.equal(
    classifyExceptionOversight(
      { outcomeKind: "escalated", nextDueAt: past },
      now,
    ),
    "overdue",
  );
  assert.equal(
    classifyExceptionOversight(
      { outcomeKind: "escalated", nextDueAt: future },
      now,
    ),
    "escalated",
  );
  assert.equal(
    classifyExceptionOversight({ actionDueAt: future }, now),
    "open",
  );
});

test("report is strictly owner-scoped and read-only; aggregate and detail coverage are distinct", () => {
  const pg = read(
    "../lib/permanent-unit-owner-retention/oversight-postgres.mjs",
  );
  const page = read(
    "../app/workspaces/management/campgrounds/permanent-units/financing/owner-portfolio/planning/outcomes/review/evidence/retention/exceptions/oversight/page.tsx",
  );
  for (const phrase of [
    "getcampgroundauthorization",
    'includes("owner_admin")',
    'includes("permanent_unit.transfer")',
    "begin read only",
    "set local role icamp_app",
    "set_config('icamp.user_id'",
    "source_campground_id=any($1::uuid[])",
    "target_campground_id=any($1::uuid[])",
    "scoped_cases",
    "case_states",
    "count(*)::int as cases_opened",
    "group by export_acceptance_id having count(*)>1",
    "group by source_campground_id,target_campground_id,issue_kind having count(*)>1",
    "retention_due_at <= $5::timestamptz",
    "limit 101",
    "limit 51",
    "owners.slice(0, 50)",
    "caseslimited",
    "groupslimited",
    "campgroundslimited",
    "date_trunc('week'",
  ])
    assert.ok(pg.includes(phrase), `missing report assurance: ${phrase}`);
  for (const forbidden of [
    "insert into",
    "update public.",
    "delete from",
    "security definer",
    "accepted_by_user_id as applicant",
  ])
    assert.ok(
      !pg.includes(forbidden),
      `unexpected mutation/disclosure: ${forbidden}`,
    );
  assert.match(page, /requirestaff\(pagepath\)/);
  assert.match(page, /helptopic="permanent.owner-export-oversight"/);
  assert.match(page, /report\.caseslimited/);
  assert.match(page, /report\.groupslimited/);
  assert.match(page, /report\.campgroundslimited/);
  assert.match(page, /exceptionspath/);
  const help = read("../lib/help/topics.ts");
  assert.ok(help.includes('"permanent.owner-export-oversight"'));
});

test("data access retains existing forced dual-campground policy without new public grants", () => {
  const migration = read(
    "../database/migrations/0139_owner_export_oversight_reporting_indexes.sql",
  );
  const verification = read(
    "../database/verify/0139_owner_export_oversight_reporting_indexes.sql",
  );
  assert.equal(
    (migration.match(/create index if not exists/g) ?? []).length,
    3,
  );
  assert.match(verification, /relforcerowsecurity/);
  assert.match(verification, /update,delete/);
  for (const forbidden of [
    "create table",
    "grant ",
    "create policy",
    "security definer",
  ])
    assert.ok(!migration.includes(forbidden));
  const exceptionMigration = read(
    "../database/migrations/0138_owner_export_exception_followup_closeout.sql",
  );
  const retentionMigration = read(
    "../database/migrations/0137_owner_export_reconciliation_retention.sql",
  );
  for (const sql of [exceptionMigration, retentionMigration]) {
    assert.match(sql, /force row level security/);
    assert.match(sql, /is_campground_finance_owner\(source_campground_id\)/);
    assert.match(sql, /is_campground_finance_owner\(target_campground_id\)/);
    assert.match(sql, /grant select,insert/);
  }
});
