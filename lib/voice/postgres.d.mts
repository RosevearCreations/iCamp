import type { CommunicationPurpose } from "../communications/postgres.d.mts";
import type { IvrTransitionResult } from "./ivr.d.mts";
import type {
  NormalizedVoiceWebhook,
  VoiceProviderAdapter,
} from "./provider.d.mts";

export interface VoiceLine {
  id: string;
  organizationId: string;
  campgroundId: string;
  endpointId: string;
  providerKey: string;
  routeKey: string;
  staffTransferEndpointId: string | null;
  inboundEnabled: boolean;
  outboundEnabled: boolean;
  sandboxMode: boolean;
  lifecycleState: "active" | "inactive";
}

export interface VoiceCall {
  id: string;
  organizationId: string;
  campgroundId: string;
  lineId: string;
  dispatchId: string;
  remoteEndpointId: string | null;
  providerKey: string;
  direction: "inbound" | "outbound";
  routeKey: string;
  callState:
    "ringing" | "in_progress" | "transferring" | "completed" | "failed";
  transferState: "none" | "requested" | "completed" | "fallback" | "failed";
  lastErrorCode: string | null;
  lastErrorSummary: string | null;
  startedAt: string | null;
  answeredAt: string | null;
  endedAt: string | null;
}

export function registerVoiceLine(input: {
  actorUserId: string;
  organizationId: string;
  campgroundId: string;
  endpointId: string;
  providerKey: string;
  providerNumberReference: string;
  routeKey?: string;
  staffTransferEndpointId?: string | null;
  inboundEnabled?: boolean;
  outboundEnabled?: boolean;
  sandboxMode?: boolean;
  reason?: string;
}): Promise<VoiceLine>;

export function startOutboundVoiceCall(input: {
  actorUserId: string;
  organizationId: string;
  campgroundId: string;
  lineId: string;
  destinationEndpointId: string;
  purpose?: CommunicationPurpose;
  idempotencyKey: string;
  provider: VoiceProviderAdapter;
}): Promise<VoiceCall>;

export function ingestVoiceProviderEvent(
  event: NormalizedVoiceWebhook,
): Promise<{
  inserted: boolean;
  duplicate: boolean;
  call: VoiceCall | null;
  sessionId: string | null;
}>;

export function advanceVoiceIvr(input: {
  callId: string;
  eventType: string;
  provider?: VoiceProviderAdapter | null;
}): Promise<
  IvrTransitionResult & {
    transfer: null | {
      transferred: boolean;
      fallback: boolean;
      reason: string;
    };
  }
>;

export function transferVoiceCallToStaff(input: {
  callId: string;
  provider: VoiceProviderAdapter;
  reason?: string;
}): Promise<{
  transferred: boolean;
  fallback: boolean;
  reason: string;
}>;

export function getVoiceGatewayHealth(): Promise<{
  status: "operational" | "degraded";
  lines: {
    active: number;
    sandbox: number;
  };
  calls: {
    active: number;
    failed24h: number;
    transferFallbacks: number;
  };
  ivr: {
    active: number;
    expired: number;
  };
}>;

export function closeVoicePoolForTests(): Promise<void>;
