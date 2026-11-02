export type MaintenanceResponsibilityLevel =
  "crew" | "foreman" | "main_foreman" | "manager";

export type MaintenanceEscalationTrigger =
  | "emergency_priority"
  | "urgent_priority"
  | "blocked"
  | "response_overdue"
  | "completion_overdue";

export type MaintenanceEscalationState = "open" | "acknowledged" | "resolved";

export const maintenanceResponsibilityLevels: readonly MaintenanceResponsibilityLevel[];
export const maintenanceEscalationTriggers: readonly MaintenanceEscalationTrigger[];
export const maintenanceEscalationStates: readonly MaintenanceEscalationState[];

export function validateMaintenanceResponsibilityLevel(
  value: string,
): MaintenanceResponsibilityLevel;

export function validateMaintenanceEscalationTrigger(
  value: string,
): MaintenanceEscalationTrigger;

export function validateMaintenanceEscalationState(
  value: string,
): MaintenanceEscalationState;

export function validateEscalationThresholdMinutes(
  value: number | string,
): number;

export function validateEscalationNote(
  value: string | null | undefined,
  options?: { required?: boolean },
): string | null;

export function responsibilityRank(
  level: MaintenanceResponsibilityLevel | string,
): number;

export function mayAssignResponsibility(
  actorLevel: MaintenanceResponsibilityLevel | string,
  targetLevel: MaintenanceResponsibilityLevel | string,
): boolean;

export function deriveEscalationSignals(
  workOrder: {
    priorityKey: string;
    status: string;
    createdAt: string;
    updatedAt: string;
    respondedAt: string | null;
    responseDueAt: string;
    completionDueAt: string;
  },
  policies: Array<{
    triggerKey: MaintenanceEscalationTrigger | string;
    targetLevel: MaintenanceResponsibilityLevel | string;
    thresholdMinutes: number;
    isActive: boolean;
  }>,
  referenceTime: string | Date,
): Array<{
  triggerKey: MaintenanceEscalationTrigger | string;
  targetLevel: MaintenanceResponsibilityLevel | string;
  thresholdMinutes: number;
  eligibleAt: string;
}>;

export function formatMaintenanceResponsibility(level: string): string;
export function formatEscalationTrigger(trigger: string): string;
