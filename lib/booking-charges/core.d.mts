export interface BookingChargeCatalogItem {
  id?: string | null;
  scopeKind: "campground" | "accommodation_type" | "accommodation";
  accommodationKind?: "campsite" | "rental_cottage" | null;
  accommodationId?: string | null;
  chargeKind: "add_on" | "pass" | "service_fee";
  applicationMode: "optional" | "automatic";
  code: string;
  displayName: string;
  description?: string | null;
  currencyCode: string;
  pricingBasis: "per_stay" | "per_night" | "per_unit" | "percent_of_stay";
  unitPriceCents?: number | null;
  percentageBasisPoints?: number | null;
  unitLabel?: string | null;
  passDurationDays?: number | null;
  minimumQuantity: number;
  maximumQuantity: number;
  taxCategoryCode?: string | null;
  feeCategoryCode?: string | null;
  isPublic?: boolean;
  isActive?: boolean;
}

export interface BookingChargeQuote {
  currencyCode: string;
  totalCents: number;
  automaticTotalCents: number;
  optionalTotalCents: number;
  lines: Array<{
    id: string | null;
    code: string;
    displayName: string;
    chargeKind: string;
    applicationMode: "optional" | "automatic";
    quantity: number;
    lineTotalCents: number;
    currencyCode: string;
    taxCategoryCode: string | null;
    feeCategoryCode: string | null;
  }>;
}

export function listApplicableBookingCharges(
  input: Record<string, unknown>,
): BookingChargeCatalogItem[];
export function quoteBookingCharges(
  input: Record<string, unknown>,
): BookingChargeQuote;
export function bookingChargePriceLabel(
  item: BookingChargeCatalogItem,
  currencyCode?: string,
): string;
