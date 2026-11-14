/** Build 252 protects the distinction between a recorded migration,
 * its source-integrity verification and actual production approval. */
const REV = /^[a-f0-9]{40}$/u;
const DIGEST = /^[a-f0-9]{64}$/u;

export const BUILD252_MIGRATIONS = Object.freeze([
  Object.freeze({
    version: "0231",
    name: "build247_device_calibration_dossier_continuity",
    feature: "Build 247 original device signature",
  }),
  Object.freeze({
    version: "0232",
    name: "build249_original_device_witness",
    feature: "Build 249 original device witness",
  }),
  Object.freeze({
    version: "0233",
    name: "build250_owner_supervised_ceremony",
    feature: "Build 250 append-only owner decisions",
  }),
]);

export function assessBuild252MigrationHistory({
  sourceRevision,
  targetIndependentlyPinned,
  querySucceeded,
  ledgerExists,
  records,
}) {
  const details = BUILD252_MIGRATIONS.map((expected) => {
    const found = Array.isArray(records)
      ? records.find((record) => record?.version === expected.version)
      : null;
    const recordPresent = Boolean(found);
    const versionMatches = found?.name === expected.name;
    const recordedChecksumWellFormed = DIGEST.test(
      String(found?.checksum_sha256 ?? ""),
    );
    return {
      version: expected.version,
      feature: expected.feature,
      recordPresent,
      versionMatches,
      recordedChecksumWellFormed,
      sourceChecksumIndependentlyVerified: false,
    };
  });
  let status = "HOLD_RUNTIME_MIGRATION_HISTORY_UNAVAILABLE";
  if (!targetIndependentlyPinned)
    status = "HOLD_DATABASE_TARGET_NOT_INDEPENDENTLY_PINNED";
  else if (!querySucceeded) status = "HOLD_MIGRATION_HISTORY_READBACK_FAILED";
  else if (!ledgerExists) status = "HOLD_MIGRATION_HISTORY_TABLE_MISSING";
  else if (details.some((row) => !row.recordPresent))
    status = "HOLD_MIGRATION_HISTORY_INCOMPLETE";
  else if (
    details.some(
      (row) => !row.versionMatches || !row.recordedChecksumWellFormed,
    )
  )
    status = "HOLD_MIGRATION_HISTORY_RECORD_INVALID";
  else if (!REV.test(String(sourceRevision ?? "")))
    status = "HOLD_EXACT_SOURCE_REVISION_UNAVAILABLE";
  else status = "MIGRATION_HISTORY_OBSERVED_SOURCE_CHECKSUM_NOT_ATTESTED";
  return {
    status,
    details,
    ledgerEvidenceObserved:
      status === "MIGRATION_HISTORY_OBSERVED_SOURCE_CHECKSUM_NOT_ATTESTED",
    sourceChecksumIndependentlyVerified: false,
    productionMigrationApproved: false,
    ownerProductionAcceptance: "HOLD",
  };
}

export function planBuild252Remediation({
  database,
  signer,
  migrationHistory,
}) {
  const items = [];
  const add = (id, status, owner, action) =>
    items.push({ id, status, owner, action });

  if (!database?.runtimeTargetPinMatches) {
    add(
      "TARGET_IDENTITY",
      "HOLD",
      "Production database custodian",
      "Independently authenticate the active Vercel DATABASE_URL hostname; record that exact hostname in ICAMP_EXPECTED_PRODUCTION_DATABASE_HOST (Vercel Production). Do not substitute a Supabase project merely because its name is iCamp.",
    );
  } else {
    add(
      "TARGET_IDENTITY",
      "OBSERVED",
      "Production database custodian",
      "Confirm the hostname pin was independently approved and that a restorable backup exists before any migration.",
    );
  }

  for (const row of database?.checklist ?? []) {
    if (
      !row.present ||
      !row.rowLevelSecurity ||
      !row.forceRowLevelSecurity ||
      !row.ownerOnlyPolicies ||
      !row.appendOnly ||
      !row.hasGuardTrigger
    ) {
      add(
        "SCHEMA_" + row.name.toUpperCase(),
        "HOLD",
        "Database migration operator",
        "Investigate missing or incorrect " +
          row.name +
          " on the verified active database. Review canonical GitHub migration and RLS policy; never copy an unreviewed table or run migrations against an unverified target.",
      );
    }
  }
  if (database?.schemaVerified && migrationHistory?.ledgerEvidenceObserved) {
    add(
      "MIGRATION_CHECKSUM_PROVENANCE",
      "HOLD",
      "Independent database reviewer",
      "Compare each recorded SHA-256 against the exact canonical SQL bytes in the protected GitHub release and independently record the source match. This readback alone does not attest checksum equality.",
    );
  } else {
    add(
      "MIGRATION_CHECKSUM_PROVENANCE",
      "HOLD",
      "Database migration operator",
      "Inspect icamp_meta.schema_migrations on the authenticated active database; reconcile Build 247/249/250 entries, and back up before applying any approved missing migration.",
    );
  }
  if (!signer?.independentReviewerAttested) {
    add(
      "ORIGINAL_SOURCE_CUSTODY",
      "HOLD",
      "Distinct source and reviewer custodians",
      "Authenticate separate Ed25519 public fingerprints, sign the current exact-SHA custody receipt outside the app, and enroll protected original/reviewer settings only after actual custody review. Do not generate test signatures for production.",
    );
  } else {
    add(
      "ORIGINAL_SOURCE_CUSTODY",
      "OBSERVED_SOURCE_ONLY",
      "Independent source reviewer",
      "Confirm current original signed SOURCE_HEALTHY and separately verify all three Master receipts; custody observation alone is not operational acceptance.",
    );
  }
  add(
    "MEADOW_ORBIT_MANUAL_REVIEW",
    "MANUAL",
    "Campground reviewer",
    "Review Standard / Meadow and Orbit Command on desktop, tablet and phone using /settings/themes/cross-device. Imported browser reports are self-reported, not independently authenticated devices.",
  );
  add(
    "OWNER_CONTROL_PLANE_APPROVAL",
    "HOLD",
    "Actual authorized owner",
    "Do not enable receiver ON, private Comms access, Master CONNECTED or operational owner acceptance without a fresh, independent, separately authorized ceremony.",
  );
  return {
    status: "OPERATOR_ACTIONS_PREPARED_NO_AUTOMATIC_APPROVAL",
    items,
    databaseMigrationMutationAttempted: false,
    signerProvisioned: false,
    masterConnected: false,
    ownerProductionAcceptance: "HOLD",
  };
}
