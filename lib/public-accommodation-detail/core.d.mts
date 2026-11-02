export function normalizePublicAccommodationDates(input?: {
  arrivalDate?: string;
  departureDate?: string;
}): {
  arrivalDate: string;
  departureDate: string;
  nights: number;
};

export function humanizePublicFact(value: unknown): string;

export function publicRateSummary(): {
  readonly status: "rate_plans_pending";
  readonly label: string;
  readonly detail: string;
};
