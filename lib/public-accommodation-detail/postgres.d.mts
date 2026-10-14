export interface PublicAccommodationDetail {
  campground: {
    id: string;
    name: string;
    slug: string;
  };
  accommodation: {
    id: string;
    code: string;
    displayName: string;
    kind: "campsite" | "rental_cottage";
    sectionName: string | null;
  };
  dates: {
    arrivalDate: string;
    departureDate: string;
    nights: number;
  };
  availability: {
    tone: "green" | "grey" | "yellow" | "red";
    label: string;
    selectable: boolean;
    blockers: string[];
  };
  facts: Array<{ label: string; value: string }>;
  rules: Array<{ label: string; value: string }>;
  rateSummary: {
    status: "quoted" | "rate_unavailable";
    label: string;
    detail: string;
    currencyCode: string | null;
    totalCents: number | null;
    baseCents: number | null;
    adjustmentCents: number | null;
    adjustments: Array<{
      date: string;
      code: string;
      displayName: string;
      deltaCents: number;
    }>;
  };
  bookingCharges: {
    currencyCode: string;
    automaticTotalCents: number | null;
    estimatedTotalCents: number | null;
    items: Array<{
      id: string;
      code: string;
      displayName: string;
      description: string | null;
      chargeKind: "add_on" | "pass" | "service_fee";
      applicationMode: "optional" | "automatic";
      priceLabel: string;
      passDurationDays: number | null;
      minimumQuantity: number;
      maximumQuantity: number;
      taxCategoryCode: string | null;
      feeCategoryCode: string | null;
    }>;
  };
  gallery: Array<{
    id: string;
    caption: string | null;
    altText: string;
    sortOrder: number;
    isHero: boolean;
    url: string | null;
  }>;
  mapContext: {
    versionNumber: number;
    sectionName: string | null;
    nearbyAmenities: Array<{
      code: string;
      displayName: string;
      kind: string;
      sectionName: string | null;
      sameSection: boolean;
    }>;
  };
}

export function getPublicAccommodationDetail(input: {
  campgroundSlug: string;
  accommodationId: string;
  arrivalDate: string;
  departureDate: string;
}): Promise<PublicAccommodationDetail | null>;

export function closePublicAccommodationDetailPoolForTests(): Promise<void>;
