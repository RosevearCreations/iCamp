export type ArrivalGuideStay = {
  reservation: {
    id: string;
    rowVersion: number;
    status: string;
    arrivalDate: string;
    departureDate: string;
    campgroundLocalDate: string;
    campground: { slug: string };
  };
  rules: { currentCheckInTime: string | null; guestSummary: string | null };
  documents: { confirmationNumber: string | null };
  payment: { financialReviewRequired: boolean; outstandingCents: number };
  checkIn: { checkedInAt: string | null } | null;
  checkOut: { checkedOutAt: string | null } | null;
};

export type ArrivalGuideBundle = {
  plan: {
    state: string;
    sourceReservationVersion: number;
    rowVersion: number;
  } | null;
  review: {
    outcome: string;
    reviewedPlanVersion: number;
    reviewedReservationVersion: number;
  } | null;
};

export type ArrivalGuide = {
  phase: "pending" | "before_arrival" | "on_site" | "past" | "office_review";
  headline: string;
  facts: { id: string; title: string; detail: string; state: string }[];
  notices: string[];
  actions: { label: string; href: string }[];
  campgroundGuidance: string | null;
  assistanceHint: string;
  checkInAuthorized: false;
  accessAuthorized: false;
};

export function buildGuestArrivalGuide(input: {
  stay: ArrivalGuideStay;
  arrival?: ArrivalGuideBundle | null;
  arrivalAvailable?: boolean;
}): ArrivalGuide;
