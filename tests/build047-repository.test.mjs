import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import {
  longTermPriceFromPlan,
  normalizeSeasonalAssignmentInput,
  normalizeSeasonalTransition,
} from "../lib/seasonal-assignments/core.mjs";

const migrationUrl = new URL(
  "../database/migrations/0056_seasonal_yearly_assignment_foundation.sql",
  import.meta.url,
);
const verifyUrl = new URL(
  "../database/verify/0056_seasonal_yearly_assignment_foundation.sql",
  import.meta.url,
);
const repositoryUrl = new URL(
  "../lib/seasonal-assignments/postgres.mjs",
  import.meta.url,
);
const pageUrl = new URL(
  "../app/workspaces/management/campgrounds/seasonal/page.tsx",
  import.meta.url,
);

test("Build 047 normalizes seasonal/yearly assignment input and package pricing", () => {
  const normalized = normalizeSeasonalAssignmentInput({
    accommodationId: "site-1",
    assignmentKind: "yearly",
    startsOn: "2027-01-01",
    endsOn: "2027-12-31",
    occupantDisplayName: "Seasonal Guest",
    ratePlanId: "rate-1",
    winterizationRequired: "on",
  });

  assert.equal(normalized.assignmentKind, "yearly");
  assert.equal(normalized.winterizationRequired, true);
  assert.equal(
    longTermPriceFromPlan(
      { seasonalCents: 250000, yearlyCents: 480000 },
      "yearly",
    ),
    480000,
  );
  assert.throws(
    () =>
      longTermPriceFromPlan(
        { seasonalCents: null, yearlyCents: null },
        "seasonal",
      ),
    /no seasonal price/iu,
  );
  assert.equal(normalizeSeasonalTransition("end"), "end");
  assert.throws(
    () => normalizeSeasonalTransition("renew"),
    /transition is invalid/iu,
  );
});

test("Build 047 schema extends the authoritative assignment instead of creating parallel inventory", async () => {
  const sql = await readFile(migrationUrl, "utf8");
  assert.match(sql, /alter table public\.seasonal_assignments/u);
  assert.match(sql, /assignment_kind/u);
  assert.match(sql, /winterization_required/u);
  assert.match(sql, /create table public\.seasonal_assignment_charges/u);
  assert.match(sql, /create table public\.seasonal_assignment_events/u);
  assert.match(sql, /permanent_unit/u);
  assert.match(sql, /force row level security/u);
  assert.match(sql, /seasonal_assignment_charges_append_only/u);
  assert.match(sql, /seasonal_assignment_events_append_only/u);
  assert.doesNotMatch(
    sql,
    /create table public\.seasonal_assignment_inventory/iu,
  );
});

test("Build 047 verification protects RLS, direct access and immutable evidence", async () => {
  const sql = await readFile(verifyUrl, "utf8");
  assert.match(sql, /must FORCE RLS/u);
  assert.match(sql, /evidence must remain append-only/u);
  assert.match(sql, /immutable evidence must not be mutable/u);
  assert.match(sql, /direct authenticated access must remain denied/u);
  assert.match(sql, /seasonal\.manage write policy missing/u);
  assert.match(sql, /permanent-unit long-term pricing/u);
});

test("Build 047 repository reuses Build 035 concurrency and Build 039 price sources", async () => {
  const source = await readFile(repositoryUrl, "utf8");
  assert.match(source, /pg_advisory_xact_lock/u);
  assert.match(source, /public\.seasonal_assignments/u);
  assert.match(source, /public\.seasonal_assignment_charges/u);
  assert.match(source, /public\.seasonal_assignment_events/u);
  assert.match(source, /public\.rate_plans/u);
  assert.match(source, /seasonal\.manage/u);
  assert.match(source, /appendAuditEvent/u);
  assert.match(source, /campsite','permanent_unit/u);
});

test("Build 047 exposes long-term lifecycle, winterization handoff and safe channel parity", async () => {
  const page = await readFile(pageUrl, "utf8");
  assert.match(page, /Seasonal & yearly assignment foundation/u);
  assert.match(page, /Winterization\/readiness workflow/u);
  assert.match(page, /IVR\/DTMF/u);
  assert.match(page, /SMS\/MMS/u);
  assert.match(page, /Payment-card details are never collected/u);
});
