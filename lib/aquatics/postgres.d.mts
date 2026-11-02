export interface AquaticsWorkspace {
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
    facilityType: "pool" | "water_park";
    operatingState: string;
    publicState: "open" | "limited" | "closed";
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
  programs: Array<{
    id: string;
    assetId: string;
    assetName: string;
    facilityType: "pool" | "water_park";
    operatingState: string;
    publicState: "open" | "limited" | "closed";
    assetRowVersion: number;
    inspectionTemplateId: string;
    inspectionTemplateName: string;
    inspectionVersionNumber: number;
    maintenanceScheduleId: string;
    maintenanceScheduleTitle: string;
    recurrenceKind: string;
    nextOccurrenceAt: string;
    scheduleActive: boolean;
    reopenInspectionMaxAgeMinutes: number;
    notes: string | null;
    isActive: boolean;
    rowVersion: number;
  }>;
  evidence: Array<{
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
    maintenanceScheduleOccurrenceId: string | null;
    scheduledFor: string | null;
    workOrderId: string | null;
    workOrderStatus: string | null;
    workOrderTitle: string | null;
    createdAt: string;
  }>;
  decisions: Array<{
    id: string;
    programId: string;
    assetId: string;
    assetName: string;
    decisionKey: "limit" | "close" | "reopen";
    fromState: string;
    toState: string;
    publicState: "open" | "limited" | "closed";
    statusRevision: number;
    reason: string;
    signedInspectionOccurrenceId: string | null;
    inspectionFinalizedAt: string | null;
    decidedByUserId: string;
    decidedAt: string;
  }>;
}

export function closeAquaticsPoolForTests(): Promise<void>;

export function getAquaticsWorkspace(
  userId: string,
  campgroundId: string,
): Promise<AquaticsWorkspace>;

export function configureAquaticProgram(input: {
  actorUserId: string;
  actorSessionId?: string | null;
  campgroundId: string;
  expectedRowVersion?: number | null;
  assetId: string;
  inspectionTemplateId: string;
  maintenanceScheduleId: string;
  reopenInspectionMaxAgeMinutes?: number | string;
  notes?: string | null;
  isActive?: boolean;
}): Promise<string>;

export function startAquaticInspection(input: {
  actorUserId: string;
  actorSessionId?: string | null;
  campgroundId: string;
  programId: string;
}): Promise<string>;

export function transitionAquaticFacility(input: {
  actorUserId: string;
  actorSessionId?: string | null;
  campgroundId: string;
  programId: string;
  expectedAssetRowVersion: number;
  publicState: string;
  reason: string;
}): Promise<{
  decisionId: string;
  operatingState: string;
  publicState: "open" | "limited" | "closed";
  rowVersion: number;
  statusRevision: number;
}>;
