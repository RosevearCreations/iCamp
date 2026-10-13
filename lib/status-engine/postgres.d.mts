export type AccommodationStatus =
  | "available"
  | "held"
  | "reserved"
  | "arriving"
  | "occupied"
  | "departing"
  | "inspection"
  | "maintenance"
  | "winterized"
  | "closed";

export type OperationalAssetStatus =
  | "unknown"
  | "operational"
  | "limited"
  | "inspection"
  | "maintenance"
  | "unavailable"
  | "seasonal"
  | "winterized"
  | "closed";

export const accommodationStatusStates: AccommodationStatus[];
export const operationalAssetStatusStates: OperationalAssetStatus[];

export interface AccommodationStatusHistoryRecord {
  id: string;
  accommodationId: string;
  code: string;
  displayName: string;
  fromState: AccommodationStatus | null;
  toState: AccommodationStatus;
  reason: string;
  statusRevision: number;
  changedByUserId: string | null;
  changedAt: string;
}

export interface OperationalAssetStatusHistoryRecord {
  id: string;
  assetId: string;
  assetClass: "facility" | "equipment";
  code: string;
  displayName: string;
  fromState: OperationalAssetStatus | null;
  toState: OperationalAssetStatus;
  reason: string;
  statusRevision: number;
  changedByUserId: string | null;
  changedAt: string;
}

export function closeStatusEnginePoolForTests(): Promise<void>;

export function listAccommodationStatusHistory(
  userId: string,
  campgroundId: string,
): Promise<AccommodationStatusHistoryRecord[]>;

export function listOperationalAssetStatusHistory(
  userId: string,
  campgroundId: string,
): Promise<OperationalAssetStatusHistoryRecord[]>;

export function transitionAccommodationStatus(input: {
  actorUserId: string;
  actorSessionId?: string | null;
  campgroundId: string;
  accommodationId: string;
  expectedRowVersion: number;
  toState: string;
  reason?: string | null;
}): Promise<{
  rowVersion: number;
  statusState: AccommodationStatus;
  statusRevision: number;
  availabilityRevision: number;
}>;

export function transitionOperationalAssetStatus(input: {
  actorUserId: string;
  actorSessionId?: string | null;
  campgroundId: string;
  assetId: string;
  expectedRowVersion: number;
  toState: string;
  reason?: string | null;
}): Promise<{
  rowVersion: number;
  operatingState: OperationalAssetStatus;
  statusRevision: number;
}>;
