export type CommunicationChannel =
  | "web"
  | "voice"
  | "dtmf"
  | "speech"
  | "sms"
  | "mms"
  | "email"
  | "push";

export type CommunicationPurpose =
  | "transactional"
  | "operational"
  | "marketing";

export interface CommunicationEndpoint {
  id: string;
  organizationId: string;
  campgroundId: string;
  ownerUserId: string | null;
  endpointKind: "phone" | "email" | "push" | "web";
  displayHint: string | null;
  verifiedAt: string | null;
  lifecycleState: "active" | "inactive";
}

export interface CommunicationDispatch {
  id: string;
  organizationId: string;
  campgroundId: string;
  endpointId: string | null;
  direction: "inbound" | "outbound";
  channel: CommunicationChannel;
  purpose: CommunicationPurpose;
  idempotencyKey: string;
  contentReference: string | null;
  deliveryState: "queued" | "submitted" | "delivered" | "failed" | "cancelled";
  maxAttempts: number;
  attemptCount: number;
  nextAttemptAt: string | null;
  lastErrorCode: string | null;
  lastErrorSummary: string | null;
  completedAt: string | null;
}

export function communicationRetryDelaySeconds(
  attemptNumber: number,
  baseSeconds?: number,
): number;

export function registerCommunicationEndpoint(input: {
  actorUserId: string;
  organizationId: string;
  campgroundId: string;
  ownerUserId?: string | null;
  endpointKind: "phone" | "email" | "push" | "web";
  endpointValue: string;
  displayHint?: string | null;
  verifiedAt?: string | Date | null;
  reason?: string;
}): Promise<CommunicationEndpoint>;

export function setCommunicationPreference(input: {
  actorUserId: string;
  campgroundId: string;
  endpointId: string;
  purpose: CommunicationPurpose;
  channel: CommunicationChannel;
  preferenceState: "enabled" | "disabled";
  source?: "user" | "staff" | "system" | "provider";
  reason?: string;
}): Promise<{
  id: string;
  endpointId: string;
  purpose: CommunicationPurpose;
  channel: CommunicationChannel;
  preferenceState: "enabled" | "disabled";
  source: string;
}>;

export function recordCommunicationConsent(input: {
  actorUserId: string;
  campgroundId: string;
  endpointId: string;
  purpose: CommunicationPurpose;
  channel: CommunicationChannel;
  consentState: "granted" | "withdrawn" | "not_required";
  evidenceSource: "user" | "staff" | "system" | "provider" | "import";
  evidenceReference?: string | null;
  reason?: string;
}): Promise<{ id: string; occurredAt: string | null }>;

export function createCommunicationDispatch(input: {
  actorUserId: string;
  organizationId: string;
  campgroundId: string;
  endpointId?: string | null;
  direction?: "inbound" | "outbound";
  channel: CommunicationChannel;
  purpose: CommunicationPurpose;
  idempotencyKey: string;
  contentReference?: string | null;
  maxAttempts?: number;
  reason?: string;
}): Promise<CommunicationDispatch>;

export function recordCommunicationAttempt(input: {
  dispatchId: string;
  providerKey: string;
  attemptState: "submitted" | "accepted" | "delivered" | "failed";
  retryable?: boolean;
  providerReference?: string | null;
  errorCode?: string | null;
  errorSummary?: string | null;
  retryBaseSeconds?: number;
}): Promise<CommunicationDispatch>;

export function recordCommunicationProviderEvent(input: {
  providerKey: string;
  providerEventId: string;
  dispatchId?: string | null;
  channel: CommunicationChannel;
  eventType: string;
  eventStatus: string;
  metadata?: Record<string, unknown>;
  occurredAt: string | Date;
}): Promise<{
  inserted: boolean;
  id: string | null;
  receivedAt: string | null;
}>;

export function getCommunicationsHealth(input?: {
  overdueSeconds?: number;
}): Promise<{
  status: "operational" | "degraded";
  delivery: {
    queued: number;
    submitted: number;
    delivered: number;
    failed: number;
    overdue: number;
  };
  calls: { activeWork: number };
  retries: {
    retryableFailures: number;
    terminalAttemptFailures: number;
  };
  providers: {
    events24h: number;
    latestEventAt: string | null;
  };
}>;

export function closeCommunicationsPoolForTests(): Promise<void>;
