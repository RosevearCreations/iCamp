import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import {
  FORWARD_FORECAST_MODEL,
  buildForwardOccupancyForecast,
  forwardOccupancyCsv,
  shiftForecastMonth,
} from "../lib/command-centre/forward-occupancy-core.mjs";

const file = (path) => readFileSync(new URL(path, import.meta.url), "utf8");
const kinds = ["campsite", "rental_cottage", "permanent_unit"];
const first = "2024-09-01";
const months = Array.from({ length: 27 }, (_, index) =>
  shiftForecastMonth(first, index),
);
const days = (month) => {
  const [year, monthNumber] = month.split("-").map(Number);
  return new Date(Date.UTC(year, monthNumber, 0)).getUTCDate();
};
const currentInventory = { campsite: 8, rental_cottage: 2, permanent_unit: 0 };
const makeSource = () => ({
  generatedAt: "2026-11-03T12:00:00.000Z",
  asOfLocalDate: "2026-11-03",
  timezone: "America/Toronto",
  months: [...months],
  operatingSites: { ...currentInventory },
  segments: kinds.map((kind) => ({
    kind,
    months: months.map((month, i) => {
      const count =
        kind === "campsite" ? 10 : kind === "rental_cottage" ? 2 : 0;
      const siteNights = count * days(month);
      let rate = 0;
      if (kind === "campsite") rate = i < 12 ? 0.4 : i < 24 ? 0.6 : 0.5;
      if (kind === "rental_cottage") rate = i < 12 ? 0.2 : i < 24 ? 0.3 : 0.25;
      return { month, siteNights, bookedNights: Math.round(siteNights * rate) };
    }),
  })),
});

test("Build 195 uses two same-season years, current operating inventory, and full future months", () => {
  const report = buildForwardOccupancyForecast(makeSource());
  assert.equal(report.modelVersion, FORWARD_FORECAST_MODEL);
  assert.deepEqual(
    report.projections.map((p) => p.month),
    ["2026-12-01", "2027-01-01", "2027-02-01"],
  );
  const campsites = report.projections[0].rows[0];
  assert.deepEqual(campsites.sourceMonths, ["2024-12-01", "2025-12-01"]);
  assert.equal(campsites.coverage, 2);
  assert.equal(campsites.capacityNights, 8 * 31);
  assert.equal(campsites.projectedNights, 124);
  assert.equal(campsites.lowerNights, 99);
  assert.equal(campsites.upperNights, 149);
  assert.equal(campsites.confidence, "low");
  assert.equal(report.projections[0].rows[2].reason, "no_operating_inventory");
  assert.equal(report.projections[0].total.comparableKinds, 2);
  assert.equal(report.projections[0].total.excludedKinds, 1);
});

test("Build 195 scenario bounds never exceed available nights and never predict missing data as zero", () => {
  const source = makeSource();
  const low = buildForwardOccupancyForecast(source, {
    scenario: "low",
    horizon: 1,
  });
  const high = buildForwardOccupancyForecast(source, {
    scenario: "high",
    horizon: 1,
  });
  assert.equal(low.projections[0].rows[0].projectedNights, 99);
  assert.equal(high.projections[0].rows[0].projectedNights, 149);
  source.segments[1].months.find((r) => r.month === "2024-12-01").bookedNights =
    0;
  const missing = buildForwardOccupancyForecast(source, { horizon: 1 })
    .projections[0].rows[1];
  assert.equal(missing.coverage, 1);
  assert.equal(missing.projectedNights, null);
  assert.equal(missing.lowerNights, null);
  assert.equal(missing.reason, "insufficient_recorded_history");
});

test("Build 195 backtests compare completed-month actuals against prior seasonal observations", () => {
  const report = buildForwardOccupancyForecast(makeSource(), { horizon: 1 });
  assert.deepEqual(
    [...new Set(report.backtests.map((r) => r.month))],
    ["2026-09-01", "2026-10-01"],
  );
  const october = report.backtests.find(
    (r) => r.month === "2026-10-01" && r.kind === "campsite",
  );
  assert.equal(october.coverage, 2);
  assert.ok(october.absoluteErrorNights >= 0);
  assert.ok(october.actualBookedNights <= october.actualSiteNights);
});

test("Build 195 rejects discontinuous, impossible, overbroad or forged forecast source", () => {
  assert.throws(
    () => buildForwardOccupancyForecast(makeSource(), { horizon: 4 }),
    /options/,
  );
  assert.throws(
    () =>
      buildForwardOccupancyForecast(makeSource(), { scenario: "optimistic" }),
    /options/,
  );
  const source = makeSource();
  source.months[5] = "2025-03-01";
  assert.throws(() => buildForwardOccupancyForecast(source), /consecutive/);
  const badCount = makeSource();
  badCount.segments[0].months[0].bookedNights = 100000;
  assert.throws(() => buildForwardOccupancyForecast(badCount), /source counts/);
  const duplicate = makeSource();
  duplicate.segments[1].kind = "campsite";
  assert.throws(
    () => buildForwardOccupancyForecast(duplicate),
    /accommodation/,
  );
});

test("Build 195 export has source provenance, projected/actual separation, formula-safe CSV cells and no signatures", () => {
  const report = buildForwardOccupancyForecast(makeSource(), { horizon: 2 });
  const csv = forwardOccupancyCsv(
    report,
    "11111111-1111-4111-8111-111111111111",
  );
  const lines = csv.trim().split("\r\n");
  assert.equal(lines.length, 1 + 1 + 2 * 3 + 2 * 3);
  assert.match(csv, /"provenance"/);
  assert.match(csv, /"projection"/);
  assert.match(csv, /"backtest"/);
  assert.match(csv, /"build195-seasonal-observation-v1"/);
  assert.match(csv, /"2026-11-03T12:00:00.000Z"/);
  assert.match(csv, /not a calibrated probability interval/);
  assert.throws(
    () => forwardOccupancyCsv(report, "=HYPERLINK()"),
    /authorized/,
  );
});

test("Build 195 keeps every source read and CSV export staff/tenant permission-scoped", () => {
  const sql = file("../lib/command-centre/forward-occupancy-postgres.mjs");
  const route = file(
    "../app/api/management/occupancy-forecast/export/route.ts",
  );
  const page = file("../app/workspaces/management/command/forecast/page.tsx");
  const panel = file("../components/forward-occupancy-panel.tsx");
  assert.match(sql, /reports\.read/);
  assert.match(sql, /reservation\.read/);
  assert.match(sql, /accommodation\.read/);
  assert.match(sql, /begin read only/);
  assert.match(sql, /set local role icamp_app/);
  assert.match(sql, /set_config\('icamp\.user_id'/);
  assert.match(sql, /where a\.campground_id=\$1/);
  assert.match(sql, /greatest\(r\.arrival_date,b\.first_day\)/);
  assert.match(sql, /least\(s\.ends_on,b\.local_today\)/);
  assert.match(
    sql,
    /select distinct accommodation_id,accommodation_kind,stay_date/,
  );
  assert.match(route, /getCurrentSession/);
  assert.match(route, /getCampgroundAuthorization/);
  assert.match(route, /X-iCamp-Export-SHA256/);
  assert.match(route, /private, no-store/);
  assert.match(page, /requireStaff/);
  assert.match(page, /getCampgroundForwardOccupancySource/);
  assert.match(panel, /Insufficient verified seasonal records/);
  assert.match(panel, /not calibrated/);
  assert.match(panel, /Billing \/ Omnichannel remain HELD/);
});
