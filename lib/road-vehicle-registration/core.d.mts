export type RoadVehicleSourceChannel =
  "web" | "staff" | "ivr" | "sms" | "system";

export type RoadVehicleKind =
  "car" | "truck" | "suv" | "van" | "motorcycle" | "tow_vehicle" | "other";

export interface RoadVehicleRegistrationInput {
  vehicleKind: RoadVehicleKind;
  plateNumber: string;
  plateJurisdiction: string;
  vehicleDescription: string;
  registeredOwnerName: string;
  primaryDriverName: string;
  validFrom: string;
  validUntil: string;
  notes: string | null;
}

export function normalizeRoadVehicleSourceChannel(
  value?: unknown,
): RoadVehicleSourceChannel;

export function normalizeRoadVehicleRegistrationInput(
  input?: Record<string, unknown>,
): RoadVehicleRegistrationInput;

export function normalizeRoadVehicleRevocationReason(value: unknown): string;
