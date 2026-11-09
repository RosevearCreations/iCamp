import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import {
  classifyFulfillmentForecast,
  FULFILLMENT_FORECAST_HORIZON_DAYS,
  validateFulfillmentPlanningSettings,
} from "../lib/booking-charges/fulfillment-forecast-core.mjs";

const read = (path) =>
  readFileSync(new URL(`../${path}`, import.meta.url), "utf8");

const valid = {
  morningStart: "07:00",
  morningEnd: "11:00",
  afternoonStart: "12:00",
  afternoonEnd: "16:00",
  eveningStart: "17:00",
  eveningEnd: "21:00",
  maxUnitsPerStaffWindow: "8",
  expectedRowVersion: 0,
};

test("Build 237 requires explicit nonoverlapping local service windows and owner unit limits", () => {
  assert.deepEqual(validateFulfillmentPlanningSettings(valid), {
    ...valid,
    maxUnitsPerStaffWindow: 8,
  });
  assert.equal(
    validateFulfillmentPlanningSettings({
      ...valid,
      maxUnitsPerStaffWindow: "",
    }).maxUnitsPerStaffWindow,
    null,
  );
  for (const bad of [
    { morningStart: "02:00" },
    { morningEnd: "07:00" },
    { afternoonStart: "10:59" },
    { afternoonStart: "21:00" },
    { eveningEnd: "24:00" },
    { eveningStart: "21:00" },
    { maxUnitsPerStaffWindow: "0" },
    { maxUnitsPerStaffWindow: "1.5" },
    { maxUnitsPerStaffWindow: "1001" },
    { maxUnitsPerStaffWindow: "1e2" },
    { expectedRowVersion: -1 },
    { expectedRowVersion: 1.5 },
  ]) {
    assert.throws(() =>
      validateFulfillmentPlanningSettings({ ...valid, ...bad }),
    );
  }
});

test("Build 237 forecasts distinguish absent evidence, declared conflicts and real capacity limits", () => {
  const base = {
    assignedUserId: "worker-1",
    activeStaff: true,
    serviceWindow: "morning",
    windowsConfigured: true,
    declaredUnavailable: false,
    hasCoveringShift: true,
    hasOverlappingShift: true,
    units: 8,
    maxUnitsPerStaffWindow: 8,
  };
  const status = (change) =>
    classifyFulfillmentForecast({ ...base, ...change });
  assert.equal(status({}), "within_limit");
  assert.equal(status({ assignedUserId: null }), "unassigned");
  assert.equal(status({ activeStaff: false }), "inactive_staff");
  assert.equal(status({ serviceWindow: "anytime" }), "window_unspecified");
  assert.equal(status({ windowsConfigured: false }), "windows_unconfigured");
  assert.equal(status({ declaredUnavailable: true }), "declared_unavailable");
  assert.equal(status({ hasCoveringShift: false }), "partial_shift");
  assert.equal(
    status({ hasCoveringShift: false, hasOverlappingShift: false }),
    "no_shift_on_record",
  );
  assert.equal(status({ units: 9 }), "over_capacity");
  assert.equal(status({ maxUnitsPerStaffWindow: null }), "coverage_only");
  assert.equal(FULFILLMENT_FORECAST_HORIZON_DAYS, 30);
});

test("Build 237 keeps private shift reads behind schedule and campground supervisor grants", () => {
  const source = read("lib/booking-charges/fulfillment-forecast-postgres.mjs");
  const action = read(
    "app/workspaces/management/campgrounds/service-fulfillment/actions.ts",
  );
  const page = read(
    "app/workspaces/management/campgrounds/service-fulfillment/page.tsx",
  );
  assert.match(
    source,
    /"reservation\.modify", "staff\.manage", "schedule\.manage"/u,
  );
  assert.match(source, /set local role icamp_app/u);
  assert.match(source, /icamp\.user_id/u);
  assert.match(source, /icamp_private\.staff_shift_assignments/u);
  assert.match(source, /icamp_private\.staff_shift_availability/u);
  assert.match(source, /icamp_private\.staff_shift_events/u);
  assert.match(source, /e\.kind = 'cancel'/u);
  assert.match(source, /clear\.clears_event_id = a\.id/u);
  assert.match(source, /at time zone c\.timezone/u);
  assert.match(source, /j\.campground_id = \$1/u);
  assert.match(
    source,
    /group by j\.service_date, j\.service_window, a\.assigned_user_id/u,
  );
  assert.match(source, /limit 251/u);
  assert.match(source, /for update/u);
  assert.match(source, /appendAuditEvent/u);
  assert.match(action, /"schedule\.manage"/u);
  assert.match(page, /Shift outlook/u);
  assert.match(page, /No campground service-window policy is configured/u);
  assert.match(page, /Forecasts are advisory/u);
  assert.match(page, /does not alter booked charges or employee shifts/u);
  assert.doesNotMatch(source, /update icamp_private\.staff_shift_assignments/u);
});

test("Build 237 database RLS prevents cross-tenant configuration and untrusted staff edits", () => {
  const migration = read(
    "database/migrations/0222_build237_fulfillment_shift_forecasts.sql",
  );
  const verify = read(
    "database/verify/0222_build237_fulfillment_shift_forecasts.sql",
  );
  assert.match(migration, /primary key \(organization_id, campground_id\)/u);
  assert.match(migration, /force row level security/u);
  assert.match(migration, /created_at\) is distinct from/u);
  assert.match(migration, /staff\.manage/u);
  assert.match(migration, /schedule\.manage/u);
  assert.match(migration, /reservation\.modify/u);
  assert.match(
    migration,
    /updated_by_user_id = icamp_private\.request_user_id\(\)/u,
  );
  assert.match(migration, /service_fulfillment_planning_settings_touch/u);
  assert.doesNotMatch(
    migration,
    /grant\s+.*delete on public\.service_fulfillment_planning_settings/iu,
  );
  assert.match(verify, /forced RLS missing/u);
  assert.match(verify, /scope\/version guards missing/u);
});
