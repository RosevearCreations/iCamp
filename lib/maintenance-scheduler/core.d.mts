export type MaintenanceRecurrenceKind =
  | "hourly"
  | "every_n_hours"
  | "daily"
  | "weekly"
  | "monthly"
  | "seasonal"
  | "custom";

export type MaintenanceCatchUpMode = "create_late" | "mark_missed";

export const maintenanceRecurrenceKinds: readonly MaintenanceRecurrenceKind[];
export const maintenanceCatchUpModes: readonly MaintenanceCatchUpMode[];

export function validateMaintenanceRecurrenceKind(
  value: string,
): MaintenanceRecurrenceKind;

export function validateMaintenanceCatchUpMode(
  value: string,
): MaintenanceCatchUpMode;

export function validateFirstOccurrenceLocal(value: string): string;

export function validateMaintenanceScheduleInput(input: {
  title?: string;
  description?: string | null;
  categoryId?: string;
  priorityPolicyId?: string;
  sectionId?: string | null;
  assetId?: string | null;
  accommodationId?: string | null;
  locationDescription?: string | null;
  recurrenceKind?: string;
  intervalValue?: string | number | null;
  weekday?: string | number | null;
  monthDay?: string | number | null;
  seasonMonth?: string | number | null;
  seasonDay?: string | number | null;
  firstOccurrenceLocal?: string;
  missedAfterMinutes?: string | number;
  catchUpMode?: string;
}): {
  title: string;
  description: string | null;
  categoryId: string;
  priorityPolicyId: string;
  sectionId: string | null;
  assetId: string | null;
  accommodationId: string | null;
  locationDescription: string | null;
  recurrenceKind: MaintenanceRecurrenceKind;
  intervalValue: number | null;
  weekday: number | null;
  monthDay: number | null;
  seasonMonth: number | null;
  seasonDay: number | null;
  firstOccurrenceLocal: string;
  missedAfterMinutes: number;
  catchUpMode: MaintenanceCatchUpMode;
};

export function recurrenceLabel(schedule: {
  recurrenceKind: MaintenanceRecurrenceKind | string;
  intervalValue?: number | null;
  monthDay?: number | null;
  seasonMonth?: number | null;
  seasonDay?: number | null;
}): string;

export function formatOccurrenceState(value: string): string;
