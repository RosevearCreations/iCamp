export declare const GARBAGE_STREAMS: readonly string[];
export declare const GARBAGE_SERVICE_MODES: readonly string[];
export declare const GARBAGE_PICKUP_STATES: readonly string[];
export declare function normalizeGarbagePolicy(input: {
  stream?: unknown;
  mode?: unknown;
  feeCents?: unknown;
  weekday?: unknown;
  instructions?: unknown;
  locationDescription?: unknown;
  isEnabled?: boolean;
}): {
  stream: string;
  mode: string;
  feeCents: number;
  weekday: number | null;
  instructions: string | null;
  locationDescription: string | null;
  isEnabled: boolean;
};
export declare function normalizeGarbagePickup(input: {
  stream?: unknown;
  mode?: unknown;
  note?: unknown;
  clientRequestId?: unknown;
}): {
  stream: string;
  mode: string;
  note: string | null;
  clientRequestId: string;
};
export declare function nextGarbagePickupState(
  current: string,
  next: string,
): string;
