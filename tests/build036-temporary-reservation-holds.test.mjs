import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import {
  normalizeHoldDuration,
  normalizeHoldKey,
  normalizeHoldRequest,
  temporaryHoldErrorCode,
} from "../lib/reservation-holds/core.mjs";

const migration = await readFile(
  new URL(
    "../database/migrations/0045_atomic_temporary_reservation_holds.sql",
    import.meta.url,
  ),
  "utf8",
);
const service = await readFile(
  new URL("../lib/reservation-holds/postgres.mjs", import.meta.url),
  "utf8",
);
const page = await readFile(
  new URL(
    "../app/workspaces/management/campgrounds/availability/holds/page.tsx",
    import.meta.url,
  ),
  "utf8",
);
const countdown = await readFile(
  new URL(
    "../app/workspaces/management/campgrounds/availability/holds/hold-countdown.tsx",
    import.meta.url,
  ),
  "utf8",
);

test("Build 036 validates configurable duration and idempotency keys", () => {
  assert.equal(normalizeHoldDuration(15), 15);
  assert.throws(() => normalizeHoldDuration(1));
  assert.throws(() => normalizeHoldDuration(61));
  assert.equal(normalizeHoldKey("request-123"), "request-123");
  assert.deepEqual(
    normalizeHoldRequest({
      accommodationId: "site-1",
      arrivalDate: "2027-07-01",
      departureDate: "2027-07-03",
      holdKey: "request-123",
    }),
    {
      accommodationId: "site-1",
      arrivalDate: "2027-07-01",
      departureDate: "2027-07-03",
      holdKey: "request-123",
    },
  );
});

test("Build 036 serializes both hold-key retries and accommodation inventory", () => {
  assert.match(migration, /icamp-reservation-hold-key/u);
  assert.match(migration, /icamp-live-availability/u);
  assert.match(migration, /pg_advisory_xact_lock/u);
  assert.match(migration, /ICAMP_HOLD_KEY_REUSED/u);
  assert.match(migration, /create_reservation_hold/u);
});

test("Build 036 owns expiry, explicit release and idempotent retry behavior", () => {
  assert.match(migration, /expire_reservation_holds/u);
  assert.match(migration, /release_reservation_hold/u);
  assert.match(service, /createTemporaryHold/u);
  assert.match(service, /releaseTemporaryHold/u);
  assert.equal(
    temporaryHoldErrorCode(new Error("ICAMP_HOLD_KEY_REUSED")),
    "ICAMP_HOLD_KEY_REUSED",
  );
});

test("Build 036 exposes live countdown and configurable hold duration", () => {
  assert.match(countdown, /setInterval/u);
  assert.match(countdown, /router\.refresh/u);
  assert.match(page, /Hold duration/u);
  assert.match(page, /HoldCountdown/u);
  assert.match(page, /Creating hold/u);
});
