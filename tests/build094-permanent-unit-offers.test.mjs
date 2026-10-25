import test from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { readFileSync } from "node:fs";
import {
  illustrativePayment,
  normalizeOfferTerms,
  normalizeOfferAuthorization,
} from "../lib/permanent-unit-offers/core.mjs";
const id = () => randomUUID();
test("illustrative amortization is bounded, integer-cent and zero-rate safe", () => {
  assert.equal(illustrativePayment(120000, 0, 12), 10000);
  assert.equal(illustrativePayment(100000, 1200, 12), 8885);
  assert.throws(() => illustrativePayment(100000, 9999, 12), /Invalid/u);
  assert.throws(() => illustrativePayment(100000, 0, 0), /Invalid/u);
});
test("non-binding terms normalize bounded principal, rate, term, fees and sources", () => {
  const x = {
    id: id(),
    applicationId: id(),
    principal: "1000.25",
    annualRateBps: "1250",
    months: "24",
    fee: "0",
    policyReference: "SYNTH-094-POLICY",
    disclosureReference: "SYNTH-094-DISCLOSURE",
    note: "Internal draft for test only",
  };
  assert.equal(normalizeOfferTerms(x).principalCents, 100025);
  assert.equal(normalizeOfferTerms(x).feeCents, 0);
  assert.throws(
    () => normalizeOfferTerms({ ...x, fee: "2000.00" }),
    /cannot exceed/u,
  );
  assert.throws(
    () => normalizeOfferTerms({ ...x, annualRateBps: "12.5" }),
    /integer/u,
  );
});
test("authorization never accepts customer-facing issuance, funding or credit approval", () => {
  const x = {
    id: id(),
    proposalId: id(),
    decision: "authorized_internal_preparation",
    externalReviewReference: "SYNTH-094-REVIEW",
    note: "Independent office preparation only",
  };
  assert.equal(
    normalizeOfferAuthorization(x).decision,
    "authorized_internal_preparation",
  );
  assert.throws(
    () => normalizeOfferAuthorization({ ...x, decision: "loan_approved" }),
    /internal preparation/u,
  );
});
test("migration protects scope, separation of duties, immutability and concurrency", () => {
  const sql = readFileSync(
    new URL(
      "../database/migrations/0126_permanent_unit_financing_offers.sql",
      import.meta.url,
    ),
    "utf8",
  );
  for (const term of [
    "force row level security",
    "pg_advisory_xact_lock",
    "complete_for_external_review",
    "Offer review must be independent",
    "authorized_internal_preparation",
    "winterization_append_only",
    "permanent_unit.transfer",
  ])
    assert.match(sql, new RegExp(term, "iu"));
});
