export type ReservationManagementChangeKind =
  "create" | "edit" | "move" | "extend" | "shorten" | "fees" | "cancel";

export interface ManagementChargeSelection {
  code: string;
  quantity: number;
}

export function parseManagementChargeSelections(
  value: string | ManagementChargeSelection[],
): ManagementChargeSelection[];

export function normalizeReservationManagementInput(
  input?: Record<string, unknown>,
): {
  accommodationId: string;
  arrivalDate: string;
  departureDate: string;
  guestDisplayName: string;
  contactEmail: string | null;
  selections: ManagementChargeSelection[];
};

export function normalizeManagementReason(value: unknown): string;

export function classifyReservationChange(
  before: Record<string, unknown>,
  after: Record<string, unknown>,
): ReservationManagementChangeKind;

export function calculateReservationFinancialDelta(input: {
  previousTotalCents: number;
  revisedTotalCents: number;
  capturedCents?: number;
  hasPaymentSchedule?: boolean;
  cancelled?: boolean;
}): {
  previousTotalCents: number;
  revisedTotalCents: number;
  deltaCents: number;
  capturedCents: number;
  financialReviewRequired: boolean;
  financialReviewReason: string | null;
};

export function reservationManagementSnapshot(
  input: Record<string, unknown>,
): Record<string, unknown>;
