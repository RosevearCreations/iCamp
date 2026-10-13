export interface LiveAvailabilityItem {
  accommodationId: string;
  availabilityRevision: number;
  available: boolean;
  blockers: string[];
  code: string;
  displayName: string;
  accommodationKind: string;
}
export interface LiveAvailabilitySnapshot {
  campgroundId: string;
  arrivalDate: string;
  departureDate: string;
  generatedAt: string;
  revision: number;
  items: LiveAvailabilityItem[];
}
export function getLiveAvailabilitySnapshot(input: {
  userId: string;
  campgroundId: string;
  arrivalDate: string;
  departureDate: string;
}): Promise<LiveAvailabilitySnapshot>;
export function assertServerAvailable(input: {
  userId: string;
  campgroundId: string;
  accommodationId: string;
  arrivalDate: string;
  departureDate: string;
}): Promise<LiveAvailabilityItem>;
export function closeLiveAvailabilityPoolForTests(): Promise<void>;
