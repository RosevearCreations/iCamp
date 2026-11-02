import type {
  EvidenceFilter,
  EvidenceRow,
  EvidenceSearchInput,
  EvidenceExportInput,
} from "./core.mjs";
export function searchOwnerResolutionEvidence(
  actorUserId: string,
  authorizedIds: string[],
  filter: EvidenceSearchInput,
): Promise<{
  filter: EvidenceFilter;
  rows: EvidenceRow[];
  hasMore: boolean;
  coverageCap: boolean;
}>;
export function exportOwnerResolutionEvidence(
  actorUserId: string,
  rawInput: EvidenceExportInput,
): Promise<{ id: string; csv: string; sha256: string; count: number }>;
export function recentOwnerEvidenceExportAcceptances(
  actorUserId: string,
  sourceId: string | null,
  targetId: string | null,
): Promise<
  Array<{
    id: string;
    count: number;
    sha256: string;
    evidenceReference: string;
    acceptanceNote: string;
    acceptedAt: string;
  }>
>;
