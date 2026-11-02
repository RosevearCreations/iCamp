import test from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { readFileSync } from "node:fs";
import {
  normalizeDisclosureVersion,
  normalizeDisclosureReview,
  normalizeDeliveryConsent,
  normalizeDeliverySignoff,
} from "../lib/permanent-unit-delivery/core.mjs";
const id = () => randomUUID();
test("disclosure identity pins exact SHA-256 and jurisdiction/version code", () => {
  const base = {
    id: id(),
    jurisdiction: "Ontario, Canada",
    versionCode: "ON-2026-01",
    documentReference: "PRIVATE-DOC-095",
    sha256: "a".repeat(64),
    legalReviewReference: "LEGAL-REVIEW-095",
    note: "Synthetic version with source",
  };
  assert.equal(normalizeDisclosureVersion(base).sha256, "a".repeat(64));
  assert.throws(
    () => normalizeDisclosureVersion({ ...base, sha256: "bad" }),
    /SHA-256/u,
  );
});
test("independent review and consent admit only bounded states and channels", () => {
  assert.equal(
    normalizeDisclosureReview({
      id: id(),
      versionId: id(),
      outcome: "approved_internal_use",
      note: "Externally checked disclosure",
    }).outcome,
    "approved_internal_use",
  );
  assert.throws(
    () =>
      normalizeDisclosureReview({
        id: id(),
        versionId: id(),
        outcome: "issued_to_buyer",
        note: "No delivery supported",
      }),
    /approve internal use/u,
  );
  const base = {
    id: id(),
    proposalId: id(),
    versionId: id(),
    channel: "secure_portal",
    consentReference: "CONSENT-SYNTH-095",
    recipientReference: "RECIPIENT-SECURE-095",
    note: "Consent obtained outside app",
  };
  assert.equal(normalizeDeliveryConsent(base).channel, "secure_portal");
  assert.throws(
    () => normalizeDeliveryConsent({ ...base, channel: "sms" }),
    /in-person or verified/u,
  );
});
test("final manual signoff cannot become customer delivery or loan acceptance", () => {
  const base = {
    id: id(),
    consentId: id(),
    decision: "ready_for_manual_handoff",
    reviewReference: "SYNTH-SIGNOFF-095",
    note: "Independent operational handoff only",
  };
  assert.equal(
    normalizeDeliverySignoff(base).decision,
    "ready_for_manual_handoff",
  );
  assert.throws(
    () => normalizeDeliverySignoff({ ...base, decision: "agreement_signed" }),
    /manual handoff readiness/u,
  );
});
test("database enforces privacy, exact version pinning and independent manual boundary", () => {
  const sql = readFileSync(
    new URL(
      "../database/migrations/0127_permanent_unit_offer_delivery_boundary.sql",
      import.meta.url,
    ),
    "utf8",
  );
  for (const fragment of [
    "force row level security",
    "content_sha256",
    "unique(campground_id,jurisdiction,version_code)",
    "Independent disclosure review",
    "Consent recording must be independent",
    "Independent sign-off",
    "ready_for_manual_handoff",
    "winterization_append_only",
  ])
    assert.ok(sql.toLowerCase().includes(fragment.toLowerCase()), fragment);
});
