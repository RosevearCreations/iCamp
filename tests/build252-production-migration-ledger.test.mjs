import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import test from "node:test";

import {
  BUILD252_MIGRATIONS,
  assessBuild252MigrationHistory,
  planBuild252Remediation,
} from "../lib/release/build252-migration-ledger-core.mjs";
import { STANDARD_THEME } from "../lib/theme/standard.mjs";

const rev = "a".repeat(40);
const records = BUILD252_MIGRATIONS.map(({ version, name }) => ({
  version,
  name,
  checksum_sha256: "b".repeat(64),
}));
const good = {
  sourceRevision: rev,
  targetIndependentlyPinned: true,
  querySucceeded: true,
  ledgerExists: true,
  records,
};
const database = {
  runtimeTargetPinMatches: true,
  schemaVerified: true,
  checklist: [
    {
      name: "service_fulfillment_owner_ceremony_reviews",
      present: true,
      rowLevelSecurity: true,
      forceRowLevelSecurity: true,
      ownerOnlyPolicies: true,
      appendOnly: true,
      hasGuardTrigger: true,
    },
  ],
};
const read = (path) =>
  readFileSync(new URL("../" + path, import.meta.url), "utf8");

test("Build 252 never upgrades migration-history rows to verified canonical source", () => {
  const result = assessBuild252MigrationHistory(good);
  assert.equal(
    result.status,
    "MIGRATION_HISTORY_OBSERVED_SOURCE_CHECKSUM_NOT_ATTESTED",
  );
  assert.equal(result.ledgerEvidenceObserved, true);
  assert.equal(result.sourceChecksumIndependentlyVerified, false);
  assert.equal(result.productionMigrationApproved, false);
  assert.equal(result.ownerProductionAcceptance, "HOLD");
  assert.equal(result.details.length, 3);
  assert.equal(result.details.every((row) => row.recordPresent), true);
  assert.equal(
    result.details.every((row) => row.sourceChecksumIndependentlyVerified === false),
    true,
  );
  assert.equal(JSON.stringify(result).includes("b".repeat(64)), false);
});

test("Build 252 fails closed for unpinned, unreachable, incomplete, or malformed lineage", () => {
  assert.equal(
    assessBuild252MigrationHistory({
      ...good,
      targetIndependentlyPinned: false,
    }).status,
    "HOLD_DATABASE_TARGET_NOT_INDEPENDENTLY_PINNED",
  );
  assert.equal(
    assessBuild252MigrationHistory({
      ...good,
      querySucceeded: false,
    }).status,
    "HOLD_MIGRATION_HISTORY_READBACK_FAILED",
  );
  assert.equal(
    assessBuild252MigrationHistory({
      ...good,
      ledgerExists: false,
    }).status,
    "HOLD_MIGRATION_HISTORY_TABLE_MISSING",
  );
  assert.equal(
    assessBuild252MigrationHistory({
      ...good,
      records: records.slice(0, 2),
    }).status,
    "HOLD_MIGRATION_HISTORY_INCOMPLETE",
  );
  assert.equal(
    assessBuild252MigrationHistory({
      ...good,
      records: [{ ...records[0], name: "incorrect_name" }, ...records.slice(1)],
    }).status,
    "HOLD_MIGRATION_HISTORY_RECORD_INVALID",
  );
  assert.equal(
    assessBuild252MigrationHistory({
      ...good,
      records: [
        { ...records[0], checksum_sha256: "not-a-digest" },
        ...records.slice(1),
      ],
    }).status,
    "HOLD_MIGRATION_HISTORY_RECORD_INVALID",
  );
  assert.equal(
    assessBuild252MigrationHistory({
      ...good,
      sourceRevision: "local",
    }).status,
    "HOLD_EXACT_SOURCE_REVISION_UNAVAILABLE",
  );
});

test("Build 252 owner action plan is scoped, no auto-migrations or signer enrolment", () => {
  const history = assessBuild252MigrationHistory(good);
  const complete = planBuild252Remediation({
    database,
    signer: { independentReviewerAttested: false },
    migrationHistory: history,
  });
  assert.equal(complete.masterConnected, false);
  assert.equal(complete.databaseMigrationMutationAttempted, false);
  assert.equal(complete.signerProvisioned, false);
  assert.equal(complete.ownerProductionAcceptance, "HOLD");
  assert.ok(complete.items.some((x) => x.id === "TARGET_IDENTITY"));
  assert.ok(
    complete.items.some((x) => x.id === "MIGRATION_CHECKSUM_PROVENANCE"),
  );
  assert.ok(complete.items.some((x) => x.id === "ORIGINAL_SOURCE_CUSTODY"));
  assert.ok(complete.items.some((x) => x.id === "MEADOW_ORBIT_MANUAL_REVIEW"));
  assert.ok(complete.items.some((x) => x.id === "OWNER_CONTROL_PLANE_APPROVAL"));

  const incomplete = planBuild252Remediation({
    database: {
      runtimeTargetPinMatches: false,
      schemaVerified: false,
      checklist: [{ ...database.checklist[0], forceRowLevelSecurity: false }],
    },
    signer: { independentReviewerAttested: true },
    migrationHistory: null,
  });
  assert.ok(incomplete.items.some((x) => x.id.startsWith("SCHEMA_")));
  assert.ok(
    incomplete.items.some((x) => x.id === "TARGET_IDENTITY" && x.status === "HOLD"),
  );
  assert.equal(incomplete.masterConnected, false);
});

test("Build 252 private source-only query retains Sysop gate, safe output, Meadow assets", () => {
  const sql = read("lib/release/build252-migration-ledger-postgres.mjs");
  const page = read("app/sysop/migration-audit/page.tsx");
  const shell = read("app/sysop/page.tsx");
  assert.match(sql, /begin read only/u);
  assert.match(sql, /targetIndependentlyPinned/u);
  assert.match(sql, /icamp_meta\.schema_migrations/u);
  assert.match(sql, /where version=any\(\$1::text\[\]\)/u);
  assert.doesNotMatch(sql, /client\.query\("(?:insert|update|delete|alter|create)/iu);
  assert.match(page, /requireSysop\("\/sysop"\)/u);
  assert.match(page, /Production acceptance: HOLD/u);
  assert.match(page, /sourceChecksumIndependentlyVerified|Not independently verified/u);
  assert.match(shell, /\/sysop\/migration-audit/u);
  assert.equal(STANDARD_THEME.style, "Meadow & evergreen");
  assert.ok(
    existsSync(
      new URL("../public/themes/standard/meadow-hero.webp", import.meta.url),
    ),
  );
});
