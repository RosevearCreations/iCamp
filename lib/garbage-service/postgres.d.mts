export interface GarbagePolicy {
  id: string;
  stream: string;
  service_mode: string;
  row_version: string;
  fee_cents: number;
  weekday: number | null;
  enabled: boolean;
  instructions: string | null;
  location_description: string | null;
}
export interface GarbagePickup {
  id: string;
  accommodation_code: string;
  stream: string;
  service_mode: string;
  state: string;
  row_version: string;
  fee_cents: number;
  billing_state: string;
  created_at: string;
  note: string | null;
}
export interface GarbageSnapshot {
  campground: { organization_id: string; id: string; name: string };
  policies: GarbagePolicy[];
  pickups: GarbagePickup[];
  accommodations: Array<{ id: string; code: string }>;
}
export declare function closeGarbageServicePoolForTests(): Promise<void>;
export declare function getGarbageServiceSnapshot(
  userId: string,
  campgroundId: string,
): Promise<GarbageSnapshot>;
export declare function saveGarbagePolicy(input: {
  actorUserId: string;
  campgroundId: string;
  expectedRowVersion?: unknown;
  stream: string;
  mode: string;
  feeCents?: unknown;
  weekday?: unknown;
  instructions?: unknown;
  locationDescription?: unknown;
  isEnabled?: boolean;
}): Promise<GarbagePolicy>;
export declare function requestGarbagePickup(input: {
  actorUserId: string;
  campgroundId: string;
  accommodationId: string;
  reservationId?: string | null;
  stream: string;
  mode: string;
  note?: string;
  clientRequestId: string;
}): Promise<GarbagePickup>;
export declare function transitionGarbagePickup(input: {
  actorUserId: string;
  campgroundId: string;
  pickupId: string;
  expectedRowVersion: number;
  nextState: string;
  note?: string;
  scheduledFor?: string | null;
}): Promise<GarbagePickup>;
