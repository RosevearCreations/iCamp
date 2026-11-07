import { lstat, readFile, realpath, writeFile } from "node:fs/promises";
import { dirname, isAbsolute, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";
import {
  readExternalRegistrationLedger,
  verifyRegistrationLedger,
} from "./build214-owner-custody-register.mjs";
import { triageCustodianRenewals } from "./build215-independent-anchor-triage.mjs";
import {
  verifyRotationHistory,
  verifyOwnerRenewal,
  buildExpiryTimeline,
} from "./build216-checkpoint-renewal-timeline.mjs";

const ROOT = resolve(fileURLToPath(new URL("..", import.meta.url)));
const DAY = 86_400_000;
const HASH = /^sha256:[0-9a-f]{64}$/;

const deadline = (value) => {
  const time = Date.parse(value ?? "");
  if (!Number.isFinite(time) || new Date(time).toISOString() !== value)
    throw new Error("INVALID_CUSTODY_SLA_DEADLINE");
  return time;
};

export function analyzeAnchorDiversity({
  ledger,
  rotations,
  pins,
  expectedTail,
  now = Date.now(),
}) {
  if (!HASH.test(expectedTail ?? "") && expectedTail !== "GENESIS")
    throw new Error("INDEPENDENT_ANCHOR_TAIL_PIN_REQUIRED");
  const verified = verifyRotationHistory({
    ledger,
    records: rotations,
    pins,
    expectedTail,
    now,
  });
  const current = rotations.filter(
    (record) =>
      record.claims.sequence === ledger.length &&
      deadline(record.claims.expiresAt) > now,
  );
  const byKeyId = new Map();
  for (const record of current) {
    const keyId = record.claims.keyId;
    const pin = pins.signers.find((row) => row.keyId === keyId);
    const existing = byKeyId.get(keyId);
    if (existing && existing !== pin.fingerprint)
      throw new Error("REVIEWER_KEY_ID_WAS_REBOUND");
    byKeyId.set(keyId, pin.fingerprint);
  }
  const fingerprints = [...new Set(byKeyId.values())];
  const reusedFingerprint = fingerprints.length < byKeyId.size;
  const activeArchiveEntries = ledger.filter(
    (entry) =>
      entry.kind === "VERIFIED_ARCHIVE_COPY" && deadline(entry.expiresAt) > now,
  );
  const archiveKeys = new Set(
    activeArchiveEntries.map((entry) => entry.signerKeyId),
  );
  const archiveStorage = new Set(
    activeArchiveEntries.map((entry) => entry.storageReference),
  );
  const archiveTriage = triageCustodianRenewals(ledger, now);
  const overlappingSignerIds = [...byKeyId.keys()].filter((id) =>
    archiveKeys.has(id),
  );
  const state = !current.length
    ? "NO_CURRENT_SIGNED_LEDGER_HEAD_HOLD"
    : archiveTriage.conflictsQuarantined > 0
      ? "ARCHIVE_CUSTODIAN_OR_SOURCE_CONFLICT_HOLD"
      : reusedFingerprint
        ? "CROSS_CUSTODIAN_REVIEWER_KEY_REUSE_CONFLICT"
        : overlappingSignerIds.length
          ? "CUSTODY_AND_REVIEWER_ROLE_OVERLAP_HOLD"
          : fingerprints.length < 2
            ? "SECOND_INDEPENDENT_REVIEWER_KEY_REQUIRED"
            : "DISTINCT_REVIEWER_KEYS_HUMAN_INDEPENDENCE_UNPROVEN";
  return {
    schema: "icamp.build217.cross-custodian-anchor-diversity.v1",
    state,
    verifiedRotationHistory: verified.state,
    externallyPinnedTailMatched: verified.externallyPinnedTailMatched,
    currentHeadAnchors: current.length,
    distinctCurrentReviewerKeyIds: byKeyId.size,
    distinctCurrentReviewerPublicKeys: fingerprints.length,
    distinctCurrentArchiveSignerKeys: archiveKeys.size,
    distinctCurrentArchiveStorageReferences: archiveStorage.size,
    sharedReviewerKeyMaterialDetected: reusedFingerprint,
    sameReviewerAndArchiveKeyIdDetected: overlappingSignerIds.length > 0,
    archiveGroupsRequiringReview: archiveTriage.reviewRequired,
    archiveSourceConflictsQuarantined: archiveTriage.conflictsQuarantined,
    independentlyAuthenticatedHumansVerified: false,
    independentlyDurableStorageVerified: false,
    automaticallyApproved: false,
    commsTestAuthorized: false,
  };
}

export function reconcileOwnerRenewalOutcomes({
  ledger,
  receipts,
  pins,
  now = Date.now(),
}) {
  verifyRegistrationLedger(ledger, { now });
  if (!Array.isArray(receipts))
    throw new Error("OWNER_RENEWAL_RECEIPTS_MUST_BE_AN_ARRAY");
  const consumedNonces = new Set();
  const bySequence = new Map();
  for (const receipt of receipts) {
    const created = deadline(receipt?.request?.createdAt);
    const expires = deadline(receipt?.request?.expiresAt);
    if (created > now + 60_000 || expires <= created)
      throw new Error("OWNER_RENEWAL_TIMESTAMP_CONFLICT");
    // Expired decisions can be authenticated historically, never as current consent.
    const verificationTime =
      expires <= now ? Math.max(created, expires - 1000) : now;
    const checked = verifyOwnerRenewal(receipt, ledger, pins, {
      now: verificationTime,
      consumedNonces,
    });
    const item = {
      keyId: receipt.request.keyId,
      choice: checked.choice,
      expiresAt: receipt.request.expiresAt,
      current: expires > now,
    };
    const group = bySequence.get(checked.targetSequence) ?? {
      sequence: checked.targetSequence,
      entryHash: checked.targetEntryHash,
      receipts: [],
    };
    if (group.entryHash !== checked.targetEntryHash)
      throw new Error("OWNER_RENEWAL_TARGET_HASH_CONFLICT");
    group.receipts.push(item);
    bySequence.set(checked.targetSequence, group);
  }
  const outcomes = [...bySequence.values()]
    .sort((a, b) => a.sequence - b.sequence)
    .map((group) => {
      const current = group.receipts.filter((receipt) => receipt.current);
      const choices = new Set(current.map((receipt) => receipt.choice));
      const state = !current.length
        ? "ALL_SIGNED_OWNER_CHOICES_EXPIRED_REVIEW"
        : choices.size > 1
          ? "CONFLICTING_SIGNED_OWNER_CHOICES_MANUAL_TRIAGE"
          : current.length > 1
            ? "MULTIPLE_CONSISTENT_OWNER_CHOICES_REVIEW"
            : "SINGLE_SIGNED_OWNER_CHOICE_REVIEW_ONLY";
      return {
        targetSequence: group.sequence,
        state,
        activeSignedChoices: current.length,
        expiredSignedChoices: group.receipts.length - current.length,
        distinctActiveOwnerKeyIds: new Set(
          current.map((receipt) => receipt.keyId),
        ).size,
        activeChoice: choices.size === 1 ? [...choices][0] : null,
        conflict: choices.size > 1,
        sourceRenewed: false,
        productionApproved: false,
      };
    });
  return {
    schema: "icamp.build217.owner-renewal-outcome-reconciliation.v1",
    state: outcomes.some((row) => row.conflict)
      ? "OWNER_DECISION_CONFLICTS_QUARANTINED"
      : outcomes.length
        ? "SIGNED_CHOICES_RECONCILED_REVIEW_ONLY"
        : "NO_INDEPENDENT_OWNER_DECISIONS_HOLD",
    outcomes,
    signedReceiptsReviewed: receipts.length,
    conflictingTargets: outcomes.filter((row) => row.conflict).length,
    actualSourceRetentionRenewed: false,
    ownerRealWorldIdentityEstablishedByTool: false,
    automaticChoiceSelection: false,
    commsTestAuthorized: false,
  };
}

export function summarizeRetentionDashboard({
  ledger,
  rotations,
  anchorPins,
  expectedTail,
  ownerReceipts,
  ownerPins,
  ciEvidence,
  now = Date.now(),
}) {
  const anchors = analyzeAnchorDiversity({
    ledger,
    rotations,
    pins: anchorPins,
    expectedTail,
    now,
  });
  const decisions = reconcileOwnerRenewalOutcomes({
    ledger,
    receipts: ownerReceipts,
    pins: ownerPins,
    now,
  });
  const timeline = buildExpiryTimeline({
    ledger,
    ciEvidence,
    rotations,
    now,
  });
  const buckets = {
    overdue: 0,
    due7Days: 0,
    due14Days: 0,
    later: 0,
    unknown: 0,
  };
  const rows = timeline.events.map((item) => {
    const expires = item.expiresAt ? deadline(item.expiresAt) : null;
    const days = expires === null ? null : Math.ceil((expires - now) / DAY);
    const urgency =
      days === null
        ? "unknown"
        : days <= 0
          ? "overdue"
          : days <= 7
            ? "due7Days"
            : days <= 14
              ? "due14Days"
              : "later";
    buckets[urgency]++;
    return {
      category: item.kind,
      urgency,
      expiresAt: item.expiresAt ?? null,
      state: item.state,
      sourceConflict: item.sourceMatch === false,
    };
  });
  const sourceConflicts = rows.filter((row) => row.sourceConflict).length;
  const reviewNeeded =
    buckets.overdue + buckets.due7Days + buckets.due14Days > 0 ||
    sourceConflicts > 0 ||
    decisions.conflictingTargets > 0 ||
    !timeline.historicalSourceSnapshotAvailable ||
    anchors.state !== "DISTINCT_REVIEWER_KEYS_HUMAN_INDEPENDENCE_UNPROVEN";
  return {
    schema: "icamp.build217.redacted-evidence-retention-sla-dashboard.v1",
    generatedAt: new Date(now).toISOString(),
    state: reviewNeeded
      ? "OWNER_REVIEW_OR_EXTERNAL_EVIDENCE_HOLD"
      : "MONITORING_ONLY_EXTERNAL_TRUST_UNVERIFIED",
    counts: {
      ...buckets,
      sourceConflicts,
      ownerChoiceConflicts: decisions.conflictingTargets,
      distinctReviewerKeys: anchors.distinctCurrentReviewerPublicKeys,
      signedOwnerChoices: decisions.signedReceiptsReviewed,
    },
    anchorState: anchors.state,
    ownerDecisionState: decisions.state,
    sourceState: timeline.state,
    rows,
    includesPrivateSignedReceipts: false,
    includesPrivateSignerKeys: false,
    includesSourceDigestsOrArchiveLocations: false,
    sourceMetadataIsHistoricalSnapshot: true,
    externalHumanAndStorageTrustProven: false,
    productionApprovalGranted: false,
    commsTestAuthorized: false,
  };
}

export function analyzeBuild217Ci(previous) {
  return {
    schema: "icamp.build217.custody-retention-dashboard-ci-handoff.v1",
    state: "PRIVATE_OWNER_AND_CUSTODIAN_DATA_EXCLUDED_FROM_CI",
    previousHandoff: previous?.state ?? null,
    privateSignerKeysImported: false,
    fakeOwnerDecisionsGenerated: false,
    protectedChecksAdded: 0,
    externalHumanOrStorageTrustProven: false,
    commsTestAuthorized: false,
  };
}

const escape = (value) =>
  String(value).replace(
    /[&<>"']/g,
    (char) =>
      ({
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&#39;",
      })[char],
  );

export function renderOfflineDashboard(report) {
  if (
    report?.schema !==
      "icamp.build217.redacted-evidence-retention-sla-dashboard.v1" ||
    report.includesPrivateSignedReceipts !== false ||
    report.includesPrivateSignerKeys !== false ||
    report.includesSourceDigestsOrArchiveLocations !== false
  )
    throw new Error("UNSAFE_OR_UNVERIFIED_RETENTION_REPORT");
  const c = report.counts;
  const metrics = [
    ["Overdue", c.overdue],
    ["Due within 7 days", c.due7Days],
    ["Due in 8–14 days", c.due14Days],
    ["Unknown deadline", c.unknown],
    ["Source conflicts", c.sourceConflicts],
    ["Owner choice conflicts", c.ownerChoiceConflicts],
    ["Distinct reviewer keys", c.distinctReviewerKeys],
    ["Signed owner choices", c.signedOwnerChoices],
  ];
  const cards = metrics
    .map(
      ([label, count]) =>
        `<article class="metric"><span>${escape(label)}</span><strong>${escape(count)}</strong></article>`,
    )
    .join("");
  const table = report.rows
    .map(
      (row) =>
        `<tr><td>${escape(row.category)}</td><td>${escape(row.urgency)}</td><td>${escape(row.expiresAt ?? "Not available")}</td><td>${escape(row.state)}</td></tr>`,
    )
    .join("");
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline'; base-uri 'none'; form-action 'none'"><title>iCamp 217 · Offline custody SLA</title><style>:root{color-scheme:dark;font-family:system-ui,Arial,sans-serif;background:#0d1525;color:#edf1fa}body{max-width:1150px;margin:auto;padding:2rem}h1{font-size:clamp(1.6rem,3vw,2.5rem)}.muted{color:#b4bfd2}.notice{background:#332918;border:1px solid #b88f44;padding:1rem;border-radius:12px}.grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(180px,1fr));gap:.8rem;margin:1.5rem 0}.metric{border:1px solid #344663;background:#16243a;padding:1rem;border-radius:12px}.metric span{display:block;color:#bbc9dc}.metric strong{font-size:2rem}table{width:100%;border-collapse:collapse}th,td{padding:.7rem;text-align:left;border-bottom:1px solid #344663;overflow-wrap:anywhere}th{color:#c5d8ff}main{overflow-x:auto}</style></head><body><header><p class="muted">iCamp · Build 217 · Generated ${escape(report.generatedAt)}</p><h1>Evidence retention SLA · offline review</h1><p class="notice">${escape(report.state)}. Signing keys, private receipts, source digests and storage locations are excluded. Original source readback and human independence are NOT established by this report. No owner approval or Comms TEST activation.</p></header><section class="grid" aria-label="Retention and signature review counts">${cards}</section><p>Anchor review: <strong>${escape(report.anchorState)}</strong></p><p>Owner decisions: <strong>${escape(report.ownerDecisionState)}</strong></p><p>Original source: <strong>${escape(report.sourceState)}</strong></p><main><table><caption>Evidence deadlines and explicit review state</caption><thead><tr><th scope="col">Category</th><th scope="col">Window</th><th scope="col">Expiry (UTC)</th><th scope="col">Review state</th></tr></thead><tbody>${table || '<tr><td colspan="4">No external evidence available; HOLD</td></tr>'}</tbody></table></main><p class="muted">This is an offline redacted snapshot, not a live custody provider or GitHub API connection.</p></body></html>`;
}

async function external(path) {
  if (
    !isAbsolute(path) ||
    resolve(path) === ROOT ||
    resolve(path).startsWith(`${ROOT}${sep}`)
  )
    throw new Error("PRIVATE_CUSTODY_PATH_MUST_BE_EXTERNAL");
  const parent = await realpath(dirname(resolve(path)));
  if (parent === ROOT || parent.startsWith(`${ROOT}${sep}`))
    throw new Error("PRIVATE_CUSTODY_PATH_MUST_BE_EXTERNAL");
  try {
    if (!(await lstat(path)).isFile())
      throw new Error("PRIVATE_CUSTODY_SYMLINK_REFUSED");
  } catch (error) {
    if (error?.code !== "ENOENT") throw error;
  }
}

async function readExternalJson(path) {
  await external(path);
  const raw = await readFile(path, "utf8");
  if (raw.length > 2_000_000)
    throw new Error("OVERSIZED_PRIVATE_CUSTODY_INPUT");
  return JSON.parse(raw);
}

async function readExternalRotations(path) {
  await external(path);
  const raw = await readFile(path, "utf8");
  if (raw.length > 2_000_000 || (raw && !raw.endsWith("\n")))
    throw new Error("OVERSIZED_OR_PARTIAL_ROTATION_HISTORY");
  return raw.trim() ? raw.trimEnd().split("\n").map(JSON.parse) : [];
}

async function main(args) {
  if (
    args.length !== 10 ||
    args[0] !== "dashboard" ||
    args[9] !== "--confirm-offline-owner-review"
  )
    throw new Error(
      "USAGE: dashboard <external-ledger.jsonl> <external-rotation-history.jsonl> <reviewer-pins.json> <independently-pinned-tailHash-or-GENESIS> <owner-receipts.json-array> <owner-pins.json> <build205-ci-runtime-evidence.json> <output.html> --confirm-offline-owner-review",
    );
  const [
    ,
    ledgerPath,
    rotationsPath,
    anchorPinsPath,
    expectedTail,
    receiptsPath,
    ownerPinsPath,
    evidencePath,
    outputPath,
  ] = args;
  await external(outputPath);
  const [ledger, rotations, anchorPins, ownerReceipts, ownerPins, ciEvidence] =
    await Promise.all([
      readExternalRegistrationLedger(ledgerPath),
      readExternalRotations(rotationsPath),
      readExternalJson(anchorPinsPath),
      readExternalJson(receiptsPath),
      readExternalJson(ownerPinsPath),
      readExternalJson(evidencePath),
    ]);
  const report = summarizeRetentionDashboard({
    ledger,
    rotations,
    anchorPins,
    expectedTail,
    ownerReceipts,
    ownerPins,
    ciEvidence,
  });
  await writeFile(outputPath, renderOfflineDashboard(report), {
    mode: 0o600,
    flag: "wx",
  });
  console.log(
    JSON.stringify({
      schema: report.schema,
      state: report.state,
      counts: report.counts,
      output: "LOCAL_OFFLINE_REDACTED_DASHBOARD_CREATED",
      noExternalSourceOrOwnerTrustGranted: true,
    }),
  );
}

if (
  process.argv[1] &&
  resolve(process.argv[1]) === fileURLToPath(import.meta.url)
) {
  main(process.argv.slice(2)).catch((error) => {
    console.error(
      error instanceof Error ? error.message : "BUILD217_OFFLINE_REVIEW_FAILED",
    );
    process.exitCode = 1;
  });
}
