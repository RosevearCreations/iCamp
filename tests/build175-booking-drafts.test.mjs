import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

import {
  BOOKING_DRAFT_TTL_DAYS,
  bookingDraftDetailHref,
  compareBookingDraftToLive,
  normalizeBookingDraftInput,
  quoteSnapshot,
} from "../lib/booking-drafts/core.mjs";

const arrivalDate = "2026-11-15";
const departureDate = "2026-11-17";
const base = {
  campgroundSlug: "camp-rosevear",
  accommodationId: "11111111-1111-4111-8111-111111111111",
  arrivalDate,
  departureDate,
  extra1: "pet-pass",
  quantity1: "2",
};
const now = new Date("2026-11-01T12:00:00.000Z");

const detail = {
  availability: { selectable: true },
  quotePreview: {
    status: "quoted",
    knownSubtotalCents: 23100,
    currencyCode: "CAD",
    availabilityRevision: 4,
    quotedAt: "2026-11-01T12:00:00Z",
  },
  selectionError: null,
};
const draft = {
  ...normalizeBookingDraftInput(base, now),
  savedQuote: quoteSnapshot(detail),
};

test("Build 175 validates saved dates, campground, UUID, and bounded extras", () => {
  assert.equal(BOOKING_DRAFT_TTL_DAYS, 7);
  assert.equal(normalizeBookingDraftInput(base, now).nights, 2);
  assert.deepEqual(normalizeBookingDraftInput(base, now).selections, [
    { code: "pet-pass", quantity: 2 },
  ]);
  for (const input of [
    { ...base, campgroundSlug: "../unsafe" },
    { ...base, accommodationId: "not-a-uuid" },
    { ...base, arrivalDate: "2026-10-30" },
    { ...base, departureDate: "2027-12-01" },
    { ...base, extra1: "pet-pass", extra2: "pet-pass" },
    { ...base, quantity1: "1000" },
  ]) {
    assert.throws(() => normalizeBookingDraftInput(input, now));
  }
});

test("Build 175 recovery URL restores selections but never price, token or personal identity", () => {
  const url = bookingDraftDetailHref(draft);
  const parsed = new URL(url, "https://example.org");
  assert.equal(
    parsed.pathname,
    `/booking/accommodations/${base.accommodationId}`,
  );
  assert.equal(parsed.searchParams.get("campground"), "camp-rosevear");
  assert.equal(parsed.searchParams.get("extra1"), "pet-pass");
  assert.equal(parsed.searchParams.get("quantity1"), "2");
  assert.equal(parsed.searchParams.get("total"), null);
  assert.equal(parsed.searchParams.get("userId"), null);
});

test("Build 175 live price, currency, revision, availability and invalid extras trigger explicit recheck", () => {
  assert.equal(compareBookingDraftToLive(draft, detail).status, "current");
  assert.equal(
    compareBookingDraftToLive(draft, {
      ...detail,
      quotePreview: { ...detail.quotePreview, knownSubtotalCents: 24000 },
    }).status,
    "changed",
  );
  assert.equal(
    compareBookingDraftToLive(draft, {
      ...detail,
      quotePreview: { ...detail.quotePreview, availabilityRevision: 5 },
    }).status,
    "changed",
  );
  assert.equal(
    compareBookingDraftToLive(draft, {
      ...detail,
      quotePreview: { ...detail.quotePreview, currencyCode: "USD" },
    }).status,
    "changed",
  );
  assert.equal(
    compareBookingDraftToLive(draft, {
      ...detail,
      availability: { selectable: false },
    }).status,
    "unavailable",
  );
  assert.equal(
    compareBookingDraftToLive(draft, {
      ...detail,
      selectionError: "Discontinued",
    }).status,
    "unavailable",
  );
  assert.equal(compareBookingDraftToLive(draft, null).status, "unavailable");
});

test("Build 175 schema restricts direct Data API and all four CRUD operations to RLS owner", () => {
  const migration = fs.readFileSync(
    new URL(
      "../database/migrations/0186_build175_guest_booking_drafts.sql",
      import.meta.url,
    ),
    "utf8",
  );
  assert.match(migration, /enable row level security/);
  assert.match(migration, /force row level security/);
  assert.match(
    migration,
    /revoke all on public\.guest_booking_drafts from authenticated/,
  );
  assert.match(
    migration,
    /revoke all on public\.guest_booking_drafts from anon/,
  );
  assert.equal(
    (migration.match(/current_setting\('icamp\.user_id'/gu) ?? []).length,
    5,
  );
  assert.match(migration, /on delete cascade/);
  assert.match(migration, /expires_at > consented_at/);
  assert.match(migration, /guest_booking_drafts_accommodation_fk/);
  assert.match(migration, /guest_booking_drafts_unique_selection/);
  assert.doesNotMatch(migration, /security definer/iu);
});

test("Build 175 server action is consented, authenticated, revalidated, and contains no checkout/payment/messaging call", () => {
  const actions = fs.readFileSync(
    new URL("../app/guest/booking-drafts/actions.ts", import.meta.url),
    "utf8",
  );
  const postgres = fs.readFileSync(
    new URL("../lib/booking-drafts/postgres.mjs", import.meta.url),
    "utf8",
  );
  const detailPage = fs.readFileSync(
    new URL(
      "../app/booking/accommodations/[accommodationId]/page.tsx",
      import.meta.url,
    ),
    "utf8",
  );
  assert.match(actions, /requireSignedIn/);
  assert.match(actions, /accountType !== "guest"/);
  assert.match(actions, /saveConsent/);
  assert.match(actions, /getPublicAccommodationDetail/);
  assert.match(actions, /deleteOwnBookingDraft/);
  assert.match(postgres, /set local role icamp_app/);
  assert.match(postgres, /where user_account_id=\$1/);
  assert.match(postgres, /user_account_id=\$2/);
  assert.match(postgres, /expires_at <= statement_timestamp/);
  assert.match(
    postgres,
    /on conflict on constraint guest_booking_drafts_unique_selection/,
  );
  assert.match(postgres, /is distinct from excluded/);
  assert.match(detailPage, /action=\{saveBookingDraftAction\}/);
  assert.match(detailPage, /type="checkbox" name="saveConsent" required/);
  assert.doesNotMatch(
    actions,
    /startReservationCheckout|finalizeReservationCheckout|capturePayment|sendSms|sendEmail/u,
  );
  assert.doesNotMatch(
    postgres,
    /insert into public\.reservations|insert into .*hold|payment_intent/iu,
  );
});
