import type { AccommodationKind } from "./hooks.mjs";

export interface AccommodationRecord {
  id: string;
  organizationId: string;
  campgroundId: string;
  sectionId: string;
  sectionName: string;
  subsectionId: string | null;
  subsectionName: string | null;
  mapObjectId: string;
  kind: AccommodationKind;
  code: string;
  displayName: string;
  lifecycleState: "active" | "inactive" | "archived";
  availabilityRevision: number;
  statusRevision: number;
  rowVersion: number;
  subtypeLinked: boolean;
  availabilityHook: {
    accommodationId: string;
    campgroundId: string;
    kind: AccommodationKind;
    lifecycleState: string;
    revision: number;
    inventoryEligible: boolean;
  };
  statusHook: {
    accommodationId: string;
    campgroundId: string;
    kind: AccommodationKind;
    lifecycleState: string;
    revision: number;
  };
}

export function closeAccommodationPoolForTests(): Promise<void>;

export function listAccommodations(
  userId: string,
  campgroundId: string,
): Promise<AccommodationRecord[]>;

export function createAccommodation(input: {
  actorUserId: string;
  actorSessionId?: string | null;
  campgroundId: string;
  sectionId: string;
  subsectionId?: string | null;
  kind: string;
  code: string;
  displayName: string;
}): Promise<string>;

export function updateAccommodation(input: {
  actorUserId: string;
  actorSessionId?: string | null;
  campgroundId: string;
  accommodationId: string;
  expectedRowVersion: number;
  sectionId: string;
  subsectionId?: string | null;
  code: string;
  displayName: string;
  lifecycleState: string;
}): Promise<{
  rowVersion: number;
  availabilityRevision: number;
  statusRevision: number;
}>;
