import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";
import {
  normalizeCollectionRoute,
  normalizeCollectionProof,
  normalizeFinanceReview,
} from "../lib/garbage-collections/core.mjs";
const id = "67cc6908-d944-44a5-a346-fbba4b75c08a";
test("route metadata is scoped to valid stream/date and retry UUID", () => {
  assert.equal(
    normalizeCollectionRoute({
      clientRouteId: id,
      name: "North loop",
      stream: "garbage",
      serviceDate: "2026-10-23",
    }).stream,
    "garbage",
  );
  assert.throws(() =>
    normalizeCollectionRoute({
      clientRouteId: id,
      name: "X",
      stream: "garbage",
      serviceDate: "2026-10-23",
    }),
  );
  assert.throws(() =>
    normalizeCollectionRoute({
      clientRouteId: id,
      name: "North loop",
      stream: "landfill",
      serviceDate: "2026-10-23",
    }),
  );
});
test("collected proof requires bags and skipped proof requires zero", () => {
  const base = { routeId: id, pickupId: id, note: "Pickup witnessed" };
  assert.equal(
    normalizeCollectionProof({ ...base, outcome: "collected", bagCount: 2 })
      .bagCount,
    2,
  );
  assert.throws(() =>
    normalizeCollectionProof({ ...base, outcome: "collected", bagCount: 0 }),
  );
  assert.throws(() =>
    normalizeCollectionProof({ ...base, outcome: "missed", bagCount: 1 }),
  );
  assert.equal(
    normalizeCollectionProof({ ...base, outcome: "not_ready", bagCount: 0 })
      .bagCount,
    0,
  );
});
test("manual receipt match requires independently checked amount", () => {
  const base = { clientReviewId: id, tagId: id, note: "POS checked" };
  assert.equal(
    normalizeFinanceReview({
      ...base,
      decision: "receipt_matched",
      checkedAmountCents: 500,
    }).checkedAmountCents,
    500,
  );
  assert.throws(() =>
    normalizeFinanceReview({
      ...base,
      decision: "receipt_matched",
      checkedAmountCents: "",
    }),
  );
  assert.equal(
    normalizeFinanceReview({
      ...base,
      decision: "disputed",
      checkedAmountCents: "",
    }).checkedAmountCents,
    null,
  );
});
test("schema forces RLS, immutable evidence and unique collected stop", () => {
  const sql = fs.readFileSync(
    new URL(
      "../database/migrations/0108_garbage_collection_reconciliation.sql",
      import.meta.url,
    ),
    "utf8",
  );
  assert.equal((sql.match(/force row level security/gu) ?? []).length, 3);
  assert.match(sql, /garbage_collected_pickup_once_idx/u);
  assert.match(sql, /garbage_proof_append_only/u);
  assert.match(sql, /garbage_finance_review_append_only/u);
  assert.match(sql, /validate_garbage_collection_proof/u);
  assert.match(sql, /validate_garbage_finance_review/u);
});
test("operations neither capture payments nor change canonical pickup state", () => {
  const source = fs.readFileSync(
    new URL("../lib/garbage-collections/postgres.mjs", import.meta.url),
    "utf8",
  );
  assert.doesNotMatch(
    source,
    /update public\.garbage_pickup_requests|insert into public\.reservation_payments|capturePayment/u,
  );
  assert.match(
    source,
    /forbidden_placeholder_should_not_match|garbage\.finance\.reconcile/u,
  );
  assert.match(source, /garbage\.routes\.manage/u);
});
