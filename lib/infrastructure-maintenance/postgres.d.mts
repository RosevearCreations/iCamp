export interface InfrastructureMaintenanceWorkspace {
  campground: {
    id: string;
    organizationId: string;
    name: string;
    timezone: string;
  };
  generatedAt: string;
  facilities: Array<{
    id: string;
    name: string;
    facilityType: string;
    operatingState: string;
    rowVersion: number;
  }>;
  templates: Array<{
    id: string;
    assetId: string;
    name: string;
    isActive: boolean;
    versionNumber: number;
    signoffRequired: boolean;
  }>;
  schedules: Array<{
    id: string;
    assetId: string;
    title: string;
    recurrenceKind: string;
    nextOccurrenceAt: string;
    isActive: boolean;
  }>;
  categories: Array<{
    id: string;
    code: string;
    name: string;
  }>;
  priorities: Array<{
    id: string;
    priorityKey: string;
    targetResponseMinutes: number;
    targetCompletionMinutes: number;
  }>;
  programs: Array<{
    id: string;
    assetId: string;
    assetName: string;
    facilityType: string;
    profileKind: "road" | "parking" | "utility" | "garbage_area" | "septic_area";
    operatingState: string;
    inspectionTemplateId: string;
    inspectionTemplateName: string;
    inspectionVersionNumber: number;
    inspectionSignoffRequired: boolean;
    maintenanceScheduleId: string;
    maintenanceScheduleTitle: string;
    recurrenceKind: string;
    nextOccurrenceAt: string;
    scheduleActive: boolean;
    notes: string | null;
    isActive: boolean;
    rowVersion: number;
  }>;
  inspections: Array<{
    id: string;
    programId: string;
    assetId: string;
    assetName: string;
    inspectionOccurrenceId: string;
    inspectionStatus: string;
    inspectionTemplateName: string;
    versionNumber: number;
    startedAt: string;
    submittedAt: string | null;
    finalizedAt: string | null;
    scheduledFor: string | null;
    workOrderId: string | null;
    workOrderStatus: string | null;
  }>;
  snapshots: Array<{
    id: string;
    programId: string;
    assetId: string;
    assetName: string;
    profileKind: "road" | "parking" | "utility" | "garbage_area" | "septic_area";
    surfaceState: "ready" | "attention" | "unsafe" | "not_applicable";
    safetyState: "clear" | "monitor" | "restrict_use" | "close_area";
    serviceState:
      "operational" | "attention" | "out_of_service" | "not_applicable";
    notes: string | null;
    scheduledFor: string | null;
    workOrderId: string | null;
    workOrderStatus: string | null;
    recordedByUserId: string;
    recordedAt: string;
  }>;
  issues: Array<{
    id: string;
    programId: string;
    assetId: string;
    assetName: string;
    profileKind: "road" | "parking" | "utility" | "garbage_area" | "septic_area";
    issueKind: string;
    workOrderId: string;
    workOrderTitle: string;
    workOrderStatus: string;
    priorityKey: string;
    createdAt: string;
    resolved: boolean;
  }>;
}

export function closeInfrastructureMaintenancePoolForTests(): Promise<void>;

export function getInfrastructureMaintenanceWorkspace(
  userId: string,
  campgroundId: string,
): Promise<InfrastructureMaintenanceWorkspace>;

export function configureInfrastructureMaintenanceProgram(input: {
  actorUserId: string;
  actorSessionId?: string | null;
  campgroundId: string;
  expectedRowVersion?: number | null;
  assetId: string;
  profileKind: string;
  inspectionTemplateId: string;
  maintenanceScheduleId: string;
  notes?: string | null;
  isActive?: boolean;
}): Promise<string>;

export function startInfrastructureMaintenanceInspection(input: {
  actorUserId: string;
  actorSessionId?: string | null;
  campgroundId: string;
  programId: string;
}): Promise<string>;

export function recordInfrastructureMaintenanceSnapshot(input: {
  actorUserId: string;
  actorSessionId?: string | null;
  campgroundId: string;
  programId: string;
  surfaceState: string;
  safetyState: string;
  serviceState: string;
  notes?: string | null;
}): Promise<string>;

export function reportInfrastructureMaintenanceIssue(input: {
  actorUserId: string;
  actorSessionId?: string | null;
  campgroundId: string;
  programId: string;
  issueKind: string;
  title: string;
  description?: string | null;
  categoryId: string;
  priorityPolicyId: string;
}): Promise<string>;
