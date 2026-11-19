import test from "node:test";
import assert from "node:assert/strict";
import { createHash, generateKeyPairSync, verify } from "node:crypto";
import { readFileSync } from "node:fs";

import {
  normalizeRentalAllocation264,
  normalizeSupervisedPilot264,
  rentalReservationLabel264,
} from "../lib/rental-planner/allocations264.mjs";
import {
  assessRentalMigrationReadback264,
  RENTAL_MIGRATIONS264,
} from "../lib/rental-planner/migration264.mjs";
import {
  handleSysopTelemetry,
  SYSOP_TELEMETRY_PATH,
} from "../lib/integration-v1/sysop-telemetry-v1.mjs";

const uuid = "78e9f202-28ab-4431-8d4b-7f4383c24753";
const fullMigrationTable = [
  ["rental_planning_offers", "rental_offer_guard"],
  ["rental_sessions263", "rental_session263_guard"],
  ["rental_allocations264", "rental_allocation264_guard"],
  ["rental_pilot_reviews264", "rental_pilot264_guard"],
].map(([name, guardName]) => ({
  name, guardName, forceRls: true,
  guardPresent: true, appDirectGrants: false,
}));
const correctRows = RENTAL_MIGRATIONS264.map((expected) => ({
  version: expected.version,
  name: expected.name,
  checksum_sha256: expected.checksumSha256,
}));
const baseline = {
  production: true,
  pinnedDatabaseHost: true,
  revision: "a".repeat(40),
  readSucceeded: true,
  rows: correctRows,
  tables: fullMigrationTable,
};

test("Build264 requires human staff safety and denies auto-money/animal handover", () => {
  const normalized = normalizeRentalAllocation264({
    requestId: uuid,
    staffSafetyReview: "Confirmed genuine asset, safety checks and office-only handover.",
  });
  assert.equal(normalized.paymentCaptured, false);
  assert.equal(normalized.equipmentHandedOver, false);
  assert.equal(normalized.animalAssigned, false);
  assert.match(rentalReservationLabel264("reserved_for_staff_collection"), /contact the campground/iu);
  for (const input of [
    { requestId: "not-uuid", staffSafetyReview: normalized.staffSafetyReview },
    { requestId: uuid, staffSafetyReview: "short" },
    { requestId: uuid, staffSafetyReview: "invalid\nprivate data" },
  ]) assert.throws(() => normalizeRentalAllocation264(input));
});

test("Build264 supervised pilot requires independently reviewable evidence, not tickets", () => {
  const result = normalizeSupervisedPilot264({
    sessionId: uuid,
    outcome: "accepted_for_internal_pilot",
    originalEvidenceReference: "safety-check:original-0001",
    supervisionWelfareCheck:
      "Independent staff verified qualified supervision and animal welfare requirements.",
  });
  assert.equal(result.guestEnrollmentEnabled, false);
  assert.equal(result.liveActivityBookingEnabled, false);
  assert.equal(result.insuranceCertified, false);
  for (const change of [
    { outcome: "activate_paid_guest" },
    { sessionId: "fake" },
    { originalEvidenceReference: "short" },
    { supervisionWelfareCheck: "unverified" },
  ]) assert.throws(() => normalizeSupervisedPilot264({
    sessionId: uuid,
    outcome: "hold",
    originalEvidenceReference: "evidence:original-0001",
    supervisionWelfareCheck:
      "Independent qualified staff checked welfare, insurance and supervision.",
    ...change,
  }));
});

test("Build264 requires exact live ledger source digests plus real RLS and trigger inspection", () => {
  const ready = assessRentalMigrationReadback264(baseline);
  assert.equal(ready.status, "LIVE_PINNED_SOURCE_LEDGER_SCHEMA_MATCH");
  assert.equal(ready.sourceReadbackMatched, true);
  assert.equal(ready.independentHostCustodyCertified, false);
  assert.equal(ready.allocationsOperationallyProven, false);
  const held = [
    { pinnedDatabaseHost: false },
    { production: false },
    { readSucceeded: false },
    { rows: correctRows.slice(0, 2) },
    { rows: correctRows.map((x) => ({ ...x, checksum_sha256: "0".repeat(64) })) },
    { tables: fullMigrationTable.map((x) =>
      x.name === "rental_allocations264" ? { ...x, forceRls: false } : x) },
  ];
  for (const change of held) {
    const result = assessRentalMigrationReadback264({ ...baseline, ...change });
    assert.equal(result.sourceReadbackMatched, false);
    assert.match(result.status, /HOLD/);
  }
  for (const expected of RENTAL_MIGRATIONS264) {
    const source = readFileSync(
      new URL(
        `../database/migrations/${expected.version}_${expected.name}.sql`,
        import.meta.url,
      ),
      "utf8",
    );
    assert.equal(
      createHash("sha256").update(source).digest("hex"),
      expected.checksumSha256,
      "Original migration source bytes must be pinned independently of deployed SQL",
    );
  }
});

