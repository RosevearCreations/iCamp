import type { CottageTurnoverOperationsWorkspace } from "../cottage-turnover-operations/postgres.mjs";
import type { CampsiteDepartureCleanupWorkspace } from "../campsite-departure-cleanup/postgres.mjs";

export type CottageReleaseSource =
  CottageTurnoverOperationsWorkspace["turnovers"][number];
export type CampsiteReleaseSource =
  CampsiteDepartureCleanupWorkspace["tasks"][number];
export type ReleaseFilters = {
  view: "all" | "ready" | "blocked" | "released";
  kind: "all" | "cottage" | "campsite";
  query: string;
};
export type ReleaseDecision = {
  status: "ready" | "blocked" | "released";
  blockers: string[];
  restoresAvailability: boolean;
  recordOnly: boolean;
};
export type ReleaseRow = (
  | (CottageReleaseSource & { kind: "cottage" })
  | (CampsiteReleaseSource & { kind: "campsite" })
) & {
  code: string;
  name: string;
  sourceHref: string;
  release: ReleaseDecision;
};

export function normalizeReleaseFilters(
  input?: Partial<Record<keyof ReleaseFilters, string>>,
): ReleaseFilters;
export function evaluateTurnoverRelease(
  item:
    | (CottageReleaseSource & { kind: "cottage" })
    | (CampsiteReleaseSource & { kind: "campsite" }),
): ReleaseDecision;
export function buildTurnoverReleaseBoard(input: {
  cottages?: CottageReleaseSource[];
  campsites?: CampsiteReleaseSource[];
  filters?: Partial<Record<keyof ReleaseFilters, string>>;
}): {
  rows: ReleaseRow[];
  counts: { total: number; ready: number; blocked: number; released: number };
  filters: ReleaseFilters;
};
