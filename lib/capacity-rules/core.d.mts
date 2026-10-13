export type CapacityScopeKind =
  "campground" | "accommodation_type" | "section" | "accommodation";

export type CapacityAccommodationKind =
  "campsite" | "rental_cottage" | "permanent_unit";

export interface CapacityRule {
  id?: string | null;
  scopeKind: CapacityScopeKind;
  sectionId?: string | null;
  accommodationKind?: CapacityAccommodationKind | null;
  accommodationId?: string | null;
  minimumSiteAreaSquareMeters?: number | null;
  maximumSiteAreaSquareMeters?: number | null;
  maxOccupants?: number | null;
  maxVisitors?: number | null;
  maxVehicles?: number | null;
  notes?: string | null;
  isActive?: boolean;
}

export interface CapacityContext {
  accommodationId: string;
  accommodationKind: CapacityAccommodationKind;
  sectionId?: string | null;
  siteAreaSquareMeters?: number | null;
  physicalMaxOccupancy?: number | null;
}

export interface CapacityEvaluation {
  eligible: boolean;
  configured: boolean;
  issues: string[];
  requested: {
    occupants: number;
    visitors: number;
    vehicles: number;
  };
  effectiveLimits: {
    maxOccupants: number | null;
    maxVisitors: number | null;
    maxVehicles: number | null;
  };
  sources: {
    maxOccupants: {
      ruleId: string | null;
      scopeKind: string;
      sizeBand: boolean;
    } | null;
    maxVisitors: {
      ruleId: string | null;
      scopeKind: string;
      sizeBand: boolean;
    } | null;
    maxVehicles: {
      ruleId: string | null;
      scopeKind: string;
      sizeBand: boolean;
    } | null;
  };
  siteAreaSquareMeters: number | null;
  physicalMaxOccupancy: number | null;
  appliedRuleIds: string[];
}

export function validateCapacityRuleInput(input?: Record<string, unknown>): {
  scopeKind: CapacityScopeKind;
  sectionId: string | null;
  accommodationKind: CapacityAccommodationKind | null;
  accommodationId: string | null;
  minimumSiteAreaSquareMeters: number | null;
  maximumSiteAreaSquareMeters: number | null;
  maxOccupants: number | null;
  maxVisitors: number | null;
  maxVehicles: number | null;
  notes: string | null;
};

export function calculateSiteAreaSquareMeters(input?: {
  siteLengthMeters?: number | string | null;
  siteWidthMeters?: number | string | null;
}): number | null;

export function evaluateCapacityRules(input: {
  rules?: CapacityRule[];
  context: CapacityContext;
  occupants: number | string;
  visitors: number | string;
  vehicles: number | string;
}): CapacityEvaluation;
