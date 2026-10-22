export interface CottageTurnoverOperationsWorkspace {
  campground: {
    id: string;
    organizationId: string;
    name: string;
    timezone: string;
  };
  generatedAt: string;
  cottages: Array<{
    id: string;
    code: string;
    name: string;
    statusState: string;
    rowVersion: number;
  }>;
  inspectionTemplates: Array<{
    id: string;
    accommodationId: string;
    name: string;
    isActive: boolean;
    versionNumber: number;
    signoffRequired: boolean;
  }>;
  housekeepingTemplates: Array<{
    id: string;
    accommodationId: string;
    cottageCode: string;
    cottageName: string;
    name: string;
    turnoverType: string;
    expectedMinutes: number;
    finalInspectionTemplateId: string | null;
    finalInspectionTemplateName: string | null;
    finalInspectionVersionNumber: number | null;
    finalInspectionSignoffRequired: boolean;
    isActive: boolean;
    rowVersion: number;
  }>;
  turnovers: Array<{
    id: string;
    accommodationId: string;
    cottageCode: string;
    cottageName: string;
    accommodationStatusState: string;
    accommodationRowVersion: number;
    housekeepingTemplateId: string;
    housekeepingTemplateName: string;
    finalInspectionTemplateId: string | null;
    status: string;
    releaseRequired: boolean;
    scheduledFor: string | null;
    startedAt: string | null;
    completedAt: string | null;
    releasedAt: string | null;
    releasedByUserId: string | null;
    notes: string;
    blockedReason: string;
    requiredItems: number;
    checkedRequiredItems: number;
    checklistIssues: number;
    housekeepingInspectionResult: string | null;
    linenComplete: boolean;
    housekeepingComplete: boolean;
    inventoryComplete: boolean;
    damageFound: boolean;
    securityIssueFound: boolean;
    housekeepingInspectedAt: string | null;
    inspectionOccurrenceId: string | null;
    inspectionStatus: string | null;
    inspectionTemplateName: string | null;
    inspectionVersionNumber: number | null;
    inspectionSignoffRequired: boolean;
    inspectionStartedAt: string | null;
    correctiveWorkOrders: number;
    openCorrectiveWorkOrders: number;
    rowVersion: number;
  }>;
}

export function closeCottageTurnoverOperationsPoolForTests(): Promise<void>;

export function getCottageHousekeepingTurnoverWorkspace(
  userId: string,
  campgroundId: string,
): Promise<CottageTurnoverOperationsWorkspace>;

export function configureCottageTurnoverFinalInspection(input: {
  actorUserId: string;
  actorSessionId?: string | null;
  campgroundId: string;
  housekeepingTemplateId: string;
  inspectionTemplateId: string;
  expectedRowVersion: number | string;
}): Promise<number>;

export function startCottageTurnoverFinalInspection(input: {
  actorUserId: string;
  actorSessionId?: string | null;
  campgroundId: string;
  turnoverId: string;
}): Promise<string>;

export function releaseCottageTurnover(input: {
  actorUserId: string;
  actorSessionId?: string | null;
  campgroundId: string;
  turnoverId: string;
  expectedRowVersion: number | string;
}): Promise<void>;
