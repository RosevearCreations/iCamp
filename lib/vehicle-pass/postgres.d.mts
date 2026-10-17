import type {
  PaymentProviderAdapter,
  PaymentProviderEvent,
} from "../payments/provider.mjs";

export interface VehiclePassCharge {
  id: string;
  chargeKind: "add_on" | "pass" | "service_fee";
  code: string;
  displayName: string;
  currencyCode: string;
  pricingBasis: string;
  unitPriceCents: number | null;
  passDurationDays: number | null;
  feeCategoryCode: string | null;
}

export interface VehiclePassPolicy {
  id: string | null;
  dayPassChargeId: string | null;
  weekPassChargeId: string | null;
  extraVehicleChargeId: string | null;
  includedStayVehicleCount: number;
  parkingRule: string;
  accessRule: string;
  rowVersion: number;
  persisted: boolean;
}

export interface VehiclePassRecord {
  id: string;
  passNumber: string;
  passKind: "day" | "week" | "extra_vehicle";
  reservationId: string | null;
  roadVehicleRegistrationId: string | null;
  hostAccommodationId: string | null;
  sourceChargeId: string | null;
  plateNumber: string;
  plateJurisdiction: string;
  vehicleDescription: string;
  driverName: string;
  validFrom: string;
  validUntil: string;
  feeAmountCents: number;
  currencyCode: string;
  paymentState: "not_required" | "unpaid" | "captured";
  passStatus: "pending_payment" | "active" | "revoked";
  effectiveStatus: string;
  parkingRuleSnapshot: string;
  accessRuleSnapshot: string;
  revokedAt: string | null;
  revocationReason: string | null;
  sourceChannel: string;
  notes: string | null;
  latestPaymentState: string | null;
  createdAt: string;
  updatedAt: string;
  rowVersion: number;
}

export interface ExtraVehicleRegistrationOption {
  id: string;
  reservationId: string;
  hostAccommodationId: string;
  hostAccommodationLabel: string;
  plateNumber: string;
  plateJurisdiction: string;
  vehicleDescription: string;
  driverName: string;
  registrationValidFrom: string;
  registrationValidUntil: string;
  reservationArrivalDate: string;
  reservationDepartureDate: string;
  reservationStatus: string;
  activeVehicleCount: number;
  hasOpenExtraPass: boolean;
}

export interface VehiclePassDesk {
  campground: {
    id: string;
    organizationId: string;
    displayName: string;
    timeZone: string;
    localDate: string;
    localDateTime: string;
  };
  policy: VehiclePassPolicy;
  charges: VehiclePassCharge[];
  passes: VehiclePassRecord[];
  registrations: ExtraVehicleRegistrationOption[];
  canIssue: boolean;
  canCapturePayment: boolean;
  canManagePolicy: boolean;
}

export function closeVehiclePassPoolForTests(): Promise<void>;
export function listVehiclePassDesk(input: {
  userId: string;
  campgroundId: string;
}): Promise<VehiclePassDesk>;
export function saveVehiclePassPolicy(input: {
  actorUserId: string;
  actorSessionId?: string | null;
  campgroundId: string;
  expectedRowVersion: number;
  input?: Record<string, unknown>;
}): Promise<VehiclePassPolicy>;
export function createNonStayVehiclePass(input: {
  actorUserId: string;
  actorSessionId?: string | null;
  campgroundId: string;
  idempotencyKey: string;
  input?: Record<string, unknown>;
  sourceChannel?: string;
}): Promise<{ pass: VehiclePassRecord; idempotent: boolean }>;
export function createExtraVehiclePass(input: {
  actorUserId: string;
  actorSessionId?: string | null;
  campgroundId: string;
  idempotencyKey: string;
  input?: Record<string, unknown>;
  sourceChannel?: string;
}): Promise<{ pass: VehiclePassRecord; idempotent: boolean }>;
export function revokeVehiclePass(input: {
  actorUserId: string;
  actorSessionId?: string | null;
  campgroundId: string;
  vehiclePassId: string;
  expectedRowVersion: number;
  reason: string;
  sourceChannel?: string;
}): Promise<{ pass: VehiclePassRecord; idempotent: boolean }>;
export function startVehiclePassPayment(input: {
  actorUserId: string;
  actorSessionId?: string | null;
  campgroundId: string;
  vehiclePassId: string;
  provider: PaymentProviderAdapter;
}): Promise<{
  pass: VehiclePassRecord;
  payment: unknown;
  alreadySatisfied?: boolean;
  active?: boolean;
  duplicate?: boolean;
}>;
export function ingestVehiclePassPaymentProviderEvent(input: {
  event: PaymentProviderEvent;
  actorSessionId?: string | null;
}): Promise<{
  duplicate: boolean;
  pass: VehiclePassRecord;
  payment: unknown;
}>;
