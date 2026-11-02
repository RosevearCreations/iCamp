export interface PricingQuote {
  status: "quoted" | "unavailable";
  nights: number;
  currencyCode: string | null;
  totalCents: number | null;
  baseCents?: number;
  adjustmentCents?: number;
  plan: null | { id: string; code: string; displayName: string };
  adjustments: Array<{
    date: string;
    code: string;
    displayName: string;
    deltaCents: number;
  }>;
}

export function selectRatePlan(
  input: Record<string, unknown>,
): Record<string, unknown> | null;
export function quoteAccommodationStay(
  input: Record<string, unknown>,
): PricingQuote;
export function formatMoney(
  centsValue: number | null,
  currencyCode?: string,
): string;
