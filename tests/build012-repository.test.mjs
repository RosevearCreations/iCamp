import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("Build 012 defines private SMS/MMS conversation, message and attachment evidence", async () => {
  const migration = await readFile(
    "database/migrations/0015_sms_mms_conversation_gateway.sql",
    "utf8",
  );

  for (const table of [
    "messaging_lines",
    "messaging_conversations",
    "messaging_messages",
    "messaging_attachments",
  ]) {
    assert.match(
      migration,
      new RegExp("create table icamp_private\\." + table),
    );
  }

  assert.match(migration, /messaging_conversations_active_unique/u);
  assert.match(migration, /messaging_messages_provider_reference_unique/u);
  assert.match(migration, /body_length between 0 and 1600/u);
  assert.doesNotMatch(
    migration,
    /messaging_messages[\s\S]{0,4000}\n\s*(body|message_body|raw_body|text)\s+text/iu,
  );
});

test("Build 012 command parser keeps natural language and identifier lookups validation-gated", async () => {
  const commands = await readFile("lib/messaging/commands.mjs", "utf8");

  assert.match(commands, /menu\.site/u);
  assert.match(commands, /lookup\.reservation/u);
  assert.match(commands, /source: "natural_language"/u);
  assert.match(commands, /state: "verification_required"/u);
  assert.match(commands, /state: "validation_required"/u);
  assert.match(commands, /rawTextExcluded: true/u);
});

test("Build 012 signed webhook never returns entered identifiers", async () => {
  const webhook = await readFile(
    "app/api/communications/messaging/webhook/route.ts",
    "utf8",
  );
  const provider = await readFile("lib/messaging/provider.mjs", "utf8");

  assert.match(webhook, /x-icamp-messaging-timestamp/u);
  assert.match(webhook, /x-icamp-messaging-signature/u);
  assert.match(webhook, /verifyMessagingWebhookSignature/u);
  assert.match(webhook, /verify\.identity/u);
  assert.doesNotMatch(webhook, /command\.value/u);
  assert.match(provider, /createHmac\("sha256"/u);
  assert.match(provider, /timingSafeEqual/u);
});

test("Build 012 persists only safe provider metadata and gated MMS intake", async () => {
  const runtime = await readFile("lib/messaging/postgres.mjs", "utf8");

  assert.match(runtime, /messageBodyExcluded: true/u);
  assert.match(runtime, /rawBodyExcluded: true/u);
  assert.match(runtime, /providerPayloadExcluded: true/u);
  assert.match(runtime, /'pending_scan'/u);
  assert.match(runtime, /communications\.send/u);
  assert.match(runtime, /communications\.manage/u);
  assert.match(
    runtime,
    /on conflict \(provider_key, provider_event_id\) do nothing/u,
  );
});

test("Build 012 lifecycle proof is part of the database CI gate", async () => {
  const workflow = await readFile(".github/workflows/ci.yml", "utf8");
  const lifecycle = await readFile(
    "scripts/verify-messaging-lifecycle.mjs",
    "utf8",
  );

  assert.match(workflow, /Verify SMS\/MMS conversation and command lifecycle/u);
  assert.match(workflow, /npm run messaging:verify/u);
  assert.match(lifecycle, /inboundDuplicate\.duplicate, true/u);
  assert.match(lifecycle, /7654321/u);
  assert.match(lifecycle, /assert\.doesNotMatch\(providerText/u);
  assert.match(lifecycle, /validation_required/u);
  assert.match(lifecycle, /verification_required/u);
});

test("Build 012 exposes sanitized messaging health and source-of-truth documentation", async () => {
  const itPage = await readFile("app/workspaces/it-analysis/page.tsx", "utf8");
  const source = await readFile("docs/SMS_MMS.md", "utf8");
  const build = await readFile("docs/BUILD_012.md", "utf8");

  assert.match(itPage, /getMessagingGatewayHealth/u);
  assert.match(itPage, /Message bodies and phone numbers remain private/u);
  assert.match(
    source,
    /Phone-number possession, caller ID and SMS sender address are never treated as authentication/u,
  );
  assert.match(
    source,
    /Build 013 — Telephone\/SMS Identity, Verification & Staff Re-Authentication/u,
  );
  assert.match(build, /IMPLEMENTED — PROMOTION PENDING/u);
});

test("Build 012 closes advisor findings for composite messaging foreign keys", async () => {
  const indexes = await readFile(
    "database/migrations/0016_messaging_fk_indexes.sql",
    "utf8",
  );

  for (const indexName of [
    "messaging_lines_endpoint_scope_idx",
    "messaging_conversations_line_scope_idx",
    "messaging_conversations_remote_endpoint_scope_idx",
    "messaging_messages_conversation_scope_idx",
  ]) {
    assert.match(indexes, new RegExp("create index " + indexName));
  }
});
