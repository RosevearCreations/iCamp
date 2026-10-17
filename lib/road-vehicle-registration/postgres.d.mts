import type {
  RoadVehicleKind,
  RoadVehicleSourceChannel,
} from "./core.mjs";

export interface RoadVehicleRegistration {
  id: string;
  reservationId: string | null;
  guestProfileId: string | null;
  guestVehicleProfileId: string | null;
  hostAccommodationId: string;
  hostAccommodationLabel: string;
  vehicleKind: RoadVehicleKind | string;
  plateNumber: string;
  plateJurisdiction: string;
  vehicleDescription: string;
  registeredOwnerName: string;
  primaryDriverName: string;
  validFrom: string;
  validUntil: string;
  registrationStatus: "active" | "revoked";
  effectiveStatus: "active" | "expired" | "revoked" | string;
  revokedAt: string | null;
  revocationReason: string | null;
  sourceChannel: RoadVehicleSourceChannel | string;
  notes: string | null;
  createdAt: string | null;
  updatedAt: string | null;
  rowVersion: number;
}

export interface RoadVehicleRegistrationDesk {
  campground: {
    id: string;
    organizationId: string;
    displayName: string;
    timeZone: string;
    localDate: string;
  };
  registrations: RoadVehicleRegistration[];
  accommodations: Array<{
    id: string;
    code: string;
    displayName: string;
    accommodationKind: string;
    statusState: string;
  }>;
  reservations: Array<{
    id: string;
    accommodationId: string;
    guestProfileId: string | null;
    arrivalDate: string;
    departureDate: string;
    status: string;
    accommodationCode: string;
    accommodationName: string;
    guestName: string;
  }>;
  savedVehicles: Array<{
    id: string;
    guestProfileId: string;
    nickname: string;
    vehicleKind: string;
    make: string | null;
    model: string | null;
    color: string | null;
    modelYear: number | null;
    guestName: string;
  }>;
  canRegister: boolean;
}

export function closeRoadVehicleRegistrationPoolForTests(): Promise<void>;

export function listRoadVehicleRegistrationDesk(input: {
  userId: string;
  campgroundId: string;
}): Promise<RoadVehicleRegistrationDesk>;

export function createRoadVehicleRegistration(input: {
  actorUserId: string;
  actorSessionId?: string | null;
  campgroundId: string;
  hostAccommodationId: string;
  reservationId?: string | null;
  guestVehicleProfileId?: string | null;
  idempotencyKey: string;
  input?: Record<string, unknown>;
  sourceChannel?: RoadVehicleSourceChannel;
}): Promise<{
  registration: RoadVehicleRegistration;
  idempotent: boolean;
}>;

export function revokeRoadVehicleRegistration(input: {
  actorUserId: string;
  actorSessionId?: string | null;
  campgroundId: string;
  registrationId: string;
  expectedRowVersion: number;
  reason: unknown;
  sourceChannel?: RoadVehicleSourceChannel;
}): Promise<{
  registration: RoadVehicleRegistration;
  idempotent: boolean;
}>;
