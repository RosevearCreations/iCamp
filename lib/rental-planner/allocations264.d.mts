export interface RentalAllocationInput264 {
  requestId: string;
  staffSafetyReview: string;
  status: "reserved_for_staff_collection";
  paymentCaptured: false;
  equipmentHandedOver: false;
  animalAssigned: false;
}
export function normalizeRentalAllocation264(input: {
  requestId?: unknown;
  staffSafetyReview?: unknown;
}): RentalAllocationInput264;
export interface SupervisedPilotInput264 {
  sessionId: string;
  outcome: "hold" | "accepted_for_internal_pilot";
  originalEvidenceReference: string;
  supervisionWelfareCheck: string;
  guestEnrollmentEnabled: false;
  liveActivityBookingEnabled: false;
  insuranceCertified: false;
}
export function normalizeSupervisedPilot264(input: {
  sessionId?: unknown;
  outcome?: unknown;
  originalEvidenceReference?: unknown;
  supervisionWelfareCheck?: unknown;
}): SupervisedPilotInput264;
export function rentalReservationLabel264(status: unknown): string;
