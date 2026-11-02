import type { BookingChargeQuote } from "../booking-charges/core.mjs";
import type { PaymentPolicy } from "../payments/core.mjs";
import type { PricingQuote } from "../pricing/core.mjs";

export interface PublicQuotePreview {
  status: "quoted" | "rate_unavailable";
  quotedAt: string;
  expiresAt: string | null;
  currencyCode: string | null;
  taxStatus: "unconfigured";
  taxCents?: null;
  finalTotalCents?: null;
  arrivalDate?: string;
  departureDate?: string;
  nights?: number;
  ratePlan?: string;
  availabilityRevision?: number;
  baseCents?: number;
  adjustments?: Array<{
    date: string;
    displayName: string;
    code: string;
    deltaCents: number;
  }>;
  adjustmentCents?: number;
  rateFloorCorrectionCents?: number;
  nightly?: Array<{
    date: string;
    baseCents: number;
    adjustmentCents: number;
    allocatedCents: number;
  }>;
  stayCents?: number;
  charges?: BookingChargeQuote["lines"];
  automaticCents?: number;
  optionalCents?: number;
  knownSubtotalCents?: number;
  paymentSchedule?: {
    bookingDepositCents: number;
    reservationBalanceCents: number;
    balanceDueDate: string;
    securityDepositCents: number;
    securityDepositDueStage: string;
    bookingDueCents: number;
    totalPayableCents: number;
    balanceDueMode: string;
  } | null;
  cancellationPolicy?: {
    freeCancellationDaysBeforeArrival: number;
    earlyRefundBasisPoints: number;
    lateRefundBasisPoints: number;
    securityDepositRefundBasisPoints: number;
    cancellationFeeCents: number;
  } | null;
  policyWarnings?: string[];
}

export const PUBLIC_QUOTE_TTL_MINUTES: 10;
export const PUBLIC_QUOTE_EXTRA_SLOTS: 3;
export function parsePublicQuoteSelections(
  input?: Record<string, unknown>,
): Array<{ code: string; quantity: number }>;
export function createPublicQuotePreview(input: {
  pricingQuote: PricingQuote;
  chargeQuote: BookingChargeQuote | null;
  paymentPolicy?: PaymentPolicy | null;
  cancellationPolicy?: {
    currencyCode: string;
    freeCancellationDaysBeforeArrival: number;
    earlyRefundBasisPoints: number;
    lateRefundBasisPoints: number;
    securityDepositRefundBasisPoints: number;
    cancellationFeeCents: number;
  } | null;
  arrivalDate: string;
  departureDate: string;
  availabilityRevision: number;
  quotedAt?: string;
}): PublicQuotePreview;
