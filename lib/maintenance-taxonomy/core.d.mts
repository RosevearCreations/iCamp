export type MaintenancePriorityKey =
  | "emergency"
  | "urgent"
  | "normal"
  | "preventive";

export interface MaintenanceCategoryInput {
  code: string;
  name: string;
  description?: string | null;
}

export interface ValidatedMaintenanceCategory {
  code: string;
  name: string;
  description: string | null;
}

export interface MaintenancePriorityTargetInput {
  priorityKey: string;
  targetResponseMinutes: number | string;
  targetCompletionMinutes: number | string;
  instructions?: string | null;
}

export interface ValidatedMaintenancePriorityTarget {
  priorityKey: MaintenancePriorityKey;
  targetResponseMinutes: number;
  targetCompletionMinutes: number;
  instructions: string | null;
}

export const maintenancePriorityKeys: readonly MaintenancePriorityKey[];
export const standardMaintenanceCategories: readonly {
  code: string;
  name: string;
}[];

export function validateMaintenanceCategoryInput(
  input: MaintenanceCategoryInput,
): ValidatedMaintenanceCategory;

export function validateMaintenancePriorityTarget(
  input: MaintenancePriorityTargetInput,
): ValidatedMaintenancePriorityTarget;

export function sortMaintenancePriorities<T extends { priorityKey: string }>(
  policies: readonly T[],
): T[];

export function formatTargetMinutes(value: number | string): string;
