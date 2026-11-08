import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import {
  createGuestReviewDraft,
  GUEST_REVIEW_DRAFT_TTL_MS,
  guestReviewDraftKey,
  readGuestReviewDraft,
} from "../lib/reservation-decisions/guest-review-draft.mjs";

test("Build 224 stores only explicitly scoped, time-limited review reasons", () => {
  const scope = {
    guestId: "guest-a",
    reservationId: "reservation-one",
    kind: "change_dates",
  };
  const key = guestReviewDraftKey(scope);
  assert.notEqual(key, guestReviewDraftKey({ ...scope, guestId: "guest-b" }));
  assert.notEqual(
    key,
    guestReviewDraftKey({ ...scope, reservationId: "reservation-two" }),
  );
  assert.notEqual(
    key,
    guestReviewDraftKey({ ...scope, kind: "cancellation_review" }),
  );
  assert.throws(() => guestReviewDraftKey({ ...scope, kind: "cancel" }));
  assert.throws(() => guestReviewDraftKey({ ...scope, guestId: "" }));

  const now = 1_800_000_000_000;
  const saved = createGuestReviewDraft("Need to arrive later", now);
  assert.equal(saved.expiresAt, now + GUEST_REVIEW_DRAFT_TTL_MS);
  assert.deepEqual(readGuestReviewDraft(JSON.stringify(saved), now), saved);
  assert.equal(
    readGuestReviewDraft(JSON.stringify(saved), saved.expiresAt),
    null,
  );
  assert.throws(() => createGuestReviewDraft("a".repeat(501), now));
});

test("Build 224 rejects malformed, overscoped and fabricated recovery data", () => {
  const now = 1_800_000_000_000;
  const valid = createGuestReviewDraft("Need time to review", now);
  for (const input of [
    "not-json",
    JSON.stringify({ ...valid, version: 2 }),
    JSON.stringify({ ...valid, reason: "a".repeat(501) }),
    JSON.stringify({ ...valid, expiresAt: now + 31 * 60_000 }),
    JSON.stringify({ ...valid, expiresAt: "later" }),
    JSON.stringify({ ...valid, reason: { text: "invalid" } }),
    JSON.stringify({ ...valid, paymentToken: "not trusted" }),
  ]) {
    assert.equal(readGuestReviewDraft(input, now), null);
  }
});

test("Build 224 shows mobile choice, source-only money and opt-in tab recovery", async () => {
  const page = await readFile("app/guest/reservation-options/page.tsx", "utf8");
  const client = await readFile("components/guest-review-reason.tsx", "utf8");
  const styles = await readFile(
    "app/guest/reservation-options/reservation-options.module.css",
    "utf8",
  );
  const action = await readFile(
    "app/guest/reservation-options/actions.ts",
    "utf8",
  );
  assert.match(page, /aria-label="Reservation options guide"/);
  assert.match(page, /#reservation-date-preview/);
  assert.match(page, /#reservation-cancel-preview/);
  assert.match(page, /cancellation\.status === "estimated"/);
  assert.match(page, /cancellation\.recommendation\.recommendedRefundCents/);
  assert.match(page, /<GuestReviewReason/);
  assert.match(styles, /@media \(max-width: 760px\)/);
  assert.match(client, /sessionStorage\.setItem/);
  assert.match(client, /if \(!remember\) return/);
  assert.match(client, /sessionStorage\.removeItem/);
  assert.match(client, /clearOnSuccess/);
  assert.match(client, /do not use on a shared device/);
  assert.match(client, /type="checkbox"/);
  assert.match(page, /getOwnReservationDecisionSource/);
  assert.match(page, /listOwnReservationReviewRequests/);
  assert.match(action, /requireSignedIn/);
  assert.match(action, /expectedReservationVersion/);
  assert.doesNotMatch(
    action,
    /cancelReservation|requestReservationRefund|submitRefund|capturePayment|sendSms|sendEmail/,
  );
});
