export type FrontDeskSourceChannel =
  | "web"
  | "staff"
  | "ivr"
  | "sms"
  | "system";

export interface ArrivalRequest {
  requestKind: "rental" | "store_add_on";
  requestCode: string;
  displayName: string;
  quantity: number;
}

export interface FrontDeskCheckInInput {
  occupantCount: number;
  visitorCount: number;
  petCount: number;
  vehicleCount: number;
  vehicleProfileIds: string[];
  petProfileIds: string[];
  rulesAcknowledged: true;
  credentialRequestCount: number;
  balanceOverrideRequested: boolean;
  balanceOverrideReason: string | null;
  notes: string | null;
  rentalRequests: ArrivalRequest[];
  storeRequests: ArrivalRequest[];
}

export function normalizeCheckInSourceChannel(
  value?: unknown,
): FrontDeskSourceChannel;

export function parseArrivalRequests(
  value: unknown,
  requestKind: "rental" | "store_add_on",
): ArrivalRequest[];

export function normalizeFrontDeskCheckInInput(
  input?: Record<string, unknown>,
): FrontDeskCheckInInput;
