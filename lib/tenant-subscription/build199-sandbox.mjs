import {
  createHash,
  createHmac,
  randomBytes,
  timingSafeEqual,
} from "node:crypto";

import {
  createSandboxLifecycle,
  replaySandboxEvent,
} from "./sandbox-lifecycle.mjs";
import { previewSubscriberConsentReceipt } from "./foundation.mjs";

const TEST_SCHEMA = "icamp.subscription.signed-test-envelope.v1";
const MAX_SKEW_SECONDS = 300;
const TEST_TENANT = "test_camp_rosevear";
const FIXTURE_SECOND = 1793808000;

export const BUILD199_SCENARIOS = Object.freeze({
  normal: Object.freeze({
    label: "Checkout & renewal",
    events: [
      ["checkout.session.completed"],
      ["customer.subscription.created"],
      ["invoice.paid"],
      ["customer.subscription.updated", "active"],
      ["invoice.paid"],
    ],
  }),
  recovery: Object.freeze({
    label: "Failed renewal, retry & recovery",
    events: [
      ["checkout.session.completed"],
      ["customer.subscription.created"],
      ["invoice.payment_failed"],
      ["invoice.paid"],
    ],
  }),
  cancellation: Object.freeze({
    label: "Cancellation",
    events: [
      ["customer.subscription.created"],
      ["invoice.paid"],
      ["customer.subscription.deleted"],
    ],
  }),
  dispute: Object.freeze({
    label: "Dispute & refund review",
    events: [
      ["customer.subscription.created"],
      ["invoice.paid"],
      ["charge.dispute.created"],
      ["charge.refunded"],
    ],
  }),
});

function assertTestSecret(secret) {
  if (!Buffer.isBuffer(secret) || secret.byteLength < 32) {
    throw new Error("A fresh in-memory test signing secret is required.");
  }
}

export function signSyntheticWebhook({ payload, timestamp, secret }) {
  assertTestSecret(secret);
  if (!Number.isSafeInteger(timestamp) || timestamp <= 0)
    throw new Error("Synthetic webhook timestamp is invalid.");
  if (typeof payload !== "string" || payload.length > 4096)
    throw new Error("Synthetic webhook body is invalid.");
  const digest = createHmac("sha256", secret)
    .update(`${timestamp}.${payload}`)
    .digest("hex");
  return `t=${timestamp},v1=${digest}`;
}

/** No provider webhook is received. Only a locally generated, in-memory fixture. */
export function verifySyntheticWebhook({ payload, header, secret, now }) {
  assertTestSecret(secret);
  if (typeof header !== "string" || header.length > 128)
    throw new Error("Synthetic signature missing or malformed.");
  const match = /^t=([1-9][0-9]{0,15}),v1=([a-f0-9]{64})$/.exec(header);
  if (!match || !Number.isSafeInteger(now))
    throw new Error("Synthetic signature missing or malformed.");
  const timestamp = Number(match[1]);
  if (
    !Number.isSafeInteger(timestamp) ||
    Math.abs(now - timestamp) > MAX_SKEW_SECONDS
  ) {
    throw new Error("Synthetic webhook timestamp is outside the test window.");
  }
  const expected = signSyntheticWebhook({ payload, timestamp, secret });
  const candidate = Buffer.from(match[2], "hex");
  const known = Buffer.from(expected.slice(expected.indexOf("v1=") + 3), "hex");
  if (!timingSafeEqual(candidate, known))
    throw new Error("Synthetic webhook signature mismatch.");
  const data = JSON.parse(payload);
  if (
    data?.schema !== TEST_SCHEMA ||
    data?.livemode !== false ||
    data?.environment !== "IN_MEMORY_TEST" ||
    typeof data?.tenantKey !== "string" ||
    typeof data?.id !== "string"
  ) {
    throw new Error("Synthetic webhook is not a test-mode event.");
  }
  return Object.freeze(data);
}

