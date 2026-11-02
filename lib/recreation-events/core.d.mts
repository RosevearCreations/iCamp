export const recreationCategories: readonly string[];
export function recreationUuid(value: unknown, label?: string): string;
export interface RecreationEventInput {
  category?: unknown;
  title?: unknown;
  description?: unknown;
  locationName?: unknown;
  eventDate?: unknown;
  startTime?: unknown;
  endTime?: unknown;
  capacityPlaces?: unknown;
  requiresRegistration?: boolean;
  acceptingRequests?: boolean;
  accessibilityNote?: unknown;
  ageGuidance?: unknown;
  isPublished?: boolean;
  status?: string;
}
export interface RecreationEvent {
  id: string;
  campgroundId: string;
  campgroundName: string;
  campgroundSlug: string;
  timezone: string;
  category: string;
  title: string;
  description: string;
  locationName: string;
  eventDate: string;
  startTime: string;
  endTime: string;
  capacityPlaces: number | null;
  requestedPlaces: number;
  requiresRegistration: boolean;
  acceptingRequests: boolean;
  accessibilityNote: string;
  ageGuidance: string;
  status: string;
  isPublished: boolean;
  rowVersion: number;
}
export interface RecreationStay {
  id: string;
  campgroundId: string;
  campgroundName: string;
  status: string;
  arrivalDate: string;
  departureDate: string;
}
export function normalizeRecreationEvent(input: RecreationEventInput): {
  category: string;
  title: string;
  description: string;
  locationName: string;
  eventDate: string;
  startTime: string;
  endTime: string;
  capacityPlaces: number | null;
  requiresRegistration: boolean;
  acceptingRequests: boolean;
  accessibilityNote: string;
  ageGuidance: string;
  isPublished: boolean;
  status: string;
};
export function normalizeRecreationRequest(input: {
  partySize?: unknown;
  guestNote?: unknown;
  clientRequestId?: unknown;
}): { partySize: number; guestNote: string; clientRequestId: string };
export function recreationCapacityLabel(
  event: Pick<
    RecreationEvent,
    | "status"
    | "requiresRegistration"
    | "acceptingRequests"
    | "capacityPlaces"
    | "requestedPlaces"
  >,
): string;
export function guestStayEligibleForEvent(
  stay: RecreationStay,
  event: RecreationEvent,
): boolean;
