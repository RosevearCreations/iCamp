export type OfflineMaintenanceOperationKind =
  | "work_order_note"
  | "inspection_result"
  | "work_order_media";

export type OfflineMaintenanceOperation =
  | {
      clientOperationId: string;
      campgroundId: string;
      operationKind: "work_order_note";
      targetId: string;
      expectedWorkOrderRowVersion: number;
      note: string;
    }
  | {
      clientOperationId: string;
      campgroundId: string;
      operationKind: "inspection_result";
      targetId: string;
      templateItemId: string;
      expectedOccurrenceRowVersion: number;
      expectedResultRowVersion: number | null;
      resultValue: "pass" | "fail" | "not_applicable";
      note: string | null;
    }
  | {
      clientOperationId: string;
      campgroundId: string;
      operationKind: "work_order_media";
      targetId: string;
      expectedWorkOrderRowVersion: number;
      caption: string | null;
      fileChecksumSha256: string;
    };

export const offlineMaintenanceOperationKinds:
  readonly OfflineMaintenanceOperationKind[];

export function validateOfflineMaintenanceOperation(
  input: unknown,
): OfflineMaintenanceOperation;

export function offlineMaintenanceSyncState(
  value: string,
): "pending" | "syncing" | "conflict" | "blocked";
