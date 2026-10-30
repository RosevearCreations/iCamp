import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import {
  createSandboxLifecycle,
  replaySandboxEvent,
  runSandboxLifecycleFixture,
} from "../lib/tenant-subscription/sandbox-lifecycle.mjs";
import {
  createAgreementReview,
  previewAgreementDecision,
} from "../lib/tenant-subscription/agreement-approval.mjs";

test("Build 160 subscription event replay is deterministic, duplicate-safe and has no external side effects", () => {
  const first = runSandboxLifecycleFixture();
  const second = runSandboxLifecycleFixture();
  assert.deepEqual(first, second);
  assert.equal(first.subscription_state, "canceled");
  assert.equal(first.payment_state, "paid_in_sandbox");
  assert.equal(first.history.length, 6);
  assert.equal(first.charges_enabled, false);
  assert.equal(first.persisted, false);
  assert.equal(first.external_writes, false);
  assert.equal(first.live_provider_connected, false);
  const initial = createSandboxLifecycle("tenant_rosevear");
  const checkout = {
    id: "event_001",
    tenantKey: "tenant_rosevear",
    type: "checkout.session.completed",
  };
  const next = replaySandboxEvent(initial, checkout);
  assert.equal(replaySandboxEvent(next, checkout), next);
  assert.throws(
    () =>
      replaySandboxEvent(next, {
        ...checkout,
        id: "event_002",
        tenantKey: "another_tenant",
      }),
    /isolation/i,
  );
  assert.throws(
    () => replaySandboxEvent(initial, { ...checkout, type: "fake.event" }),
    /allowlist/i,
  );
  assert.throws(
    () => replaySandboxEvent(initial, { ...checkout, type: "invoice.paid" }),
    /out of order/i,
  );
});

test("Build 160 sandbox covers failure recovery, disputes, refunds, cancellation and replay protection", () => {
  const tenantKey = "isolated_tenant";
  let snapshot = createSandboxLifecycle(tenantKey);
  const next = (id, type) => {
    snapshot = replaySandboxEvent(snapshot, { id, type, tenantKey });
  };
  next("evt_a01", "customer.subscription.created");
  next("evt_a02", "invoice.payment_failed");
  assert.equal(snapshot.subscription_state, "past_due");
  next("evt_a03", "invoice.paid");
  assert.equal(snapshot.subscription_state, "active");
  next("evt_a04", "charge.dispute.created");
  assert.equal(snapshot.risk_state, "dispute_open");
  next("evt_a05", "charge.refunded");
  assert.equal(snapshot.payment_state, "refunded_in_sandbox");
  next("evt_a06", "customer.subscription.deleted");
  assert.equal(snapshot.subscription_state, "canceled");
  assert.throws(
    () =>
      replaySandboxEvent(snapshot, {
        id: "evt_a07",
        type: "invoice.paid",
        tenantKey,
      }),
    /out of order/i,
  );
});

test("Build 160 consent review preview enforces digest, version, revision and independent human roles", () => {
  const digest = "a".repeat(64);
  assert.throws(
    () => createAgreementReview({ version: "v1", contentSha256: digest }),
    /version/i,
  );
  assert.throws(
    () => createAgreementReview({ version: "terms-v1", contentSha256: "bad" }),
    /digest/i,
  );
  const original = createAgreementReview({
    version: "terms-2026.1",
    contentSha256: digest,
  });
  const submit = previewAgreementDecision(original, {
    action: "submit",
    actor: "author_01",
    expectedRevision: 0,
  });
  assert.throws(
    () =>
      previewAgreementDecision(submit, {
        action: "review",
        actor: "author_01",
        expectedRevision: 1,
      }),
    /differ/i,
  );
  assert.throws(
    () =>
      previewAgreementDecision(submit, {
        action: "review",
        actor: "reviewer_02",
        expectedRevision: 0,
      }),
    /stale/i,
  );
  const review = previewAgreementDecision(submit, {
    action: "review",
    actor: "reviewer_02",
    expectedRevision: 1,
  });
  assert.throws(
    () =>
      previewAgreementDecision(review, {
        action: "approve",
        actor: "reviewer_02",
        expectedRevision: 2,
      }),
    /distinct/i,
  );
  const approvedPreview = previewAgreementDecision(review, {
    action: "approve",
    actor: "approver_03",
    expectedRevision: 2,
  });
  assert.equal(approvedPreview.state, "approval_previewed");
  assert.equal(approvedPreview.legally_approved, false);
  assert.equal(approvedPreview.independently_verified, false);
  assert.equal(approvedPreview.persisted, false);
  assert.equal(approvedPreview.published, false);
  assert.throws(
    () =>
      previewAgreementDecision(approvedPreview, {
        action: "approve",
        actor: "other_04",
        expectedRevision: 3,
      }),
    /transition/i,
  );
});

test("Build 160 private approval ledger has digest binding, separation, immutable events and no anonymous grants", () => {
  const sql = readFileSync(
    new URL(
      "../database/migrations/0185_build160_subscriber_agreement_review_ledger.sql",
      import.meta.url,
    ),
    "utf8",
  );
  assert.match(sql, /subscriber_agreement_review_events/);
  assert.match(sql, /document digest/i);
  assert.match(sql, /Approver must be distinct/i);
  assert.match(sql, /before update or delete/i);
  assert.match(sql, /force row level security/i);
  assert.match(
    sql,
    /revoke all on icamp_private\.subscriber_agreement_review_events from public/i,
  );
  assert.doesNotMatch(sql, /create policy/i);
  assert.doesNotMatch(
    sql,
    /insert into icamp_private\.subscriber_agreement_review_events/i,
  );
});
