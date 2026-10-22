export type FacilityUpkeepKind =
  | "washroom"
  | "shower"
  | "laundry"
  | "combined";

export type CleanlinessState =
  | "clean"
  | "service_due"
  | "closed_for_service";

export type FixtureState = "operational" | "attention" | "out_of_service";

export type SupplyState = "stocked" | "low" | "out" | "not_applicable";

export type FacilityIssueKind =
  | "cleanliness"
  | "fixture"
  | "supply"
  | "safety"
  | "laundry_machine"
  | "other";

export const facilityUpkeepKinds: readonly FacilityUpkeepKind[];
export const cleanlinessStates: readonly CleanlinessState[];
export const fixtureStates: readonly FixtureState[];
export const supplyStates: readonly SupplyState[];
export const facilityIssueKinds: readonly FacilityIssueKind[];

export function validateFacilityUpkeepKind(
  value: string,
): FacilityUpkeepKind;

export function validateFacilityUpkeepProgramInput(input: {
  assetId?: string;
  facilityKind?: string;
  inspectionTemplateId?: string;
  maintenanceScheduleId?: string;
  notes?: string | null;
  isActive?: boolean;
}): {
  assetId: string;
  facilityKind: FacilityUpkeepKind;
  inspectionTemplateId: string;
  maintenanceScheduleId: string;
  notes: string | null;
  isActive: boolean;
};

export function validateFacilitySnapshotInput(input: {
  cleanlinessState?: string;
  fixtureState?: string;
  supplyState?: string;
  notes?: string | null;
}): {
  cleanlinessState: CleanlinessState;
  fixtureState: FixtureState;
  supplyState: SupplyState;
  notes: string | null;
};

export function validateFacilityIssueInput(input: {
  issueKind?: string;
  title?: string;
  description?: string | null;
  categoryId?: string;
  priorityPolicyId?: string;
}): {
  issueKind: FacilityIssueKind;
  title: string;
  description: string | null;
  categoryId: string;
  priorityPolicyId: string;
};

export function formatFacilityUpkeepKind(value: string): string;
export function formatFacilityState(value: string): string;
