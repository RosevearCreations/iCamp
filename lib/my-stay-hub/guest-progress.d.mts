export type GuestStayProgressState =
  "recorded" | "scheduled" | "pending" | "needs_review";

export type GuestStayProgress = {
  headline: string;
  steps: Array<{
    id: string;
    label: string;
    state: GuestStayProgressState;
    detail: string;
  }>;
  hasUnverifiedMilestone: boolean;
};

export function buildGuestStayProgress(stay: {
  reservation: {
    status: string;
    arrivalDate: string;
    departureDate: string;
    campgroundLocalDate: string;
  };
  checkIn?: { checkedInAt?: string | null } | null;
  checkOut?: { checkedOutAt?: string | null } | null;
}): GuestStayProgress;
