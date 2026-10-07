import type {
  MessagingProviderAdapter,
  NormalizedMessagingWebhook,
} from "./provider.d.mts";

export interface MessagingLine {
  id: string;
  organizationId: string;
  campgroundId: string;
  endpointId: string;
  providerKey: string;
  sandboxMode: boolean;
  lifecycleState: "active" | "inactive";
}

export interface MessagingMessage {
  id: string;
  conversationId: string;
  dispatchId: string;
  direction: "inbound" | "outbound";
  channel: "sms" | "mms";
  purpose: "transactional" | "operational" | "marketing";
  deliveryState:
    "received" | "queued" | "submitted" | "delivered" | "read" | "failed";
  bodyLength: number;
  commandKind: string | null;
  commandSource:
    "numbered" | "keyword" | "structured" | "natural_language" | "none";
  commandState:
    | "not_applicable"
    | "navigation"
    | "verification_required"
    | "validation_required"
    | "rejected";
  occurredAt: string | null;
  deliveredAt: string | null;
  readAt: string | null;
}

export function registerMessagingLine(input: {
  actorUserId: string;
  organizationId: string;
  campgroundId: string;
  endpointId: string;
  providerKey: string;
  providerNumberReference: string;
  sandboxMode?: boolean;
  reason?: string;
}): Promise<MessagingLine>;

export function startOutboundMessage(input: {
  actorUserId: string;
  organizationId: string;
  campgroundId: string;
  lineId: string;
  destinationEndpointId: string;
  purpose?: "transactional" | "operational" | "marketing";
  idempotencyKey: string;
  text: string;
  mediaAssetIds?: string[];
  provider: MessagingProviderAdapter;
}): Promise<{
  message: MessagingMessage;
  duplicate: boolean;
}>;

export function ingestMessagingProviderEvent(
  event: NormalizedMessagingWebhook,
): Promise<{
  duplicate: boolean;
  message: MessagingMessage | null;
  command: null | {
    kind: string;
    source: string;
    validation: {
      accepted: boolean;
      state:
        | "navigation"
        | "verification_required"
        | "validation_required"
        | "rejected";
      action: string;
    };
  };
}>;

export function getMessagingGatewayHealth(): Promise<{
  status: "operational" | "degraded";
  lines: { active: number; sandbox: number };
  messages: {
    inbound24h: number;
    outbound24h: number;
    failed24h: number;
    gatedCommands24h: number;
  };
  attachments: { pendingScan: number };
}>;

export function closeMessagingPoolForTests(): Promise<void>;
