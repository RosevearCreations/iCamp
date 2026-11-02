export interface InspectionWorkspace {
  campground: {
    id: string;
    organizationId: string;
    name: string;
    timezone: string;
  };
  generatedAt: string;
  assets: Array<{ id: string; name: string }>;
  sites: Array<{ id: string; code: string; name: string }>;
  cottages: Array<{ id: string; code: string; name: string }>;
  categories: Array<{ id: string; name: string }>;
  priorities: Array<{ id: string; priorityKey: string }>;
  templates: Array<{
    id: string;
    targetKind: string;
    assetId: string | null;
    accommodationId: string | null;
    targetLabel: string;
    name: string;
    description: string | null;
    isActive: boolean;
    currentVersionId: string | null;
    rowVersion: number;
    versions: Array<{
      id: string;
      templateId: string;
      versionNumber: number;
      instructions: string | null;
      signoffRequired: boolean;
      failureCategoryId: string;
      failureCategoryName: string | null;
      failurePriorityPolicyId: string;
      failurePriorityKey: string | null;
      publishedAt: string | null;
      createdByUserId: string;
      createdAt: string;
      items: Array<{
        id: string;
        itemKey: string;
        position: number;
        label: string;
        required: boolean;
        failureCreatesWorkOrder: boolean;
      }>;
    }>;
    currentVersion: {
      id: string;
      templateId: string;
      versionNumber: number;
      instructions: string | null;
      signoffRequired: boolean;
      failureCategoryId: string;
      failureCategoryName: string | null;
      failurePriorityPolicyId: string;
      failurePriorityKey: string | null;
      publishedAt: string | null;
      createdByUserId: string;
      createdAt: string;
      items: Array<{
        id: string;
        itemKey: string;
        position: number;
        label: string;
        required: boolean;
        failureCreatesWorkOrder: boolean;
      }>;
    } | null;
  }>;
  occurrences: Array<{
    id: string;
    templateId: string;
    templateName: string;
    templateVersionId: string;
    versionNumber: number;
    targetKind: string;
    targetLabel: string;
    inspectorUserId: string;
    status: string;
    signoffRequired: boolean;
    startedAt: string;
    submittedAt: string | null;
    finalizedAt: string | null;
    rowVersion: number;
    version: {
      id: string;
      items: Array<{
        id: string;
        itemKey: string;
        position: number;
        label: string;
        required: boolean;
        failureCreatesWorkOrder: boolean;
      }>;
    } | null;
    results: Array<{
      id: string;
      occurrenceId: string;
      templateItemId: string;
      resultValue: string;
      note: string | null;
      recordedByUserId: string;
      createdAt: string;
      updatedAt: string;
      rowVersion: number;
      correctiveAction: {
        id: string;
        workOrderId: string;
        createdAt: string;
      } | null;
    }>;
    signoff: {
      id: string;
      decision: string;
      note: string | null;
      signedByUserId: string;
      signedAt: string;
    } | null;
  }>;
}

export function closeInspectionPoolForTests(): Promise<void>;

export function getInspectionWorkspace(
  userId: string,
  campgroundId: string,
): Promise<InspectionWorkspace>;

export function createInspectionTemplate(input: {
  actorUserId: string;
  actorSessionId?: string | null;
  campgroundId: string;
  targetKind: string;
  assetId?: string | null;
  accommodationId?: string | null;
  name: string;
  description?: string | null;
  versionInstructions?: string | null;
  signoffRequired?: boolean;
  failureCategoryId: string;
  failurePriorityPolicyId: string;
  itemsText: string;
}): Promise<string>;

export function publishInspectionTemplateVersion(input: {
  actorUserId: string;
  actorSessionId?: string | null;
  campgroundId: string;
  templateId: string;
  versionInstructions?: string | null;
  signoffRequired?: boolean;
  failureCategoryId: string;
  failurePriorityPolicyId: string;
  itemsText: string;
}): Promise<string>;

export function setInspectionTemplateActive(input: {
  actorUserId: string;
  actorSessionId?: string | null;
  campgroundId: string;
  templateId: string;
  isActive: boolean;
  expectedRowVersion: number;
}): Promise<void>;

export function startInspection(input: {
  actorUserId: string;
  actorSessionId?: string | null;
  campgroundId: string;
  templateId: string;
}): Promise<string>;

export function recordInspectionResult(input: {
  actorUserId: string;
  actorSessionId?: string | null;
  campgroundId: string;
  occurrenceId: string;
  templateItemId: string;
  resultValue: string;
  note?: string | null;
}): Promise<void>;

export function submitInspection(input: {
  actorUserId: string;
  actorSessionId?: string | null;
  campgroundId: string;
  occurrenceId: string;
  expectedRowVersion: number;
}): Promise<void>;

export function signOffInspection(input: {
  actorUserId: string;
  actorSessionId?: string | null;
  campgroundId: string;
  occurrenceId: string;
  expectedRowVersion: number;
  decision: string;
  note?: string | null;
}): Promise<void>;
