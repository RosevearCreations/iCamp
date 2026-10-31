export interface EscalationAgingItem {
  caseId: string;
  siteCode: string;
  summary: string;
  caseState: string;
  severity: string;
  assignedToLabel: string | null;
  escalationId: string;
  level: string;
  state: "open" | "acknowledged";
  raisedAt: string | null;
  acknowledgedAt: string | null;
  raisedByLabel: string | null;
  ageHours: number | null;
  band: "under24" | "over24" | "over72" | "unknown";
  multipleActive: boolean;
}

export interface EscalationAgingSummary {
  generatedAt: string;
  activeCount: number;
  awaitingAcknowledgement: number;
  awaitingResolution: number;
  over24Hours: number;
  over72Hours: number;
  urgentActive: number;
  unknownAge: number;
  multipleActive: number;
  items: EscalationAgingItem[];
}

export interface AgingSourceCase {
  id: string;
  accommodationCode: string;
  summary: string;
  caseState: string;
  severity: string;
  assignedToLabel: string | null;
  escalations: Array<{
    id: string;
    escalationLevel: string;
    state: string;
    raisedAt: string | null;
    acknowledgedAt: string | null;
    raisedByLabel: string | null;
  }>;
}
export function summarizeEscalationAging(
  cases: AgingSourceCase[],
  observedAt?: Date,
): EscalationAgingSummary;
