import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("Build 013 defines private channel verification persistence without raw secret columns", async () => {
  const migration = await readFile(
    "database/migrations/0017_channel_identity_verification.sql",
    "utf8",
  );

  for (const table of [
    "staff_channel_pin_credentials",
    "channel_verification_challenges",
    "channel_verification_attempts",
  ]) {
    assert.match(
      migration,
      new RegExp("create table icamp_private\\\\." + table),
    );
  }

  assert.match(migration, /subject_reference_hash text/u);
  assert.match(migration, /code_hash text/u);
  assert.match(migration, /pin_hash text/u);
  assert.doesNotMatch(
    migration,
    /^\s*(pin|raw_pin|verification_code|raw_code|subject_reference|phone_number|caller_id|message_body)\s+/imu,
  );
  assert.match(
    migration,
    /revoke all on icamp_private\.channel_verification_challenges from public/u,
  );
});

test("Build 013 uses salted verifiers for guest references, OTPs and staff PINs", async () => {
  const core = await readFile("lib/verification/core.mjs", "utf8");

  assert.match(core, /hashPassword/u);
  assert.match(core, /verifyPassword/u);
  assert.match(core, /subject:/u);
  assert.match(core, /verification:/u);
  assert.match(core, /staff-pin:/u);
  assert.doesNotMatch(core, /createHash\("sha256"\)/u);
});

test("Build 013 enforces risk-based staff re-authentication and permission re-checking", async () => {
  const runtime = await readFile("lib/verification/postgres.mjs", "utf8");

  assert.match(runtime, /assertRecentReauthentication/u);
  assert.match(runtime, /assertPrivilegedActionControl/u);
  assert.match(runtime, /hasCampgroundPermission/u);
  assert.match(runtime, /assurance_level = 'aal2'/u);
  assert.match(runtime, /staff_privileged/u);
  assert.match(runtime, /callerOrSenderHintIsAuthentication: false/u);
  assert.match(runtime, /rawSecretsExcluded: true/u);
});

test("Build 013 gates voice and SMS protected lookup intents behind identity verification", async () => {
  const voiceWebhook = await readFile(
    "app/api/communications/voice/webhook/route.ts",
    "utf8",
  );
  const messagingWebhook = await readFile(
    "app/api/communications/messaging/webhook/route.ts",
    "utf8",
  );

  assert.match(voiceWebhook, /result\.dtmf\?\.transientEntry/u);
  assert.match(voiceWebhook, /"verify\.identity"/u);
  assert.match(voiceWebhook, /verificationRequired/u);
  assert.doesNotMatch(voiceWebhook, /transientEntry\?\.value/u);
  assert.match(messagingWebhook, /"verify\.identity"/u);
  assert.doesNotMatch(messagingWebhook, /command\.value/u);
});

test("Build 013 lifecycle proof is part of the database CI gate", async () => {
  const workflow = await readFile(".github/workflows/ci.yml", "utf8");
  const packageJson = await readFile("package.json", "utf8");
  const lifecycle = await readFile(
    "scripts/verify-channel-verification-lifecycle.mjs",
    "utf8",
  );

  assert.match(
    workflow,
    /Verify telephone\/SMS identity and staff re-authentication lifecycle/u,
  );
  assert.match(workflow, /npm run identity:verify/u);
  assert.match(packageJson, /"identity:verify"/u);
  assert.match(lifecycle, /completeStaffChallengeWithRecentSession/u);
  assert.match(lifecycle, /assertChannelVerificationGrant/u);
  assert.match(lifecycle, /lockedRow/u);
  assert.match(lifecycle, /assert\.doesNotMatch\(storedText/u);
});

test("Build 013 exposes aggregate verification health without identities or secrets", async () => {
  const page = await readFile("app/workspaces/it-analysis/page.tsx", "utf8");
  const runtime = await readFile("lib/verification/postgres.mjs", "utf8");

  assert.match(page, /getChannelVerificationHealth/u);
  assert.match(page, /Caller ID is not authentication/u);
  assert.match(page, /PINs and verification codes are never displayed/u);
  assert.match(runtime, /rawSecretsExcluded: true/u);
  assert.match(runtime, /callerOrSenderHintIsAuthentication: false/u);
});

test("Build 013 source of truth preserves channel parity and no-secret-echo rules", async () => {
  const source = await readFile("docs/IDENTITY_VERIFICATION.md", "utf8");
  const build = await readFile("docs/BUILD_013.md", "utf8");
  const queue = await readFile("docs/BUILD_QUEUE.md", "utf8");

  assert.match(source, /routing hints only/u);
  assert.match(source, /salted scrypt verifier/u);
  assert.match(source, /No secret echo/u);
  assert.match(source, /Build 006 recent re-authentication/u);
  assert.match(build, /IMPLEMENTED — PROMOTION PENDING/u);
  assert.match(
    queue,
    /Build 013 — Telephone\/SMS Identity, Verification & Staff Re-Authentication[\s\S]*IMPLEMENTED — PROMOTION PENDING/u,
  );
  assert.match(
    build,
    /Build 014 — Messaging Consent, STOP\/START\/HELP & Preference Ledger/u,
  );
});
