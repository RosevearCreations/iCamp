import { calculateReservationPaymentSchedule } from "../payments/core.mjs";

export const PUBLIC_QUOTE_TTL_MINUTES = 10;
export const PUBLIC_QUOTE_EXTRA_SLOTS = 3;

export function parsePublicQuoteSelections(input = {}) {
  const selections = [];
  const seen = new Set();
  for (let index = 1; index <= PUBLIC_QUOTE_EXTRA_SLOTS; index += 1) {
    const codeRaw = input[`extra${index}`] ?? "";
    const quantityRaw = input[`quantity${index}`] ?? "1";
    if (typeof codeRaw !== "string" || typeof quantityRaw !== "string") {
      throw new Error("Quote selection is invalid.");
    }
    const code = codeRaw.trim();
    if (!code) continue;
    if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/u.test(code) || code.length > 64) {
      throw new Error("Quote add-on code is invalid.");
    }
    if (!/^[1-9]\d{0,2}$/u.test(quantityRaw.trim())) {
      throw new Error("Quote add-on quantity is invalid.");
    }
    const quantity = Number(quantityRaw);
    if (quantity > 100 || seen.has(code)) {
      throw new Error("Quote add-on quantity or duplicate is invalid.");
    }
    seen.add(code);
    selections.push({ code, quantity });
  }
  return selections;
}

function allocateNightly(pricingQuote, arrivalDate) {
  const nights = pricingQuote.nights;
  const base = Math.floor(pricingQuote.baseCents / nights);
  const remainder = pricingQuote.baseCents - base * nights;
  const byDay = new Map();
  for (const adjustment of pricingQuote.adjustments) {
    byDay.set(
      adjustment.date,
      (byDay.get(adjustment.date) ?? 0) + adjustment.deltaCents,
    );
  }
  const first = Date.parse(`${arrivalDate}T00:00:00Z`);
  return Array.from({ length: nights }, (_, index) => {
    const date = new Date(first + index * 86_400_000)
      .toISOString()
      .slice(0, 10);
    const baseCents = base + (index < remainder ? 1 : 0);
    const adjustmentCents = byDay.get(date) ?? 0;
    return {
      date,
      baseCents,
      adjustmentCents,
      allocatedCents: baseCents + adjustmentCents,
    };
  });
}

export function createPublicQuotePreview({
  pricingQuote,
  chargeQuote,
  paymentPolicy = null,
  cancellationPolicy = null,
  arrivalDate,
  departureDate,
  availabilityRevision,
  quotedAt = new Date().toISOString(),
}) {
  if (pricingQuote?.status !== "quoted" || !chargeQuote) {
    return {
      status: "rate_unavailable",
      quotedAt,
      expiresAt: null,
      currencyCode: null,
      taxStatus: "unconfigured",
    };
  }
  if (pricingQuote.currencyCode !== chargeQuote.currencyCode) {
    throw new Error("Quote and public charges must have identical currency.");
  }
  const time = Date.parse(quotedAt);
  if (!Number.isFinite(time)) throw new Error("Quote timestamp is invalid.");
  const knownSubtotalCents = pricingQuote.totalCents + chargeQuote.totalCents;
  const baseAndAdjustments =
    pricingQuote.baseCents + pricingQuote.adjustmentCents;
  const rateFloorCorrectionCents = pricingQuote.totalCents - baseAndAdjustments;
  const nightly = allocateNightly(pricingQuote, arrivalDate);
  const paymentCurrencyMatches =
    paymentPolicy?.currencyCode === pricingQuote.currencyCode;
  const cancellationCurrencyMatches =
    cancellationPolicy?.currencyCode === pricingQuote.currencyCode;

  let paymentSchedule = null;
  if (paymentCurrencyMatches) {
    paymentSchedule = calculateReservationPaymentSchedule({
      totalCents: knownSubtotalCents,
      currencyCode: pricingQuote.currencyCode,
      arrivalDate,
      bookingDate: quotedAt.slice(0, 10),
      policy: paymentPolicy,
    });
  }
  return {
    status: "quoted",
    quotedAt,
    expiresAt: new Date(time + PUBLIC_QUOTE_TTL_MINUTES * 60_000).toISOString(),
    arrivalDate,
    departureDate,
    nights: pricingQuote.nights,
    currencyCode: pricingQuote.currencyCode,
    ratePlan: pricingQuote.plan.displayName,
    availabilityRevision: Number(availabilityRevision),
    baseCents: pricingQuote.baseCents,
    adjustments: pricingQuote.adjustments,
    adjustmentCents: pricingQuote.adjustmentCents,
    rateFloorCorrectionCents,
    nightly,
    stayCents: pricingQuote.totalCents,
    charges: chargeQuote.lines,
    automaticCents: chargeQuote.automaticTotalCents,
    optionalCents: chargeQuote.optionalTotalCents,
    knownSubtotalCents,
    // No campground tax-rate table exists in the canonical booking system.
    // Never report a final tax-inclusive amount or silently infer zero tax.
    taxStatus: "unconfigured",
    taxCents: null,
    finalTotalCents: null,
    paymentSchedule,
    cancellationPolicy: cancellationCurrencyMatches ? cancellationPolicy : null,
    policyWarnings: [
      !paymentPolicy
        ? "Deposit terms not configured."
        : !paymentCurrencyMatches
          ? "Deposit terms use a different currency and cannot be estimated."
          : null,
      !cancellationPolicy
        ? "Cancellation/refund terms not configured."
        : !cancellationCurrencyMatches
          ? "Cancellation terms use a different currency and require staff confirmation."
          : null,
    ].filter(Boolean),
  };
}
