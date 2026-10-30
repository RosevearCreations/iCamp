import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";

import {
  BILLING_EVENTS,
  blankIndependentEvidence,
  previewSubscriberConsentReceipt,
  reconcileIndependentEvidence,
  subscriptionAdapterFoundation,
} from "../lib/tenant-subscription/foundation.mjs";

test("Build 159 adapter remains disabled and covers recurring billing and fraud events", () => {
  const contract = subscriptionAdapterFoundation("stripe");
  assert.equal(contract.checkout_enabled, false);
  assert.equal(contract.webhook_ingestion_enabled, false);
  assert.equal(contract.mode, "DISABLED");
  for (const event of [
    "invoice.paid",
    "invoice.payment_failed",
    "charge.dispute.created",
    "charge.refunded",
    "radar.early_fraud_warning.created",
  ]) {
    assert.ok(BILLING_EVENTS.includes(event));
  }
  assert.throws(() => subscriptionAdapterFoundation("unknown"));
});

test("versioned consent preview requires explicit consent and never claims actual acceptance", () => {
  assert.throws(() =>
    previewSubscriberConsentReceipt({
      termsVersion: "v1.0",
      privacyVersion: "v1.0",
      consentGranted: false,
    }),
  );
  assert.throws(() =>
    previewSubscriberConsentReceipt({
      termsVersion: "<bad>",
      privacyVersion: "v1.0",
      consentGranted: true,
    }),
  );
  const first = previewSubscriberConsentReceipt({
    termsVersion: "terms-2026.1",
    privacyVersion: "privacy-2026.1",
    consentGranted: true,
  });
  const repeated = previewSubscriberConsentReceipt({
    termsVersion: "terms-2026.1",
    privacyVersion: "privacy-2026.1",
    consentGranted: true,
  });
  const changed = previewSubscriberConsentReceipt({
    termsVersion: "terms-2026.2",
    privacyVersion: "privacy-2026.1",
    consentGranted: true,
  });
  assert.equal(first.document_version_digest, repeated.document_version_digest);
  assert.notEqual(
    first.document_version_digest,
    changed.document_version_digest,
  );
  assert.equal(first.acceptance_recorded, false);
  assert.equal(first.persisted, false);
  assert.equal(first.legally_binding, false);
});

test("independent evidence reconciles only allowlisted nonsecret states and never opens gates", () => {
  const allMissing = reconcileIndependentEvidence(blankIndependentEvidence());
  assert.equal(allMissing.required, 9);
  assert.equal(allMissing.reviewed, 0);
  const allReported = Object.fromEntries(
    Object.keys(allMissing.checks).map((key) => [
      key,
      "INDEPENDENTLY_REVIEWED",
    ]),
  );
  const result = reconcileIndependentEvidence({
    ...allReported,
    private_key: "secret",
    signed_source_proof: "HACKED",
  });
  assert.equal(result.reviewed, 8);
  assert.equal(result.checks.signed_source_proof, "MISSING");
  assert.equal(JSON.stringify(result).includes("secret"), false);
  assert.equal(result.independent_validation_performed, false);
  assert.equal(result.tenant_subscription_charges_enabled, false);
  assert.equal(result.integration_gate, "HOLD");
  assert.equal(result.authenticated_gateway_gets_authorized, false);
});

test("private consent schema is append-only, unseeded, and closed to anonymous writers", () => {
  const sql = readFileSync(
    new URL(
      "../database/migrations/0184_build159_subscription_consent_foundation.sql",
      import.meta.url,
    ),
    "utf8",
  );
  assert.match(
    sql,
    /create table icamp_private\.subscriber_document_versions/i,
  );
  assert.match(sql, /create table icamp_private\.subscriber_consent_receipts/i);
  assert.match(sql, /terms_state is distinct from 'published'/i);
  assert.match(sql, /privacy_state is distinct from 'published'/i);
  assert.match(sql, /before update or delete/i);
  assert.match(sql, /force row level security/gi);
  assert.match(
    sql,
    /revoke all on icamp_private\.subscriber_consent_receipts from public/i,
  );
  assert.doesNotMatch(
    sql,
    /insert into icamp_private\.subscriber_consent_receipts/i,
  );
  assert.doesNotMatch(sql, /create policy/i);
});
