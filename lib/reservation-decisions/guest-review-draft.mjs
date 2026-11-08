export const GUEST_REVIEW_DRAFT_TTL_MS = 30 * 60 * 1000;

const supportedKinds = new Set(["change_dates", "cancellation_review"]);

export function guestReviewDraftKey({ guestId, reservationId, kind }) {
  const user = String(guestId ?? "").trim();
  const reservation = String(reservationId ?? "").trim();
  if (
    !user ||
    !reservation ||
    user.length > 128 ||
    reservation.length > 128 ||
    !supportedKinds.has(kind)
  ) {
    throw new Error("Invalid guest review draft scope.");
  }
  return `icamp:guest-review-draft:v1:${user}:${reservation}:${kind}`;
}

export function createGuestReviewDraft(reason, now = Date.now()) {
  if (!Number.isSafeInteger(now) || now < 0) {
    throw new Error("Invalid draft timestamp.");
  }
  const value = String(reason ?? "");
  if (value.length > 500) {
    throw new Error("Draft reason is too long.");
  }
  return {
    version: 1,
    reason: value,
    expiresAt: now + GUEST_REVIEW_DRAFT_TTL_MS,
  };
}

export function readGuestReviewDraft(raw, now = Date.now()) {
  if (typeof raw !== "string" || raw.length > 1500) return null;
  if (!Number.isSafeInteger(now) || now < 0) return null;
  try {
    const draft = JSON.parse(raw);
    if (
      !draft ||
      draft.version !== 1 ||
      typeof draft.reason !== "string" ||
      draft.reason.length > 500 ||
      !Number.isSafeInteger(draft.expiresAt) ||
      draft.expiresAt <= now ||
      draft.expiresAt > now + GUEST_REVIEW_DRAFT_TTL_MS ||
      Object.keys(draft).sort().join(",") !== "expiresAt,reason,version"
    ) {
      return null;
    }
    return draft;
  } catch {
    return null;
  }
}
