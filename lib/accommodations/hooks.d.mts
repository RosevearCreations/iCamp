export type AccommodationKind =
  | "campsite"
  | "rental_cottage"
  | "permanent_unit";

export const accommodationKinds: readonly AccommodationKind[];

export function validateAccommodationKind(value: unknown): AccommodationKind;
export function accommodationMapObjectKind(
  kind: unknown,
): "site" | "cottage" | "permanent_unit";

export interface AccommodationHookSource {
  id: string;
  campgroundId: string;
  kind: AccommodationKind;
  lifecycleState: string;
  availabilityRevision: number;
  statusRevision: number;
}

export function createAvailabilityHook(
  accommodation: AccommodationHookSource,
): Readonly<{
  accommodationId: string;
  campgroundId: string;
  kind: AccommodationKind;
  lifecycleState: string;
  revision: number;
  inventoryEligible: boolean;
}>;

export function createStatusHook(
  accommodation: AccommodationHookSource,
): Readonly<{
  accommodationId: string;
  campgroundId: string;
  kind: AccommodationKind;
  lifecycleState: string;
  revision: number;
}>;
