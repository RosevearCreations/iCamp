export const RENTAL_MIGRATIONS264 = Object.freeze([
  Object.freeze({
    version: "0192",
    name: "build182_rental_planning_offers",
    checksumSha256:
      "6657779e84649b83c50c69f74d770eb5d447d1aa0abff46424ca3617d5f476b5",
  }),
  Object.freeze({
    version: "0239",
    name: "build263_supervised_rental_sessions",
    checksumSha256:
      "3632b6b556c183fe09e75f0554775f9d0fde5a2337ea5f4602d468532e219344",
  }),
  Object.freeze({
    version: "0240",
    name: "build264_rental_allocation_pilot",
    checksumSha256:
      "7c2464f0b7c6fe4b6dd210cfe668bdd628d816e399851d0bd1b5f6a1e387398f",
  }),
]);

export function assessRentalMigrationReadback264({
  production,
  pinnedDatabaseHost,
  revision,
  readSucceeded,
  rows = [],
  tables = [],
}) {
  const blockers = [];
  if (!production)
    blockers.push("Current runtime is not authenticated Vercel Production.");
  if (!pinnedDatabaseHost)
    blockers.push(
      "Actual original database host does not match separately provisioned production pin.",
    );
  if (!/^[a-f0-9]{40}$/u.test(revision ?? ""))
    blockers.push("Exact deployed source revision is not available.");
  if (!readSucceeded)
    blockers.push(
      "Read-only original PostgreSQL catalogue and ledger inspection failed.",
    );
  for (const expected of RENTAL_MIGRATIONS264) {
    const matching = rows.filter((r) => String(r.version) === expected.version);
    if (
      matching.length !== 1 ||
      matching[0].name !== expected.name ||
      matching[0].checksum_sha256 !== expected.checksumSha256
    )
      blockers.push(
        "Original migration " +
          expected.version +
          " exact source ledger checksum was not matched.",
      );
  }
  for (const [name, trigger] of [
    ["rental_planning_offers", "rental_offer_guard"],
    ["rental_sessions263", "rental_session263_guard"],
    ["rental_allocations264", "rental_allocation264_guard"],
    ["rental_pilot_reviews264", "rental_pilot264_guard"],
  ]) {
    const x = tables.find((t) => t.name === name);
    if (
      !x ||
      x.forceRls !== true ||
      x.guardPresent !== true ||
      x.appDirectGrants === true ||
      x.guardName !== trigger
    )
      blockers.push(
        "Original protected schema / guard / RLS not verified: " + name + ".",
      );
  }
  return {
    status: blockers.length
      ? "HOLD_PRODUCTION_RENTAL_MIGRATION_CERTIFICATION"
      : "LIVE_PINNED_SOURCE_LEDGER_SCHEMA_MATCH",
    sourceReadbackMatched: blockers.length === 0,
    independentHostCustodyCertified: false,
    signedExternalWitnessConfirmed: false,
    financesActivated: false,
    allocationsOperationallyProven: false,
    blockers,
    checkedVersions: RENTAL_MIGRATIONS264.map((x) => x.version),
  };
}
