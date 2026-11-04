import assert from "node:assert/strict";
import { randomBytes } from "node:crypto";
import { readFileSync } from "node:fs";
import test from "node:test";

import {
  BUILD199_SCENARIOS,
  previewSandboxLegalGate,
  runBuild199Scenario,
  signSyntheticWebhook,
  verifySyntheticWebhook,
} from "../lib/tenant-subscription/build199-sandbox.mjs";
import {
  createSandboxLifecycle,
  replaySandboxEvent,
} from "../lib/tenant-subscription/sandbox-lifecycle.mjs";

const sample = {
  schema: "icamp.subscription.signed-test-envelope.v1",
  tenantKey: "isolated_campground",
  id: "sample_001",
  type: "invoice.paid",
  environment: "IN_MEMORY_TEST",
  livemode: false,
};

test("Build 199 signs test envelopes, verifies timing and rejects tampering, live-mode and cross-tenant replay", () => {
  const secret = randomBytes(32);
  const payload = JSON.stringify(sample);
  const timestamp = 1793808000;
  const header = signSyntheticWebhook({ payload, timestamp, secret });
  assert.deepEqual(
    verifySyntheticWebhook({ payload, header, secret, now: timestamp }),
    sample,
  );
  assert.throws(
    () =>
      verifySyntheticWebhook({
        payload: payload.replace("invoice.paid", "charge.refunded"),
        header,
        secret,
        now: timestamp,
      }),
    /signature mismatch/i,
  );
  assert.throws(
    () =>
      verifySyntheticWebhook({ payload, header, secret, now: timestamp + 301 }),
    /window/i,
  );
  assert.throws(
    () => signSyntheticWebhook({ payload, timestamp, secret: randomBytes(16) }),
    /secret/i,
  );
  for (const modification of [
    { livemode: true },
    { environment: "PRODUCTION" },
    { schema: "stripe.original.webhook" },
  ]) {
    const livePayload = JSON.stringify({ ...sample, ...modification });
    const liveHeader = signSyntheticWebhook({
      payload: livePayload,
      timestamp,
      secret,
    });
    assert.throws(
      () =>
        verifySyntheticWebhook({
          payload: livePayload,
          header: liveHeader,
          secret,
          now: timestamp,
        }),
      /not a test-mode/i,
    );
  }
  const verified = verifySyntheticWebhook({
    payload,
    header,
    secret,
    now: timestamp,
  });
  assert.throws(
    () =>
      replaySandboxEvent(
        createSandboxLifecycle("another_campground"),
        verified,
      ),
    /isolation/i,
  );
});

test("Build 199 covers checkout, renewals, retry, cancellation, dispute, refund and duplicate delivery", () => {
  for (const key of Object.keys(BUILD199_SCENARIOS)) {
    const report = runBuild199Scenario(key);
    assert.equal(report.scenario, key);
    assert.equal(
      report.signed_events_verified,
      BUILD199_SCENARIOS[key].events.length,
    );
    assert.equal(
      report.duplicate_deliveries_ignored,
      report.signed_events_verified,
    );
    assert.match(report.source_sha256, /^[a-f0-9]{64}$/);
    assert.equal(report.lifecycle.external_writes, false);
    assert.equal(report.lifecycle.charges_enabled, false);
    assert.equal(report.outbound_calls, false);
    assert.equal(report.real_charges_possible, false);
    assert.equal(report.provider_official_test_receipts, "MISSING");
    assert.equal(report.activation, "HELD");
    assert.equal(report.consent_preview.legally_binding, false);
    assert.equal(report.consent_preview.actual_consent_captured, false);
    assert.equal(report.persisted, false);
  }
  assert.equal(
    runBuild199Scenario("normal").lifecycle.subscription_state,
    "active",
  );
  assert.equal(
    runBuild199Scenario("recovery").lifecycle.payment_state,
    "paid_in_sandbox",
  );
  assert.equal(
    runBuild199Scenario("cancellation").lifecycle.subscription_state,
    "canceled",
  );
  assert.equal(
    runBuild199Scenario("dispute").lifecycle.risk_state,
    "dispute_open",
  );
  assert.throws(() => runBuild199Scenario("live"), /unknown/i);
  const initial = createSandboxLifecycle("sample_tenant");
  const checkout = replaySandboxEvent(initial, {
    tenantKey: "sample_tenant",
    id: "same_event_001",
    type: "checkout.session.completed",
  });
  assert.throws(
    () =>
      replaySandboxEvent(checkout, {
        tenantKey: "sample_tenant",
        id: "same_event_001",
        type: "invoice.paid",
      }),
    /conflicting type/i,
  );
});

test("Build 199 consent is explicit, version-bound, authenticated, independently reviewed and never activated", () => {
  const fixture = {
    termsVersion: "sample-terms-2026.1",
    privacyVersion: "sample-privacy-2026.1",
    explicitlyAccepted: true,
    signedInActor: "author_001",
    submittingActor: "author_001",
    independentReviewer: "reviewer_002",
  };
  const reviewed = previewSandboxLegalGate(fixture);
  assert.equal(reviewed.activation, "HELD");
  assert.equal(reviewed.acceptance_recorded, false);
  assert.equal(reviewed.legal_approval_evidence, "MISSING");
  assert.throws(
    () => previewSandboxLegalGate({ ...fixture, explicitlyAccepted: false }),
    /explicit affirmative/i,
  );
  assert.throws(
    () =>
      previewSandboxLegalGate({ ...fixture, signedInActor: "someone_else" }),
    /authenticated/i,
  );
  assert.throws(
    () =>
      previewSandboxLegalGate({
        ...fixture,
        independentReviewer: "author_001",
      }),
    /independent reviewer/i,
  );
  assert.throws(
    () => previewSandboxLegalGate({ ...fixture, termsVersion: "?" }),
    /version/i,
  );
});

test("Build 199 splits sandbox-only run/review permissions and exposes no billing secrets or live API mutation", () => {
  const migration = readFileSync(
    new URL(
      "../database/migrations/0213_build199_subscription_sandbox_permissions.sql",
      import.meta.url,
    ),
    "utf8",
  );
  const api = readFileSync(
    new URL("../app/api/it/subscriptions/sandbox/route.ts", import.meta.url),
    "utf8",
  );
  assert.match(migration, /subscription\.sandbox\.run/);
  assert.match(migration, /subscription\.sandbox\.review/);
  assert.match(migration, /it_admin.*subscription\.sandbox\.run/);
  assert.match(migration, /finance.*subscription\.sandbox\.review/);
  assert.doesNotMatch(migration, /grant .*payment\.capture/i);
  assert.match(api, /requireAnyCampgroundPermission/);
  assert.match(api, /no-store/);
  assert.match(api, /export async function GET/);
  assert.doesNotMatch(api, /export async function POST/);
  assert.doesNotMatch(
    api,
    /stripe\.com|checkout\.sessions\.create|process\.env/,
  );
});