test("Build264 original SQL enforces real equipment, overlapping source locks and distinct independent reviewer", () => {
  const sql = readFileSync(
    new URL("../database/migrations/0240_build264_rental_allocation_pilot.sql", import.meta.url),
    "utf8",
  );
  for (const fragment of [
    "force row level security",
    "for update of o",
    "source_record.asset_class<>'equipment'",
    "source_record.equipment_type not in ('watercraft','cart','other')",
    "booked.start_date<=new.end_date",
    "booked.end_date>=new.start_date",
    "planned_by_user_id=actor",
    "rental_request_allocation264_guard",
    "rental_session264_reservation_guard",
    "has_campground_permission",
    "rental_pilot264_guard",
  ]) assert.ok(sql.includes(fragment), fragment);
  const action = readFileSync(
    new URL("../app/workspaces/management/campgrounds/rental-allocations264/actions.ts", import.meta.url),
    "utf8",
  );
  assert.match(action, /requireCampgroundPermission/);
  assert.match(action, /inspectRentalMigration264/);
  const guest = readFileSync(
    new URL("../app/guest/rentals/page.tsx", import.meta.url),
    "utf8",
  );
  assert.match(guest, /listOwnRentalAllocations264/);
});

const canonical = (v) => Array.isArray(v)
  ? "[" + v.map(canonical).join(",") + "]"
  : v && typeof v === "object"
    ? "{" + Object.keys(v).sort().map((k) =>
      JSON.stringify(k) + ":" + canonical(v[k])).join(",") + "}"
    : JSON.stringify(v);

test("Build264 authentic signed Sysop aggregation preserves unknowns, non-action and token-first privacy", async () => {
  const { privateKey, publicKey } = generateKeyPairSync("ed25519");
  const env = {
    ROSEVEAR_SYSOP_TELEMETRY_READ_TOKEN: "synthetic-private-test-token",
    ROSEVEAR_SYSOP_TELEMETRY_PRIVATE_KEY_PEM: privateKey.export({
      format: "pem", type: "pkcs8",
    }),
    VERCEL_GIT_COMMIT_SHA: "f".repeat(40),
  };
  let calls = 0;
  const sample = async () => {
    calls += 1;
    return {
      queueDepth: 9,
      jobsCompleted: 4,
      jobsFailed: 1,
      activeSessions: 20,
    };
  };
  const denied = await handleSysopTelemetry({
    request: new Request("https://example.invalid" + SYSOP_TELEMETRY_PATH),
    env, appId: "icamp", readAggregateMetrics: sample,
  });
  assert.equal(denied.status, 401);
  assert.equal(calls, 0, "Do not query original DB before token validation");
  const request = new Request("https://example.invalid" + SYSOP_TELEMETRY_PATH, {
    headers: { "x-rosevear-telemetry-token": "synthetic-private-test-token" },
  });
  const response = await handleSysopTelemetry({
    request, env, appId: "icamp", readAggregateMetrics: sample,
    nowMs: 1800000000000,
  });
  const body = await response.json();
  assert.equal(response.status, 200);
  assert.equal(calls, 1);
  assert.equal(body.payload.metrics.queueDepth, 9);
  assert.equal(body.payload.metrics.jobsCompleted, 4);
  assert.equal(body.payload.metrics.jobsFailed, 1);
  assert.equal(body.payload.metrics.activeSessions, 20);
  assert.equal(body.payload.metrics.requests, null);
  assert.equal(body.payload.metrics.latencyP95Ms, null);
  assert.equal(body.payload.sysop.bootTimeMs, null);
  assert.equal(body.payload.sysop.rebootIsIndependentlyWitnessed, false);
  assert.equal(body.payload.authorizesAction, false);
  assert.ok(verify(
    null, Buffer.from(canonical(body.payload)), publicKey,
    Buffer.from(body.signature, "hex"),
  ));
  const unknown = await handleSysopTelemetry({
    request, env, appId: "icamp",
    readAggregateMetrics: async () => {
      throw new Error("original DB disconnected");
    },
  });
  assert.equal((await unknown.json()).payload.metrics.activeSessions, null);
});

test("Build264 telemetry collector is opt-in, pinned Production and does not leak guest, tenant or payment data", () => {
  const path = readFileSync(
    new URL("../lib/integration-v1/sysop-aggregates264.mjs", import.meta.url),
    "utf8",
  );
  assert.match(path, /VERCEL_ENV/);
  assert.match(path, /ICAMP_EXPECTED_PRODUCTION_DATABASE_HOST/);
  assert.match(path, /transaction isolation level repeatable read read only/);
  assert.doesNotMatch(path, /select\s+\*/iu);
});
