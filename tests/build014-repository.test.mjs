import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("Build 014 defines private compliance, current-state and append-only preference-ledger persistence", async () => {
  const migration = await readFile(
    "database/migrations/0018_messaging_consent_preference_ledger.sql",
    "utf8",
  );

  for (const table of [
    "communication_compliance_rules",
    "messaging_preference_state",
    "messaging_preference_events",
  ]) {
    assert.match(
      migration,
      new RegExp("create table icamp_private\\." + table),
    );
  }

  assert.match(migration, /messaging_preference_events_append_only/u);
  assert.match(migration, /messaging_preference_events_provider_unique/u);
  assert.doesNotMatch(
    migration,
    /^\s*(phone_number|endpoint_value|message_body|raw_body|raw_message|message_text)\s+/imu,
  );
});

test("Build 014 treats STOP as transport suppression and START as non-marketing restoration by default", async () => {
  const core = await readFile("lib/consent/core.mjs", "utf8");

  assert.match(core, /STOP_KEYWORDS/u);
  assert.match(core, /providerSuppressed: Boolean\(rule\.stopSuppressesAll\)/u);
  assert.match(core, /startGrantsMarketingConsent/u);
  assert.match(core, /marketingConsent: rule\.startGrantsMarketingConsent/u);
  assert.match(core, /jurisdictionCode: "CA"/u);
});

test("Build 014 enforces messaging consent before provider dispatch and synchronizes inbound provider keywords", async () => {
  const runtime = await readFile("lib/messaging/postgres.mjs", "utf8");

  assert.match(runtime, /assertMessagingDispatchAllowed/u);
  assert.match(runtime, /classifyMessagingConsentKeyword/u);
  assert.match(runtime, /applyMessagingPreferenceKeywordInTransaction/u);
  assert.match(runtime, /consent\." \+ preferenceKeyword\.action/u);
});

test("Build 014 lifecycle proof is part of the database CI gate", async () => {
  const workflow = await readFile(".github/workflows/ci.yml", "utf8");
  const packageJson = await readFile("package.json", "utf8");
  const lifecycle = await readFile(
    "scripts/verify-messaging-consent-lifecycle.mjs",
    "utf8",
  );

  assert.match(
    workflow,
    /Verify messaging consent, STOP\/START\/HELP and preference ledger lifecycle/u,
  );
  assert.match(workflow, /npm run consent:verify/u);
  assert.match(packageJson, /"consent:verify"/u);
  assert.match(lifecycle, /provider_suppressed/u);
  assert.match(lifecycle, /preference_disabled\|marketing_consent_required/u);
  assert.match(lifecycle, /recordMessagingMarketingConsent/u);
});

test("Build 014 keeps consent evidence purpose-specific and privacy-safe", async () => {
  const runtime = await readFile("lib/consent/postgres.mjs", "utf8");

  assert.match(runtime, /purpose: "marketing"/u);
  assert.match(runtime, /communication_consents/u);
  assert.match(runtime, /communication_preferences/u);
  assert.match(runtime, /rawMessageExcluded: true/u);
  assert.match(runtime, /endpointValueExcluded: true/u);
  assert.doesNotMatch(runtime, /select\s+endpoint_value/iu);
});

test("Build 014 closes compliance-rule foreign-key index advisories", async () => {
  const migration = await readFile(
    "database/migrations/0019_communication_compliance_fk_indexes.sql",
    "utf8",
  );

  assert.match(migration, /communication_compliance_rules_scope_idx/u);
  assert.match(migration, /organization_id,[\s\S]*campground_id/u);
});

test("Build 014 source of truth records production GREEN and advances Build 015", async () => {
  const build = await readFile("docs/BUILD_014.md", "utf8");
  const queue = await readFile("docs/BUILD_QUEUE.md", "utf8");

  assert.match(build, /FULLY PROMOTED — `main` GREEN/u);
  assert.match(build, /328c5939d506953a19d248a9b2a042b9ad621bef/u);
  assert.match(build, /37706200147/u);
  assert.match(
    build,
    /20261007234014 \/ 0018_messaging_consent_preference_ledger/u,
  );
  assert.match(
    build,
    /20261007234624 \/ 0019_communication_compliance_fk_indexes/u,
  );
  assert.match(
    queue,
    /Build 014 — Messaging Consent, STOP\/START\/HELP & Preference Ledger[\s\S]*FULLY PROMOTED — `main` GREEN/u,
  );
  assert.match(queue, /Build 015 — Telephone\/SMS Workflow Parity Harness/u);
});
