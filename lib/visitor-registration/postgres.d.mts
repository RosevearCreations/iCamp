import type {
  PaymentProviderAdapter,
  PaymentProviderEvent,
} from "../payments/provider.mjs";

export interface VisitorPolicy {
  id: string | null;
  dayVisitChargeId: string | null;
  weekVisitChargeId: string | null;
  identityVerificationMode: "none" | "host_attested" | "staff_visual";
  contactRequirement: "none" | "phone" | "email" | "either" | "both";
  visitorRule: string;
  rowVersion: number;
  persisted: boolean;
}

export interface VisitorCharge {
  id: string;
  code: string;
  displayName: string;
  currencyCode: string;
  unitPriceCents: number;
  passDurationDays: number;
}

export interface VisitorReservationOption {
  id: string;
  accommodationId: string;
  accommodationCode: string;
  accommodationName: string;
  arrivalDate: string;
  departureDate: string;
  status: string;
  externalReference: string | null;
  effectiveMaxVisitors: number | null;
  capacityRuleId: string | null;
  capacityRuleScope: string | null;
  currentOpenVisitors: number;
}

export interface VisitorRegistrationRecord {
  id: string;
  visitorNumber: string;
  reservationId: string;
  hostAccommodationId: string;
  hostAccommodationLabel: string;
  visitorName: string;
  contactPhone: string | null;
  contactEmail: string | null;
  identityVerificationMode: string;
  identityVerifiedAt: string | null;
  contactRequirement: string;
  visitKind: "day" | "week";
  validFrom: string;
  validUntil: string;
  effectiveMaxVisitors: number | null;
  capacityRuleId: string | null;
  capacityRuleScope: string | null;
  sourceChargeId: string | null;
  feeAmountCents: number;
  currencyCode: string;
  paymentState: "not_required" | "unpaid" | "captured";
  registrationStatus: "pending_payment" | "active" | "revoked";
  effectiveStatus: string;
  visitorRuleSnapshot: string;
  revokedAt: string | null;
  revocationReason: string | null;
  sourceChannel: string;
  notes: string | null;
  latestPaymentState: string | null;
  createdAt: string;
  updatedAt: string;
  rowVersion: number;
}

export interface VisitorRegistrationDesk {
  campground: {
    id: string;
    organizationId: string;
    displayName: string;
    timeZone: string;
    localDate: string;
    localDateTime: string;
  };
  policy: VisitorPolicy;
  charges: VisitorCharge[];
  reservations: VisitorReservationOption[];
  registrations: VisitorRegistrationRecord[];
  canRegister: boolean;
  canCapturePayment: boolean;
  canManagePolicy: boolean;
}

export function closeVisitorRegistrationPoolForTests(): Promise<void>;
export function listVisitorRegistrationDesk(input: {
  userId: string;
  campgroundId: string;
}): Promise<VisitorRegistrationDesk>;
export function saveVisitorPolicy(input: {
  actorUserId: string;
  actorSessionId?: string | null;
  campgroundId: string;
  expectedRowVersion: number;
  input?: Record<string, unknown>;
}): Promise<VisitorPolicy>;
export function createVisitorRegistration(input: {
  actorUserId: string;
  actorSessionId?: string | null;
  campgroundId: string;
  idempotencyKey: string;
  input?: Record<string, unknown>;
  sourceChannel?: string;
}): Promise<{
  registration: VisitorRegistrationRecord;
  idempotent: boolean;
}>;
export function revokeVisitorRegistration(input: {
  actorUserId: string;
  actorSessionId?: string | null;
  campgroundId: string;
  visitorRegistrationId: string;
  expectedRowVersion: number;
  reason: string;
  sourceChannel?: string;
}): Promise<{
  registration: VisitorRegistrationRecord;
  idempotent: boolean;
}>;
export function startVisitorRegistrationPayment(input: {
  actorUserId: string;
  actorSessionId?: string | null;
  campgroundId: string;
  visitorRegistrationId: string;
  provider: PaymentProviderAdapter;
}): Promise<{
  registration: VisitorRegistrationRecord;
  payment: unknown;
  alreadySatisfied?: boolean;
  active?: boolean;
  duplicate?: boolean;
}>;
export function ingestVisitorRegistrationPaymentProviderEvent(input: {
  event: PaymentProviderEvent;
  actorSessionId?: string | null;
}): Promise<{
  duplicate: boolean;
  registration: VisitorRegistrationRecord;
  payment: unknown;
}>;
