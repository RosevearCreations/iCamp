export function inspectOriginalRuntime268(): Promise<{
  status: string;
  hostPinConfigured: boolean;
  runtimeTargetPinMatches: boolean;
  migrationHistoryPresent: boolean;
  migration0241: boolean;
  migration0242: boolean;
  migration0243: boolean;
  campRosevear: string;
}>;
export function diagnoseCampgroundBooking268(input: {
  userId: string;
  campgroundId: string;
  reservationId: string;
}): Promise<{
  status: string;
  stage: string;
  evidence: null | {
    reservationStatus: string;
    bookingDueCents: number | null;
    capturedCents: number;
    paymentRows: number;
    providerEventRows: number;
    confirmationExists: boolean;
    receiptRows: number;
    deliveryState: string;
    providerReconciled: boolean;
    holdVerified: boolean;
  };
}>;
export function getRecoveryShellSummary268(): Promise<{
  status: string;
  opened: number | null;
  overdue: number | null;
  queuedAlerts: number | null;
  acknowledgedAlerts: number | null;
}>;
export function queueOverdueSupport268(): Promise<{
  status: string;
  queued: number;
}>;

export function openBookingRecovery268(input: {
  userId: string;
  campgroundId: string;
  reservationId: string;
  supportCaseId: string;
  nextUpdateAt: string;
}): Promise<{ recoveryId: string; newlyOpened: boolean }>;
export function recordBookingRecovery268(input: {
  userId: string;
  campgroundId: string;
  recoveryId: string;
  version: number;
  eventKind: string;
  evidenceReference: string;
  nextUpdateAt: string;
  outcome: string;
}): Promise<{
  version: number;
  state: string;
  independentProviderCertification: boolean;
}>;
export function listLocalBookingRecovery268(input: {
  userId: string;
  campgroundId: string;
}): Promise<{
  status: string;
  cases: Array<{
    id: string;
    caseId: string;
    reservationId: string;
    state: string;
    outcome: string;
    nextUpdateAt: string;
    version: number;
  }>;
}>;
