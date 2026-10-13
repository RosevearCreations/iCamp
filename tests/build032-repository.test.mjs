import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const migration = await readFile(
  new URL(
    "../database/migrations/0040_booking_calendar_date_rules.sql",
    import.meta.url,
  ),
  "utf8",
);
const verify = await readFile(
  new URL(
    "../database/verify/0040_booking_calendar_date_rules.sql",
    import.meta.url,
  ),
  "utf8",
);
const service = await readFile(
  new URL("../lib/booking-rules/postgres.mjs", import.meta.url),
  "utf8",
);
const page = await readFile(
  new URL(
    "../app/workspaces/management/campgrounds/booking-rules/page.tsx",
    import.meta.url,
  ),
  "utf8",
);
const actions = await readFile(
  new URL(
    "../app/workspaces/management/campgrounds/booking-rules/actions.ts",
    import.meta.url,
  ),
  "utf8",
);
const campgroundPage = await readFile(
  new URL("../app/workspaces/management/campgrounds/page.tsx", import.meta.url),
  "utf8",
);
const build = await readFile(
  new URL("../docs/BUILD_032.md", import.meta.url),
  "utf8",
);
const queue = await readFile(
  new URL("../docs/BUILD_QUEUE.md", import.meta.url),
  "utf8",
);

test("Build 032 persists protected campground booking rules", () => {
  assert.match(migration, /create table public\.campground_booking_rules/u);
  assert.match(migration, /create table public\.booking_calendar_periods/u);
  assert.match(migration, /check_in_time/u);
  assert.match(migration, /minimum_booking_lead_days/u);
  assert.match(migration, /minimum_stay_nights/u);
  assert.match(migration, /weekend_iso_days/u);
  assert.match(
    migration,
    /alter table public\.campground_booking_rules force row level security/u,
  );
  assert.match(
    migration,
    /alter table public\.booking_calendar_periods force row level security/u,
  );
  assert.doesNotMatch(
    migration,
    /grant select, insert, update, delete on public\.campground_booking/u,
  );
  assert.match(verify, /must not be deletable by icamp_app/u);
});

test("Build 032 preserves calendar evidence and rejects overlapping seasons", () => {
  assert.match(migration, /guard_booking_calendar_period_mutation/u);
  assert.match(migration, /prevent_booking_season_overlap/u);
  assert.match(migration, /pg_advisory_xact_lock/u);
  assert.match(service, /campground\.booking_calendar_period\.create/u);
  assert.match(service, /campground\.booking_calendar_period\.archive/u);
  assert.match(service, /appendAuditEvent/u);
});

test("Build 032 exposes visible rule management and preview UI", () => {
  assert.match(page, /Booking calendar &amp; date rules/u);
  assert.match(page, /Save booking rules/u);
  assert.match(page, /Holiday & season calendar/u);
  assert.match(page, /Rule preview/u);
  assert.match(page, /Evaluate dates/u);
  assert.match(actions, /saveBookingRulePolicy/u);
  assert.match(actions, /createBookingCalendarPeriod/u);
  assert.match(actions, /archiveBookingCalendarPeriod/u);
  assert.match(campgroundPage, /Open booking calendar & date rules/u);
});

test("Build 032 keeps availability and pricing in their later boundaries", () => {
  assert.match(build, /Build 035/u);
  assert.match(build, /Build 039/u);
  assert.match(build, /Web\/PWA/u);
  assert.match(build, /IVR\/DTMF/u);
  assert.match(build, /SMS\/MMS/u);
  assert.match(build, /no new paid service/u);
});

test("Build 032 production closeout advances the active queue", () => {
  assert.match(build, /FULLY PROMOTED — `main` GREEN/u);
  assert.match(build, /production PR #128/u);
  assert.match(build, /76019fd0ba807f89240556c6e5f02208b601dca1/u);
  assert.match(build, /20261013161558/u);
  assert.match(build, /zero findings/u);
  assert.match(build, /no manual user action was required/iu);
  assert.match(
    queue,
    /Build 032 — Booking Calendar & Date Rules[\s\S]*FULLY PROMOTED — `main` GREEN[\s\S]*Build 034 — Accommodation Compatibility Engine[\s\S]*FULLY PROMOTED — `main` GREEN/u,
  );
});
