export type MaintenanceWorkOrderStatus =
  | "open"
  | "assigned"
  | "in_progress"
  | "blocked"
  | "completed"
  | "cancelled";

export interface MaintenanceWorkOrderInput {
  title: string;
  description?: string | null;
  categoryId: string;
  priorityPolicyId: string;
  sectionId?: string | null;
  assetId?: string | null;
  accommodationId?: string | null;
  locationDescription?: string | null;
}

export interface ValidatedMaintenanceWorkOrderInput {
  title: string;
  description: string | null;
  categoryId: string;
  priorityPolicyId: string;
  sectionId: string | null;
  assetId: string | null;
  accommodationId: string | null;
  locationDescription: string | null;
}

export const maintenanceWorkOrderStatuses: readonly MaintenanceWorkOrderStatus[];

export function validateMaintenanceWorkOrderInput(
  input: MaintenanceWorkOrderInput,
): ValidatedMaintenanceWorkOrderInput;

export function validateWorkOrderStatus(
  value: string,
): MaintenanceWorkOrderStatus;

export function validateMaintenanceStatusTransition(
  fromStatus: string,
  toStatus: string,
): MaintenanceWorkOrderStatus;

export function validateMaintenanceNote(value: string): string;

export function validateMaintenanceMaterialInput(input: {
  itemName: string;
  unit: string;
  quantity: number | string;
  unitCostCents?: number | string | null;
}): {
  itemName: string;
  unit: string;
  quantity: number;
  unitCostCents: number | null;
};

export function validateMaintenanceLaborInput(input: {
  workerUserId?: string | null;
  minutes: number | string;
  note?: string | null;
}): {
  workerUserId: string | null;
  minutes: number;
  note: string | null;
};

export function validateCompletionSummary(value: string): string;

export function formatMaintenanceStatus(value: string): string;
