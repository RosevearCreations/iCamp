export function summarizeSiteWork285(
  sites: {
    id: string;
    code: string;
    displayName: string;
    statusState: string;
  }[],
  cases: { accommodationId: string; caseState: string }[] | null,
  jobs: { accommodationId: string | null; jobState: string }[] | null,
): {
  id: string;
  code: string;
  name: string;
  operatingState: string;
  assistance: number | null;
  fulfillment: number | null;
}[];
