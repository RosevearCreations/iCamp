export interface AmenityHandoffRow {
  id: string;
  campgroundId: string;
  assetId: string;
  assetName: string;
  assetCode: string;
  kind: string;
  priority: string;
  summary: string;
  nextAction: string;
  status: string;
  assignedToUserId: string | null;
  assignedToLabel: string | null;
  createdByLabel: string;
  acknowledgedAt: string | Date | null;
  closedAt: string | Date | null;
  resolutionNote: string;
  rowVersion: number;
  createdAt: string | Date;
  updatedAt: string | Date;
}
export interface HandoffPermissions {
  canRead: boolean;
  canCreate: boolean;
  canAssign: boolean;
  canComplete: boolean;
  canPublish: boolean;
}
export function closeAmenityHandoffPoolForTests(): Promise<void>;
export function listAmenityHandoffs(input: {
  actorUserId: string;
  campgroundId: string;
}): Promise<{
  migrationReady: boolean;
  items: AmenityHandoffRow[];
  staff: Array<{ id: string; label: string }>;
  permissions: HandoffPermissions;
}>;
export function createAmenityHandoff(input: {
  actorUserId: string;
  actorSessionId?: string | null;
  campgroundId: string;
  assetId: string;
  assignedToUserId?: string | null;
  input: {
    kind: unknown;
    priority?: unknown;
    summary: unknown;
    nextAction: unknown;
  };
}): Promise<string>;
export function decideAmenityHandoff(input: {
  actorUserId: string;
  actorSessionId?: string | null;
  campgroundId: string;
  handoffId: string;
  assignedToUserId?: string | null;
  input: {
    action: unknown;
    expectedRowVersion: unknown;
    resolutionNote?: unknown;
  };
}): Promise<string>;
