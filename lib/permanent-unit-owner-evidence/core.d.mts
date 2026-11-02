export interface EvidenceFilter {
  sourceCampgroundId: string | null;
  targetCampgroundId: string | null;
  status: string;
  query: string;
  from: string | null;
  to: string | null;
  page: number;
}
export type EvidenceSearchInput = Partial<
  Record<
    | "sourceCampgroundId"
    | "targetCampgroundId"
    | "status"
    | "query"
    | "from"
    | "to"
    | "page",
    string | number | null
  >
>;
export interface EvidenceExportInput extends EvidenceSearchInput {
  id?: string;
  evidenceReference?: string;
  acceptanceNote?: string;
  confirmed?: string;
}
export interface EvidenceRow {
  resolutionId: string;
  planId: string;
  sourceCampgroundId: string;
  targetCampgroundId: string;
  resolvedAt: string;
  resolutionKind: string;
  resolutionEvidenceReference: string;
  reassessmentId: string | null;
  reviewedAt: string | null;
  reviewKind: string | null;
  reviewEvidenceReference: string | null;
  acceptanceId: string | null;
  acceptedAt: string | null;
  acceptanceEvidenceReference: string | null;
  status: string;
}
export function normalizeEvidenceSearch(
  input?: EvidenceSearchInput,
): EvidenceFilter;
export function normalizeEvidenceExport(
  input?: EvidenceExportInput,
): EvidenceFilter & {
  id: string;
  evidenceReference: string;
  acceptanceNote: string;
};
export function evidenceStatus(row: {
  acceptanceId?: string | null;
  reassessmentId?: string | null;
  reviewKind?: string | null;
}): string;
export function csvCell(value: unknown): string;
export function renderEvidenceCsv(rows: EvidenceRow[]): string;
export function csvDigest(csv: string): string;
