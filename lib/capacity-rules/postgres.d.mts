import type {
  CapacityAccommodationKind,
  CapacityEvaluation,
  CapacityRule,
  CapacityScopeKind,
} from "./core.mjs";

export interface CapacityRuleRecord extends CapacityRule {
  id: string;
  organizationId: string;
  campgroundId: string;
  scopeKind: CapacityScopeKind;
  accommodationKind: CapacityAccommodationKind | null;
  rowVersion: number;
  createdAt: string;
  archivedAt: string | null;
  isActive: boolean;
}

export interface CapacityRuleSnapshot {
  campground: {
    id: string;
    organizationId: string;
    name: string;
    timezone: string;
  };
  sections: Array<{
    id: string;
    name: string;
    code: string;
    lifecycleState: string;
  }>;
  accommodations: Array<{
    id: string;
    campgroundId: string;
    sectionId: string;
    sectionName: string;
    accommodationKind: CapacityAccommodationKind;
    code: string;
    displayName: string;
    lifecycleState: string;
    siteLengthMeters: number | null;
    siteWidthMeters: number | null;
    siteAreaSquareMeters: number | null;
    physicalMaxOccupancy: number | null;
  }>;
  rules: CapacityRuleRecord[];
}

export function closeCapacityRulesPoolForTests(): Promise<void>;

export function getCapacityRuleSnapshot(
  userId: string,
  campgroundId: string,
): Promise<CapacityRuleSnapshot>;

export function createCapacityLimitRule(input: {
  actorUserId: string;
  actorSessionId?: string | null;
  campgroundId: string;
  scopeKind: string;
  sectionId?: string | null;
  accommodationKind?: string | null;
  accommodationId?: string | null;
  minimumSiteAreaSquareMeters?: number | string | null;
  maximumSiteAreaSquareMeters?: number | string | null;
  maxOccupants?: number | string | null;
  maxVisitors?: number | string | null;
  maxVehicles?: number | string | null;
  notes?: string | null;
}): Promise<CapacityRuleRecord>;

export function archiveCapacityLimitRule(input: {
  actorUserId: string;
  actorSessionId?: string | null;
  campgroundId: string;
  ruleId: string;
  expectedRowVersion: number;
}): Promise<CapacityRuleRecord>;

export function evaluateAccommodationCapacity(input: {
  userId: string;
  campgroundId: string;
  accommodationId: string;
  occupants: number | string;
  visitors: number | string;
  vehicles: number | string;
}): Promise<CapacityEvaluation>;
