export const campsiteTypes: ReadonlyArray<"tent" | "rv" | "mixed">;

export function validateCampsiteType(value: unknown): "tent" | "rv" | "mixed";

export function validateDepartureCleanupProgramInput(input: {
  accommodationId?: unknown;
  campsiteType?: unknown;
  inspectionTemplateId?: unknown;
  blockRebookingUntilClear?: boolean;
  notes?: unknown;
  isActive?: boolean;
}): {
  accommodationId: string;
  campsiteType: "tent" | "rv" | "mixed";
  inspectionTemplateId: string;
  blockRebookingUntilClear: boolean;
  notes: string | null;
  isActive: boolean;
};

export function formatCampsiteType(value: unknown): string;

export function formatCleanupState(task: {
  clearedAt?: string | null;
  programId?: string | null;
  inspectionOccurrenceId?: string | null;
  inspectionStatus?: string | null;
  openCorrectiveWorkOrders?: number;
}): string;
