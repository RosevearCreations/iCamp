import type { CamperAssistanceRequest } from "../camper-assistance/postgres.mjs";
import type { GuestAssistanceUpdate } from "../camper-assistance-triage/postgres.mjs";

export function normalizeAssistanceReply(input: Record<string, unknown>): {
  clientMessageId: string;
  message: string;
};

export function guestAssistanceProgress(input: {
  request: CamperAssistanceRequest;
  update: GuestAssistanceUpdate | null;
}): {
  caseState: string;
  urgent: boolean;
  escalation: string;
  closed: boolean;
  assignment: string;
  canReply: boolean;
  events: Array<{
    id: string;
    eventKind: string;
    summary: string;
    occurredAt: string | null;
    actor: string;
  }>;
};
