export const amenityHandoffKinds: readonly string[];
export const amenityHandoffPriorities: readonly string[];
export const amenityHandoffStatuses: readonly string[];
export const amenityFollowupOutcomes: readonly string[];
export interface HandoffSla {
  state: "unknown" | "complete" | "overdue" | "due_soon" | "on_track";
  phase:
    | "unknown"
    | "closed"
    | "owner_review"
    | "acknowledgement"
    | "follow_through";
  dueAt: string | null;
  ageMinutes: number | null;
  remainingMinutes: number | null;
}
export function evaluateHandoffSla(
  input: {
    kind: string;
    status: string;
    priority: string;
    createdAt: string | Date;
    acknowledgedAt?: string | Date | null;
  },
  at?: Date | string | number,
): HandoffSla;
export function normalizeHandoffFollowup(input: {
  eventKind: unknown;
  outcome?: unknown;
  note: unknown;
  expectedRowVersion: unknown;
}): {
  eventKind: string;
  outcome: string | null;
  note: string;
  expectedRowVersion: number;
};
export function canRecordHandoffFollowup(input: {
  eventKind: string;
  kind: string;
  status: string;
  canAssign?: boolean;
  canComplete?: boolean;
  canPublish?: boolean;
}): boolean;
export function requiredHandoffText(value: unknown, label: string): string;
export function normalizeHandoffCreate(input: {
  kind: unknown;
  priority?: unknown;
  summary: unknown;
  nextAction: unknown;
}): { kind: string; priority: string; summary: string; nextAction: string };
export function normalizeHandoffDecision(input: {
  action: unknown;
  expectedRowVersion: unknown;
  resolutionNote?: unknown;
}): { action: string; expectedRowVersion: number; resolutionNote: string };
export function handoffActorCanAct(input: {
  action: string;
  kind: string;
  status: string;
  actorId?: string | null;
  assignedToUserId?: string | null;
  canAssign?: boolean;
  canComplete?: boolean;
  canPublish?: boolean;
}): boolean;
