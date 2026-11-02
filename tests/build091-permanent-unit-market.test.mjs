import test from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { readFileSync } from "node:fs";
import {
  normalizeOwnership,
  normalizeListing,
  normalizeInquiry,
  listingIsCurrent,
} from "../lib/permanent-unit-market/core.mjs";

const id = () => randomUUID();
test("ownership source and record history are mandatory", () => {
  const value = normalizeOwnership({
    id: id(),
    accommodationId: id(),
    ownerDisplayName: "Test Owner",
    evidenceReference: "SYNTH-OWNER-091",
    notes: "Synthetic test evidence only",
  });
  assert.equal(value.eventKind, "owner_recorded");
  assert.throws(
    () => normalizeOwnership({ ...value, eventKind: "transfer_completed" }),
    /Invalid ownership/u,
  );
  assert.throws(
    () => normalizeOwnership({ ...value, evidenceReference: "" }),
    /Ownership source/u,
  );
});
test("asking prices parse exactly as integer cents without floating errors", () => {
  const base = {
    id: id(),
    accommodationId: id(),
    ownershipEventId: id(),
    headline: "Test listing title",
    description: "Synthetic trailer details for testing",
    askingPrice: "12000.05",
  };
  assert.equal(normalizeListing(base).askingPriceCents, 1200005);
  assert.throws(
    () => normalizeListing({ ...base, askingPrice: "12.999" }),
    /Asking price/u,
  );
  assert.throws(
    () => normalizeListing({ ...base, askingPrice: "-10" }),
    /Asking price/u,
  );
});
test("buyer contact is private reference and cannot be empty", () => {
  assert.throws(
    () =>
      normalizeInquiry({
        id: id(),
        listingId: id(),
        buyerDisplayName: "Buyer",
        contactReference: "",
        inquiryNote: "Call after Monday morning",
      }),
    /Private contact/u,
  );
});
test("new ownership supersedes existing listing evidence", () => {
  const current = {
    id: id(),
    accommodation_id: "site",
    event_kind: "owner_recorded",
  };
  const listing = { accommodation_id: "site", ownership_event_id: current.id };
  assert.equal(listingIsCurrent(listing, [current]), true);
  assert.equal(
    listingIsCurrent(listing, [{ ...current, id: id() }, current]),
    false,
  );
  assert.equal(
    listingIsCurrent(listing, [{ ...current, event_kind: "ownership_ended" }]),
    false,
  );
});
test("database guards private RLS, immutable ownership, independent review and current owner", () => {
  const sql = readFileSync(
    new URL(
      "../database/migrations/0123_permanent_unit_ownership_listings.sql",
      import.meta.url,
    ),
    "utf8",
  );
  for (const fragment of [
    "force row level security",
    "permanent_unit_ownership_immutable",
    "Listing approval must be independent",
    "latest active ownership evidence",
    "Buyer inquiries require an approved listing",
    "permanent_unit.manage",
  ])
    assert.match(sql, new RegExp(fragment, "iu"));
});
