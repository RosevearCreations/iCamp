export type AquaticFacilityType = "pool" | "water_park";
export type AquaticPublicState = "open" | "limited" | "closed";

export const aquaticFacilityTypes: readonly AquaticFacilityType[];
export const aquaticPublicStates: readonly AquaticPublicState[];

export function validateAquaticFacilityType(
  value: string,
): AquaticFacilityType;

export function validateAquaticPublicState(value: string): AquaticPublicState;

export function aquaticOperationalState(
  value: string,
): "operational" | "limited" | "closed";

export function aquaticPublicStateFromOperational(
  value: string,
): AquaticPublicState;

export function validateAquaticProgramInput(input: {
  assetId?: string;
  inspectionTemplateId?: string;
  maintenanceScheduleId?: string;
  reopenInspectionMaxAgeMinutes?: number | string;
  notes?: string | null;
  isActive?: boolean;
}): {
  assetId: string;
  inspectionTemplateId: string;
  maintenanceScheduleId: string;
  reopenInspectionMaxAgeMinutes: number;
  notes: string | null;
  isActive: boolean;
};

export function validateAquaticDecisionInput(input: {
  publicState?: string;
  reason?: string;
}): {
  publicState: AquaticPublicState;
  operationalState: "operational" | "limited" | "closed";
  reason: string;
};

export function formatAquaticFacilityType(value: string): string;
export function formatAquaticPublicState(value: string): string;
