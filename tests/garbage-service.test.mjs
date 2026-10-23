import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

import {
  normalizeGarbagePickup,
  normalizeGarbagePolicy,
  nextGarbagePickupState,
} from "../lib/garbage-service/core.mjs";

const id = "67cc6908-d944-44a5-a346-fbba4b75c08a";

test("configures each standard waste stream and keeps included service free", () => {
  for (const stream of ["garbage", "recycling", "organics"]) {
    assert.equal(
      normalizeGarbagePolicy({ stream, mode: "included_site_pickup" }).feeCents,
      0,
    );
  }
  assert.throws(() =>
    normalizeGarbagePolicy({
      stream: "garbage",
      mode: "included_site_pickup",
      feeCents: 500,
    }),
  );
});

test("scheduled and paid models validate their distinct contracts", () => {
  assert.equal(
    normalizeGarbagePolicy({
      stream: "recycling",
      mode: "scheduled_site_pickup",
      weekday: 2,
    }).weekday,
    2,
  );
  assert.throws(() =>
    normalizeGarbagePolicy({
      stream: "recycling",
      mode: "scheduled_site_pickup",
    }),
  );
  assert.equal(
    normalizeGarbagePolicy({
      stream: "organics",
      mode: "paid_on_demand",
      feeCents: 600,
    }).feeCents,
    600,
  );
  assert.throws(() =>
    normalizeGarbagePolicy({
      stream: "organics",
      mode: "paid_on_demand",
      feeCents: 0,
    }),
  );
});

test("central bins never create a pickup, and retries need stable IDs", () => {
  assert.throws(() =>
    normalizeGarbagePickup({
      stream: "garbage",
      mode: "central_bins",
      clientRequestId: id,
    }),
  );
  assert.throws(() =>
    normalizeGarbagePickup({
      stream: "garbage",
      mode: "paid_on_demand",
      clientRequestId: "x",
    }),
  );
  assert.equal(
    normalizeGarbagePickup({
      stream: "garbage",
      mode: "paid_on_demand",
      clientRequestId: id,
    }).clientRequestId,
    id,
  );
});

test("closed pickup states never reopen", () => {
  assert.equal(
    nextGarbagePickupState("scheduled", "in_progress"),
    "in_progress",
  );
  assert.throws(() => nextGarbagePickupState("completed", "scheduled"));
  assert.throws(() => nextGarbagePickupState("requested", "completed"));
});

test("Build 079 schema uses scoped RLS, append-only events and fee snapshots", () => {
  const migration = fs.readFileSync(
    new URL(
      "../database/migrations/0103_garbage_service_models.sql",
      import.meta.url,
    ),
    "utf8",
  );
  for (const name of [
    "garbage_service_policies",
    "garbage_pickup_requests",
    "garbage_pickup_events",
  ]) {
    assert.match(migration, new RegExp(`public\\.${name}`, "u"));
  }
  assert.equal((migration.match(/force row level security/gu) ?? []).length, 3);
  assert.match(migration, /revoke all on[\s\S]*anon,authenticated/iu);
  assert.match(migration, /garbage_pickup_events_append_only/u);
  assert.match(migration, /guard_garbage_pickup_update/u);
  assert.match(migration, /fee_cents integer not null/u);
  assert.match(migration, /unique\(campground_id,client_request_id\)/u);
  assert.match(migration, /alter policy accommodations_read/u);
});

test("Build 079 operations never claim external payment or duplicate maintenance orders", () => {
  const service = fs.readFileSync(
    new URL("../lib/garbage-service/postgres.mjs", import.meta.url),
    "utf8",
  );
  const ui = fs.readFileSync(
    new URL("../app/workspaces/maintenance/garbage/page.tsx", import.meta.url),
    "utf8",
  );
  assert.match(
    service,
    /request\.mode === "paid_on_demand" \? "pending_checkout" : "not_applicable"/u,
  );
  assert.doesNotMatch(service, /insert into public\.maintenance_work_orders/u);
  assert.doesNotMatch(service, /payment\.capture|charge\(/u);
  assert.match(ui, /pending checkout/u);
  assert.match(ui, /garbage\.services/u);
  assert.match(service, /icamp-garbage-request:/u);
  assert.match(service, /pg_advisory_xact_lock/u);
});
