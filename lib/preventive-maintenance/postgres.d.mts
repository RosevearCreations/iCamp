export interface PreventiveMaintenanceWorkspace {
  campground: {
    id: string;
    organizationId: string;
    name: string;
    timezone: string;
  };
  generatedAt: string;
  assets: Array<{
    id: string;
    code: string;
    name: string;
    assetClass: "facility" | "equipment";
    lifecycleState: string;
    operatingState: string;
    facilityType: string | null;
    equipmentType: string | null;
    make: string | null;
    model: string | null;
    serialNumber: string | null;
    meterKind: string;
    meterValue: number | null;
  }>;
  templates: Array<{
    id: string;
    targetAssetClass: "facility" | "equipment" | "either";
    name: string;
    description: string | null;
    serviceInstructions: string;
    isActive: boolean;
    rowVersion: number;
    createdByUserId: string;
    createdAt: string;
    updatedAt: string;
  }>;
  schedules: Array<{
    id: string;
    assetId: string;
    assetName: string;
    title: string;
    description: string | null;
    recurrenceKind: string;
    intervalValue: number | null;
    weekday: number | null;
    monthDay: number | null;
    seasonMonth: number | null;
    seasonDay: number | null;
    firstOccurrenceLocal: string;
    nextOccurrenceAt: string;
    isActive: boolean;
  }>;
  programs: Array<{
    id: string;
    assetId: string;
    assetName: string;
    assetClass: "facility" | "equipment";
    templateId: string;
    templateName: string;
    targetAssetClass: "facility" | "equipment" | "either";
    serviceInstructions: string;
    maintenanceScheduleId: string;
    maintenanceScheduleTitle: string;
    recurrenceKind: string;
    nextOccurrenceAt: string;
    scheduleActive: boolean;
    notes: string | null;
    isActive: boolean;
    rowVersion: number;
  }>;
  history: Array<{
    programId: string;
    occurrenceId: string;
    scheduledFor: string;
    occurrenceState: string;
    reasonCode: string | null;
    workOrderId: string | null;
    workOrderTitle: string | null;
    workOrderStatus: string | null;
    completedAt: string | null;
    completionSummary: string | null;
    workOrderCreatedAt: string | null;
    materials: Array<{
      itemName: string;
      quantity: number;
      unit: string;
      unitCostCents: number | null;
      recordedAt: string;
    }>;
    labor: Array<{
      workerUserId: string;
      minutes: number;
      note: string | null;
      workedAt: string;
    }>;
  }>;
}

export function closePreventiveMaintenancePoolForTests(): Promise<void>;

export function getPreventiveMaintenanceWorkspace(
  userId: string,
  campgroundId: string,
): Promise<PreventiveMaintenanceWorkspace>;

export function createPreventiveMaintenanceTemplate(input: {
  actorUserId: string;
  actorSessionId?: string | null;
  campgroundId: string;
  targetAssetClass: string;
  name: string;
  description?: string | null;
  serviceInstructions: string;
}): Promise<string>;

export function setPreventiveMaintenanceTemplateActive(input: {
  actorUserId: string;
  actorSessionId?: string | null;
  campgroundId: string;
  templateId: string;
  isActive: boolean;
  expectedRowVersion: number;
}): Promise<void>;

export function configurePreventiveMaintenanceProgram(input: {
  actorUserId: string;
  actorSessionId?: string | null;
  campgroundId: string;
  assetId: string;
  templateId: string;
  maintenanceScheduleId: string;
  notes?: string | null;
  isActive?: boolean;
}): Promise<string>;

export function setPreventiveMaintenanceProgramActive(input: {
  actorUserId: string;
  actorSessionId?: string | null;
  campgroundId: string;
  programId: string;
  isActive: boolean;
  expectedRowVersion: number;
}): Promise<void>;
