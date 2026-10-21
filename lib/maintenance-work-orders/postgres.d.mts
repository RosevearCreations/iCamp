export interface MaintenanceWorkOrderBoard {
  campground: {
    id: string;
    organizationId: string;
    name: string;
    timezone: string;
  };
  staff: { id: string; label: string }[];
  categories: { id: string; code: string; name: string }[];
  priorities: {
    id: string;
    priorityKey: string;
    targetResponseMinutes: number;
    targetCompletionMinutes: number;
  }[];
  sections: { id: string; name: string }[];
  assets: { id: string; name: string }[];
  accommodations: { id: string; code: string; name: string }[];
  workOrders: Array<{
    id: string;
    categoryId: string;
    categoryName: string;
    categoryCode: string;
    priorityPolicyId: string;
    priorityKey: string;
    sectionId: string | null;
    sectionName: string | null;
    assetId: string | null;
    assetName: string | null;
    accommodationId: string | null;
    accommodationName: string | null;
    locationDescription: string | null;
    title: string;
    description: string | null;
    status: string;
    assignedToUserId: string | null;
    assignedToLabel: string | null;
    responseDueAt: string;
    completionDueAt: string;
    respondedAt: string | null;
    completedAt: string | null;
    completedByUserId: string | null;
    completionSummary: string | null;
    cancelledAt: string | null;
    cancellationReason: string | null;
    isPastCompletionTarget: boolean;
    rowVersion: number;
    createdAt: string;
    updatedAt: string;
    notes: Array<{
      id: string;
      noteText: string;
      createdByUserId: string;
      createdAt: string;
    }>;
    media: Array<{
      id: string;
      mediaAssetId: string;
      caption: string | null;
      createdByUserId: string;
      createdAt: string;
    }>;
    materials: Array<{
      id: string;
      itemName: string;
      quantity: number;
      unit: string;
      unitCostCents: number | null;
      recordedAt: string;
    }>;
    labor: Array<{
      id: string;
      workerUserId: string;
      workerLabel: string;
      minutes: number;
      note: string | null;
      workedAt: string;
    }>;
    statusEvents: Array<{
      id: string;
      fromStatus: string | null;
      toStatus: string;
      actorUserId: string | null;
      note: string | null;
      occurredAt: string;
    }>;
  }>;
}

export function closeMaintenanceWorkOrderPoolForTests(): Promise<void>;

export function getMaintenanceWorkOrderBoard(
  userId: string,
  campgroundId: string,
): Promise<MaintenanceWorkOrderBoard>;

export function createMaintenanceWorkOrder(input: {
  actorUserId: string;
  actorSessionId?: string | null;
  campgroundId: string;
  title: string;
  description?: string | null;
  categoryId: string;
  priorityPolicyId: string;
  sectionId?: string | null;
  assetId?: string | null;
  accommodationId?: string | null;
  locationDescription?: string | null;
}): Promise<string>;

export function assignMaintenanceWorkOrder(input: {
  actorUserId: string;
  actorSessionId?: string | null;
  campgroundId: string;
  workOrderId: string;
  assignedToUserId?: string | null;
  expectedRowVersion: number;
}): Promise<number>;

export function transitionMaintenanceWorkOrder(input: {
  actorUserId: string;
  actorSessionId?: string | null;
  campgroundId: string;
  workOrderId: string;
  toStatus: string;
  expectedRowVersion: number;
  completionSummary?: string | null;
  note?: string | null;
}): Promise<number>;

export function addMaintenanceWorkOrderNote(input: {
  actorUserId: string;
  actorSessionId?: string | null;
  campgroundId: string;
  workOrderId: string;
  note: string;
}): Promise<void>;

export function attachMaintenanceWorkOrderMedia(input: {
  actorUserId: string;
  actorSessionId?: string | null;
  campgroundId: string;
  workOrderId: string;
  mediaAssetId: string;
  caption?: string | null;
}): Promise<void>;

export function addMaintenanceWorkOrderMaterial(input: {
  actorUserId: string;
  actorSessionId?: string | null;
  campgroundId: string;
  workOrderId: string;
  itemName: string;
  quantity: number | string;
  unit: string;
  unitCostCents?: number | string | null;
}): Promise<void>;

export function addMaintenanceWorkOrderLabor(input: {
  actorUserId: string;
  actorSessionId?: string | null;
  campgroundId: string;
  workOrderId: string;
  workerUserId?: string | null;
  minutes: number | string;
  note?: string | null;
}): Promise<void>;
