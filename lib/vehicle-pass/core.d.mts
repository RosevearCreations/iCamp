export type VehiclePassSourceChannel =
  "web" | "staff" | "ivr" | "sms" | "system";

export type NonStayVehiclePassKind = "day" | "week";

export interface VehiclePassPolicyInput {
  dayPassChargeId?: string | null;
  weekPassChargeId?: string | null;
  extraVehicleChargeId?: string | null;
  includedStayVehicleCount?: number | string;
  parkingRule: string;
  accessRule: string;
}

export interface NonStayVehiclePassInput {
  passKind: NonStayVehiclePassKind;
  plateNumber: string;
  plateJurisdiction: string;
  vehicleDescription: string;
  driverName: string;
  validFromLocal: string;
  validUntilLocal: string;
  notes?: string | null;
}

export interface ExtraVehiclePassInput {
  roadVehicleRegistrationId: string;
  validFromLocal: string;
  validUntilLocal: string;
  notes?: string | null;
}

export function normalizeVehiclePassSourceChannel(
  value?: unknown,
): VehiclePassSourceChannel;
export function normalizeNonStayVehiclePassInput(
  input?: Partial<NonStayVehiclePassInput>,
): NonStayVehiclePassInput;
export function normalizeExtraVehiclePassInput(
  input?: Partial<ExtraVehiclePassInput>,
): ExtraVehiclePassInput;
export function normalizeVehiclePassPolicyInput(
  input?: Partial<VehiclePassPolicyInput>,
): {
  dayPassChargeId: string | null;
  weekPassChargeId: string | null;
  extraVehicleChargeId: string | null;
  includedStayVehicleCount: number;
  parkingRule: string;
  accessRule: string;
};
export function normalizeVehiclePassRevocationReason(value: unknown): string;
export function effectiveVehiclePassStatus(input: {
  passStatus: string;
  validFrom: string | Date;
  validUntil: string | Date;
  now?: string | Date;
}): string;
