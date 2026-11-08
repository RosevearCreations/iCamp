export const amenityHandoffKinds: readonly string[];
export const amenityHandoffPriorities: readonly string[];
export const amenityHandoffStatuses: readonly string[];
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
