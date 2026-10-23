import type { OfflineMaintenanceOperation } from "./core.mjs";

export interface OfflineMaintenanceWorkspace {
  campground: {
    id: string;
    organizationId: string;
    name: string;
    timezone: string;
  };
  generatedAt: string;
  capabilities: {
    notes: boolean;
    inspections: boolean;
    media: boolean;
  };
  workOrders: Array<{
    id: string;
    title: string;
    description: string | null;
    status: string;
    categoryName: string;
    priorityKey: string;
    locationLabel: string;
    responseDueAt: string;
    completionDueAt: string;
    rowVersion: number;
    updatedAt: string;
    notes: Array<{ id: string; noteText: string; createdAt: string }>;
  }>;
  inspections: Array<{
    id: string;
    templateName: string;
    versionNumber: number;
    targetLabel: string;
    status: string;
    rowVersion: number;
    startedAt: string;
    signoffRequired: boolean;
    items: Array<{
      id: string;
      itemKey: string;
      position: number;
      label: string;
      required: boolean;
      result: null | {
        id: string;
        resultValue: string;
        note: string | null;
        rowVersion: number;
        updatedAt: string;
      };
    }>;
  }>;
}

export function closeOfflineMaintenancePoolForTests(): Promise<void>;
export function offlineOperationFingerprint(
  operation: OfflineMaintenanceOperation,
): string;
export function getOfflineMaintenanceWorkspace(
  userId: string,
  campgroundId: string,
): Promise<OfflineMaintenanceWorkspace>;
export function getOfflineSyncReceipt(input: {
  actorUserId: string;
  operation: OfflineMaintenanceOperation;
}): Promise<null | {
  id: string;
  clientOperationId: string;
  operationKind: string;
  targetId: string;
  payloadFingerprint: string;
  resultEntityId: string | null;
  appliedAt: string;
}>;
export function syncOfflineMaintenanceOperation(input: {
  actorUserId: string;
  actorSessionId?: string | null;
  operation: OfflineMaintenanceOperation;
}): Promise<{ status: string; receipt: unknown }>;
export function attachOfflineMaintenanceMediaEvidence(input: {
  actorUserId: string;
  actorSessionId?: string | null;
  operation: OfflineMaintenanceOperation;
  media: {
    id: string;
    mediaKind: "image" | "document";
    bucketKey: string;
    objectKey: string;
    originalFilename: string;
    contentType: string;
    byteSize: number;
    checksumSha256: string;
  };
}): Promise<{ status: string; receipt: unknown }>;
