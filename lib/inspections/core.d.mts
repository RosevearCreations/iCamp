export type InspectionTargetKind = "asset" | "site" | "cottage";
export type InspectionResultValue = "pass" | "fail" | "not_applicable";

export const inspectionTargetKinds: readonly InspectionTargetKind[];
export const inspectionResultValues: readonly InspectionResultValue[];

export function validateInspectionTargetKind(
  value: string,
): InspectionTargetKind;

export function validateInspectionResultValue(
  value: string,
): InspectionResultValue;

export function parseInspectionItems(value: string): Array<{
  itemKey: string;
  position: number;
  label: string;
  required: boolean;
  failureCreatesWorkOrder: boolean;
}>;

export function validateInspectionTemplateInput(input: {
  targetKind?: string;
  assetId?: string | null;
  accommodationId?: string | null;
  name?: string;
  description?: string | null;
  versionInstructions?: string | null;
  signoffRequired?: boolean;
  failureCategoryId?: string;
  failurePriorityPolicyId?: string;
  itemsText?: string;
}): {
  targetKind: InspectionTargetKind;
  assetId: string | null;
  accommodationId: string | null;
  name: string;
  description: string | null;
  versionInstructions: string | null;
  signoffRequired: boolean;
  failureCategoryId: string;
  failurePriorityPolicyId: string;
  items: Array<{
    itemKey: string;
    position: number;
    label: string;
    required: boolean;
    failureCreatesWorkOrder: boolean;
  }>;
};

export function validateInspectionVersionInput(input: {
  versionInstructions?: string | null;
  signoffRequired?: boolean;
  failureCategoryId?: string;
  failurePriorityPolicyId?: string;
  itemsText?: string;
}): {
  versionInstructions: string | null;
  signoffRequired: boolean;
  failureCategoryId: string;
  failurePriorityPolicyId: string;
  items: Array<{
    itemKey: string;
    position: number;
    label: string;
    required: boolean;
    failureCreatesWorkOrder: boolean;
  }>;
};

export function validateInspectionResultInput(input: {
  resultValue?: string;
  note?: string | null;
}): {
  resultValue: InspectionResultValue;
  note: string | null;
};

export function validateInspectionSignoffInput(input: {
  decision?: string;
  note?: string | null;
}): {
  decision: "approved" | "rejected";
  note: string | null;
};

export function formatInspectionTargetKind(value: string): string;
export function formatInspectionStatus(value: string): string;
