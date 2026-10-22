export const infrastructureMaintenanceKinds: readonly [
  "road",
  "parking",
  "utility",
  "garbage_area",
  "septic_area",
];
export const surfaceStates: readonly [
  "ready",
  "attention",
  "unsafe",
  "not_applicable",
];
export const safetyStates: readonly [
  "clear",
  "monitor",
  "restrict_use",
  "close_area",
];
export const serviceStates: readonly [
  "operational",
  "attention",
  "out_of_service",
  "not_applicable",
];
export const infrastructureIssueKinds: readonly [
  "road_surface",
  "parking_surface",
  "drainage",
  "electrical",
  "water_supply",
  "sewer_septic",
  "garbage_recycling",
  "lighting",
  "signage",
  "safety",
  "other",
];
export function validateInfrastructureMaintenanceKind(value: unknown): string;
export function validateInfrastructureMaintenanceProgramInput(input: {
  assetId?: unknown;
  profileKind?: unknown;
  inspectionTemplateId?: unknown;
  maintenanceScheduleId?: unknown;
  notes?: unknown;
  isActive?: boolean;
}): {
  assetId: string;
  profileKind: string;
  inspectionTemplateId: string;
  maintenanceScheduleId: string;
  notes: string | null;
  isActive: boolean;
};
export function validateInfrastructureSnapshotInput(input: {
  surfaceState?: unknown;
  safetyState?: unknown;
  serviceState?: unknown;
  notes?: unknown;
}): {
  surfaceState: string;
  safetyState: string;
  serviceState: string;
  notes: string | null;
};
export function validateInfrastructureIssueInput(input: {
  issueKind?: unknown;
  title?: unknown;
  description?: unknown;
  categoryId?: unknown;
  priorityPolicyId?: unknown;
}): {
  issueKind: string;
  title: string;
  description: string | null;
  categoryId: string;
  priorityPolicyId: string;
};
export function formatInfrastructureMaintenanceKind(value: unknown): string;
export function formatInfrastructureState(value: unknown): string;
