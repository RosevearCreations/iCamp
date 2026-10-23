export type PreventiveAssetClass = "facility" | "equipment" | "either";

export const preventiveAssetClasses: readonly PreventiveAssetClass[];

export function validatePreventiveMaintenanceTemplateInput(input?: {
  targetAssetClass?: string;
  name?: string;
  description?: string | null;
  serviceInstructions?: string;
}): {
  targetAssetClass: PreventiveAssetClass;
  name: string;
  description: string | null;
  serviceInstructions: string;
};

export function validatePreventiveMaintenanceProgramInput(input?: {
  assetId?: string;
  templateId?: string;
  maintenanceScheduleId?: string;
  notes?: string | null;
  isActive?: boolean;
}): {
  assetId: string;
  templateId: string;
  maintenanceScheduleId: string;
  notes: string | null;
  isActive: boolean;
};

export function preventiveInstructionSteps(value: string): string[];

export function formatPreventiveAssetClass(
  value: PreventiveAssetClass | string,
): string;
