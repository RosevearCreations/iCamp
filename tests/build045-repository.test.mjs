import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const migrationUrl = new URL(
  "../database/migrations/0054_cancellation_refund_adjustment_safeguards.sql",
  import.meta.url,
);
const verifyUrl = new URL(
  "../database/verify/0054_cancellation_refund_adjustment_safeguards.sql",
  import.meta.url,
);
const repositoryUrl = new URL(
  "../lib/refunds/postgres.mjs",
  import.meta.url,
);
const financialPageUrl = new URL(
  "../app/workspaces/management/campgrounds/reservations/[reservationId]/financial/page.tsx",
  import.meta.url,
);
const policyPageUrl = new URL(
  "../app/workspaces/management/campgrounds/refunds/page.tsx",
  import.meta.url,
);

test("Build 045 schema preserves policy, original-payment refunds and append-only adjustments", async () => {
  const sql = await readFile(migrationUrl, "utf8");

  assert.match(sql, /create table public\.campground_cancellation_refund_policies/u);
  assert.match(sql, /create table public\.reservation_refunds/u);
  assert.match(sql, /original_payment_id uuid not null/u);
  assert.match(sql, /create table public\.reservation_financial_adjustments/u);
  assert.match(sql, /reservation_financial_adjustments_append_only/u);
  assert.match(sql, /create table icamp_private\.refund_provider_events/u);
  assert.match(sql, /force row level security/u);
  assert.doesNotMatch(
    sql,
    /grant[^;]*(?:update|delete)[^;]*reservation_financial_adjustments/iu,
  );
});

test("Build 045 verification protects RLS, append-only evidence and private provider events", async () => {
  const sql = await readFile(verifyUrl, "utf8");

  assert.match(sql, /must FORCE RLS/u);
  assert.match(sql, /financial adjustments must remain append-only/u);
  assert.match(sql, /refund provider events must remain private/u);
  assert.match(sql, /foreign-key coverage indexes are incomplete/u);
});

test("Build 045 repository enforces original-payment linkage and separate approval", async () => {
  const source = await readFile(repositoryUrl, "utf8");

  assert.match(source, /originalPaymentId/u);
  assert.match(source, /requested_by_user_id === actorUserId/u);
  assert.match(source, /requester cannot approve their own refund/u);
  assert.match(source, /refundPayment/u);
  assert.match(source, /provider_refund_reference/u);
  assert.match(source, /reservation_financial_adjustments/u);
  assert.match(source, /appendAuditEvent/u);
  assert.match(source, /Full refund must equal the entire remaining captured payment/u);
  assert.doesNotMatch(source, /update public\.reservation_payments/iu);
});

test("Build 045 exposes policy, partial/full refunds, approval and provider execution UI", async () => {
  const [financial, policy] = await Promise.all([
    readFile(financialPageUrl, "utf8"),
    readFile(policyPageUrl, "utf8"),
  ]);

  assert.match(financial, /Partial refund/u);
  assert.match(financial, /Full original payment refund/u);
  assert.match(financial, /Approve refund/u);
  assert.match(financial, /Execute provider refund/u);
  assert.match(financial, /Append-only adjustments/u);
  assert.match(financial, /IVR\/DTMF/u);
  assert.match(financial, /SMS\/MMS/u);
  assert.match(policy, /Cancellation, refund & approval policy/u);
  assert.match(policy, /Approval threshold/u);
  assert.match(policy, /mock adapter is free/u);
});
