export interface ReconciliationRow {
  id: string;
  credentialNumber: string;
  credentialType: string;
  subjectKind: string;
  subjectLabel: string;
  displayHint: string | null;
  status: string;
  validFrom: string;
  validUntil: string | null;
  sourceKind: string;
  sourceNumber: string | null;
  sourceStatus: string;
  sourceValidFrom: string | null;
  sourceValidUntil: string | null;
  assignmentStatus: string | null;
  duplicateCount: number;
  rowVersion: number;
  totalCount: number;
  verdict: { allowed: boolean; reason: string };
}
export interface ReconciliationBoard {
  items: ReconciliationRow[];
  total: number;
  scannedAt: string;
  needsAttention: number;
  reviews: Array<{
    credentialId: string;
    disposition: string;
    reason: string;
    status: string;
    sourceStatus: string;
    verdict: string;
    observedAt: string;
  }>;
}
export function listAccessReconciliation(input: {
  actorUserId: string;
  campgroundId: string;
  now?: Date;
}): Promise<ReconciliationBoard>;
export function recordAccessReconciliationReview(input: {
  actorUserId: string;
  actorSessionId?: string | null;
  campgroundId: string;
  credentialId: string;
  input: { disposition: string; reason: string; rowVersion: number };
}): Promise<{
  verdict: { allowed: boolean; reason: string };
  disposition: string;
}>;
