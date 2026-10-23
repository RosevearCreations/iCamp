export declare const ASSISTANCE_CASE_STATES: readonly string[];
export declare const ASSISTANCE_ESCALATION_LEVELS: readonly string[];
export declare const ASSISTANCE_OUTCOMES: readonly string[];
export declare const ASSISTANCE_MESSAGE_CHANNELS: readonly string[];

export declare function normalizeAssistanceTriage(input?: {
  category?: unknown;
  severity?: unknown;
  assignedToUserId?: unknown;
  note?: unknown;
}): {
  category: string;
  severity: string;
  assignedToUserId: string | null;
  note: string;
};

export declare function normalizeAssistanceEscalation(input?: {
  level?: unknown;
  reason?: unknown;
}): { level: string; reason: string };

export declare function normalizeAssistanceGuestMessage(input?: {
  channel?: unknown;
  message?: unknown;
}): { channel: string; message: string };

export declare function normalizeAssistanceClosure(input?: {
  outcomeCode?: unknown;
  outcomeSummary?: unknown;
}): { outcomeCode: string; outcomeSummary: string };
