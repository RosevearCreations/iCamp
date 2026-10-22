export interface CampsiteDepartureCleanupWorkspace {
  campground: {
    id: string;
    organizationId: string;
    name: string;
    timezone: string;
  };
  generatedAt: string;
  campsites: Array<{
    id: string;
    code: string;
    name: string;
    campsiteType: "tent" | "rv" | "mixed";
    statusState: string;
    rowVersion: number;
  }>;
  templates: Array<{
    id: string;
    accommodationId: string;
    name: string;
    isActive: boolean;
    versionNumber: number;
    signoffRequired: boolean;
  }>;
  programs: Array<{
    id: string;
    accommodationId: string;
    campsiteCode: string;
    campsiteName: string;
    campsiteType: "tent" | "rv" | "mixed";
    inspectionTemplateId: string;
    inspectionTemplateName: string;
    inspectionVersionNumber: number;
    inspectionSignoffRequired: boolean;
    blockRebookingUntilClear: boolean;
    notes: string | null;
    isActive: boolean;
    rowVersion: number;
  }>;
  tasks: Array<{
    id: string;
    reservationCheckOutId: string;
    reservationId: string;
    accommodationId: string;
    campsiteCode: string;
    campsiteName: string;
    campsiteType: "tent" | "rv" | "mixed";
    accommodationStatusState: string;
    accommodationRowVersion: number;
    programId: string | null;
    inspectionOccurrenceId: string | null;
    inspectionStatus: string | null;
    inspectionTemplateName: string | null;
    inspectionVersionNumber: number | null;
    openCorrectiveWorkOrders: number;
    correctiveWorkOrders: number;
    blockRebookingUntilClear: boolean;
    clearedAt: string | null;
    clearedByUserId: string | null;
    checkedOutAt: string;
    createdAt: string;
    rowVersion: number;
  }>;
}

export function closeCampsiteDepartureCleanupPoolForTests(): Promise<void>;

export function getCampsiteDepartureCleanupWorkspace(
  userId: string,
  campgroundId: string,
): Promise<CampsiteDepartureCleanupWorkspace>;

export function configureCampsiteDepartureCleanupProgram(input: {
  actorUserId: string;
  actorSessionId?: string | null;
  campgroundId: string;
  expectedRowVersion?: number | null;
  accommodationId: string;
  campsiteType: string;
  inspectionTemplateId: string;
  blockRebookingUntilClear?: boolean;
  notes?: string | null;
  isActive?: boolean;
}): Promise<string>;

export function startCampsiteDepartureCleanupInspection(input: {
  actorUserId: string;
  actorSessionId?: string | null;
  campgroundId: string;
  taskId: string;
}): Promise<string>;

export function clearCampsiteDepartureCleanupTask(input: {
  actorUserId: string;
  actorSessionId?: string | null;
  campgroundId: string;
  taskId: string;
  expectedRowVersion: number;
}): Promise<void>;
