/** Combine independent work streams by stable accommodation ID.
 * An unknown source remains unknown; a completed item clears only itself.
 */
export function summarizeSiteWork285(sites, cases, jobs) {
  const assistance =
    cases === null || cases.some((item) => !item.accommodationId)
      ? null
      : new Map();
  const fulfillment =
    jobs === null || jobs.some((item) => !item.accommodationId)
      ? null
      : new Map();
  for (const item of cases ?? []) {
    if (item.caseState === "closed") continue;
    const key = item.accommodationId;
    if (!key) continue;
    assistance?.set(key, (assistance.get(key) ?? 0) + 1);
  }
  for (const item of jobs ?? []) {
    if (item.jobState === "completed") continue;
    const key = item.accommodationId;
    if (!key) continue;
    fulfillment?.set(key, (fulfillment.get(key) ?? 0) + 1);
  }
  return sites.map((site) => ({
    id: site.id,
    code: site.code,
    name: site.displayName,
    operatingState: site.statusState,
    assistance: assistance === null ? null : (assistance.get(site.id) ?? 0),
    fulfillment: fulfillment === null ? null : (fulfillment.get(site.id) ?? 0),
  }));
}
