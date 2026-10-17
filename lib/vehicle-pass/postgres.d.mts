export function closeVehiclePassPoolForTests(): Promise<void>;
export function listVehiclePassDesk(input: {
  userId: string;
  campgroundId: string;
}): Promise<any>;
export function saveVehiclePassPolicy(input: {
  actorUserId: string;
  actorSessionId?: string | null;
  campgroundId: string;
  expectedRowVersion: number;
  input?: Record<string, unknown>;
}): Promise<any>;
export function createNonStayVehiclePass(input: {
  actorUserId: string;
  actorSessionId?: string | null;
  campgroundId: string;
  idempotencyKey: string;
  input?: Record<string, unknown>;
  sourceChannel?: string;
}): Promise<any>;
export function createExtraVehiclePass(input: {
  actorUserId: string;
  actorSessionId?: string | null;
  campgroundId: string;
  idempotencyKey: string;
  input?: Record<string, unknown>;
  sourceChannel?: string;
}): Promise<any>;
export function revokeVehiclePass(input: {
  actorUserId: string;
  actorSessionId?: string | null;
  campgroundId: string;
  vehiclePassId: string;
  expectedRowVersion: number;
  reason: string;
  sourceChannel?: string;
}): Promise<any>;
export function startVehiclePassPayment(input: {
  actorUserId: string;
  actorSessionId?: string | null;
  campgroundId: string;
  vehiclePassId: string;
  provider: any;
}): Promise<any>;
export function ingestVehiclePassPaymentProviderEvent(input: {
  event: any;
  actorSessionId?: string | null;
}): Promise<any>;
