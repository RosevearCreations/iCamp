export interface ResolutionEvent {
  id: string;
  kind: string;
  occurredAt: string;
  summary: string;
  actor: string;
  sourceChannel: string;
}

export interface ResolutionEntry {
  id: string;
  accommodationCode: string;
  summary: string;
  severity: string;
  caseState: string;
  assignedToLabel: string | null;
  submittedAt: string | null;
  updatedAt: string | null;
  closedAt: string | null;
  outcomeCode: string | null;
  durationHours: number | null;
  ageHours: number | null;
  closureEventPresent: boolean;
  events: ResolutionEvent[];
}

export interface ResolutionTimelineSummary {
  generatedAt: string;
  count: number;
  closedCount: number;
  unresolvedCount: number;
  urgentOpenCount: number;
  closedWithEvidenceCount: number;
  measuredClosures: number;
  averageResolutionHours: number | null;
  entries: ResolutionEntry[];
}

export interface ResolutionSourceCase {
  id: string;
  accommodationCode: string;
  summary: string;
  severity: string;
  caseState: string;
  assignedToLabel: string | null;
  submittedAt: string | null;
  updatedAt: string | null;
  closedAt: string | null;
  outcomeCode: string | null;
  events: Array<{
    id: string;
    eventKind: string;
    occurredAt: string | null;
    summary: string;
    actorLabel: string | null;
    sourceChannel: string;
  }>;
}

export function buildCamperResolutionTimeline(
  cases: ResolutionSourceCase[],
  observedAt?: Date,
): ResolutionTimelineSummary;
