export const recreationMaintenanceKinds: readonly [
  "baseball_softball",
  "sports_field",
  "playground",
  "hall",
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
export const amenityStates: readonly [
  "operational",
  "attention",
  "out_of_service",
  "not_applicable",
];
export const recreationIssueKinds: readonly [
  "playing_surface",
  "field_markings",
  "drainage",
  "fencing",
  "sports_equipment",
  "playground_equipment",
  "hall_fixture",
  "lighting",
  "cleanliness",
  "safety",
  "other",
];
export function validateRecreationMaintenanceKind(value: unknown): string;
export function validateRecreationMaintenanceProgramInput(input: {
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
export function validateRecreationSnapshotInput(input: {
  surfaceState?: unknown;
  safetyState?: unknown;
  amenityState?: unknown;
  notes?: unknown;
}): {
  surfaceState: string;
  safetyState: string;
  amenityState: string;
  notes: string | null;
};
export function validateRecreationIssueInput(input: {
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
export function formatRecreationMaintenanceKind(value: unknown): string;
export function formatRecreationState(value: unknown): string;
