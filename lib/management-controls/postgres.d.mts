export type ManagementTargetKind = "accommodation" | "asset" | "section";
export type ManagementRestrictionKind = "closure" | "hold";
export type ManagementRestrictionState =
  | "upcoming"
  | "active"
  | "ended"
  | "cancelled";

export interface ManagementRestrictionRecord {
  id: string;
  batchId: string;
  organizationId: string;
  campgroundId: string;
  targetKind: ManagementTargetKind;
  targetId: string;
  targetCode: string | null;
  targetName: string | null;
  restrictionKind: ManagementRestrictionKind;
  startsOn: string;
  endsOn: string;
  reason: string;
  notes: string;
  isOverride: boolean;
  supersedesRestrictionId: string | null;
  createdByUserId: string | null;
  createdAt: string;
  cancelledByUserId: string | null;
  cancelledAt: string | null;
  cancellationReason: string | null;
  rowVersion: number;
  state: ManagementRestrictionState;
}

export interface ManagementRestrictionTargets {
  accommodations: Array<{
    id: string;
    code: string;
    displayName: string;
    sectionId: string;
  }>;
  assets: Array<{
    id: string;
    code: string;
    displayName: string;
    assetClass: "facility" | "equipment";
    sectionId: string | null;
  }>;
  sections: Array<{
    id: string;
    code: string;
    displayName: string;
  }>;
}

export function closeManagementControlsPoolForTests(): Promise<void>;

export function listManagementRestrictionTargets(
  userId: string,
  campgroundId: string,
): Promise<ManagementRestrictionTargets>;

export function listManagementRestrictions(
  userId: string,
  campgroundId: string,
): Promise<ManagementRestrictionRecord[]>;

export function createManagementRestrictions(input: {
  actorUserId: string;
  actorSessionId?: string | null;
  campgroundId: string;
  targetKind: ManagementTargetKind | string;
  targetIds: string[];
  restrictionKind: ManagementRestrictionKind | string;
  startsOn: string;
  endsOn: string;
  reason: string;
  notes?: string | null;
  overrideConflicts?: boolean;
}): Promise<{
  batchId: string;
  restrictionIds: string[];
  overrideCount: number;
}>;

export function cancelManagementRestriction(input: {
  actorUserId: string;
  actorSessionId?: string | null;
  campgroundId: string;
  restrictionId: string;
  expectedRowVersion: number;
  reason: string;
}): Promise<ManagementRestrictionRecord>;