export function previewSandboxLegalGate({
  termsVersion,
  privacyVersion,
  explicitlyAccepted,
  signedInActor,
  submittingActor,
  independentReviewer,
} = {}) {
  if (
    !/^[a-zA-Z0-9_-]{3,64}$/.test(signedInActor ?? "") ||
    signedInActor !== submittingActor
  ) {
    throw new Error("Consent preview requires its authenticated test actor.");
  }
  if (
    !/^[a-zA-Z0-9_-]{3,64}$/.test(independentReviewer ?? "") ||
    independentReviewer === submittingActor
  ) {
    throw new Error("An independent reviewer is required.");
  }
  const draft = previewSubscriberConsentReceipt({
    termsVersion,
    privacyVersion,
    consentGranted: explicitlyAccepted,
  });
  return Object.freeze({
    ...draft,
    actor: signedInActor,
    reviewer: independentReviewer,
    provider_test_evidence: "MISSING",
    legal_approval_evidence: "MISSING",
    source_signer_evidence: "MISSING",
    actual_consent_captured: false,
    activation: "HELD",
  });
}

/**
 * Exercises the signed lifecycle in memory. Never creates checkout sessions,
 * sends provider requests, records legal consent or changes tenant status.
 */
export function runBuild199Scenario(scenario = "normal") {
  const selected = BUILD199_SCENARIOS[scenario];
  if (!Object.hasOwn(BUILD199_SCENARIOS, scenario) || !selected)
    throw new Error("Unknown sandbox-only scenario.");
  const secret = randomBytes(32);
  let snapshot = createSandboxLifecycle(TEST_TENANT);
  let replayDedupe = 0;
  const signedEvents = [];
  try {
    for (const [index, [type, status]] of selected.events.entries()) {
      const event = {
        schema: TEST_SCHEMA,
        id: `test_evt_${String(index + 1).padStart(3, "0")}`,
        type,
        ...(status ? { status } : {}),
        tenantKey: TEST_TENANT,
        environment: "IN_MEMORY_TEST",
        livemode: false,
      };
      const payload = JSON.stringify(event);
      const signature = signSyntheticWebhook({
        payload,
        timestamp: FIXTURE_SECOND,
        secret,
      });
      const verified = verifySyntheticWebhook({
        payload,
        header: signature,
        secret,
        now: FIXTURE_SECOND,
      });
      snapshot = replaySandboxEvent(snapshot, verified);
      const again = replaySandboxEvent(snapshot, verified);
      if (again !== snapshot)
        throw new Error("Duplicate replay was not stable.");
      replayDedupe += 1;
      signedEvents.push({ id: event.id, type, verified: true });
    }
    const consent = previewSandboxLegalGate({
      termsVersion: "sample-terms-2026.1",
      privacyVersion: "sample-privacy-2026.1",
      explicitlyAccepted: true,
      signedInActor: "test_author_01",
      submittingActor: "test_author_01",
      independentReviewer: "test_reviewer_02",
    });
    const sourceHash = createHash("sha256")
      .update(JSON.stringify({ scenario, signedEvents, tenant: TEST_TENANT }))
      .digest("hex");
    return Object.freeze({
      schema: "icamp.build199.sandbox-fixture-report.v1",
      build: 199,
      scenario,
      label: selected.label,
      event_source: "LOCAL_SYNTHETIC_FIXTURE_ONLY",
      source_sha256: sourceHash,
      tenant_key: TEST_TENANT,
      lifecycle: snapshot,
      signed_events_verified: signedEvents.length,
      duplicate_deliveries_ignored: replayDedupe,
      events: signedEvents,
      consent_preview: consent,
      provider_official_test_receipts: "MISSING",
      legal_documents_approved: false,
      real_charges_possible: false,
      outbound_calls: false,
      persisted: false,
      activation: "HELD",
    });
  } finally {
    secret.fill(0);
  }
}
