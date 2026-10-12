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
  campsiteDetails: {
    rowVersion: number;
    campsiteType: "tent" | "rv" | "mixed";
    serviceLevel: "unserviced" | "partial" | "serviced";
    stayProfile: "transient" | "seasonal" | "yearly" | "walk_up";
    isWaterfront: boolean;
    electricalAmperage: 0 | 15 | 20 | 30 | 50;
    waterService: "none" | "shared" | "site";
    wastewaterService: "none" | "sewer" | "septic";
    wifiService: "none" | "shared" | "site";
    siteLengthMeters: number | null;
    siteWidthMeters: number | null;
    maxRvLengthMeters: number | null;
    maxRvWidthMeters: number | null;
    maxRvHeightMeters: number | null;
    surfaceType: "natural" | "grass" | "gravel" | "paved" | "concrete" | "mixed";
    pullThrough: boolean;
    shadeLevel: "none" | "partial" | "full";
    hasFireRing: boolean;
    hasPicnicTable: boolean;
  } | null;
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


export function updateCampsiteDetails(input: {
  actorUserId: string;
  actorSessionId?: string | null;
  campgroundId: string;
  accommodationId: string;
  expectedDetailRowVersion: number;
  campsiteType: string;
  serviceLevel: string;
  stayProfile: string;
  isWaterfront?: boolean;
  electricalAmperage: number;
  waterService: string;
  wastewaterService: string;
  wifiService: string;
  siteLengthMeters?: number | string | null;
  siteWidthMeters?: number | string | null;
  maxRvLengthMeters?: number | string | null;
  maxRvWidthMeters?: number | string | null;
  maxRvHeightMeters?: number | string | null;
  surfaceType: string;
  pullThrough?: boolean;
  shadeLevel: string;
  hasFireRing?: boolean;
  hasPicnicTable?: boolean;
}): Promise<{
  detailRowVersion: number;
  availabilityRevision: number;
}>;
