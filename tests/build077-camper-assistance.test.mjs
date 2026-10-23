import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

import {
  CAMPER_ASSISTANCE_CATEGORIES,
  CAMPER_ASSISTANCE_CONTACT_PREFERENCES,
  CAMPER_ASSISTANCE_SEVERITIES,
  camperAssistanceFingerprint,
  normalizeCamperAssistanceClientRequestId,
  normalizeCamperAssistanceInput,
} from "../lib/camper-assistance/core.mjs";

const REQUEST_ID = "11111111-1111-4111-8111-111111111111";
const RESERVATION_ID = "22222222-2222-4222-8222-222222222222";

test("Build 077 normalizes the canonical assistance intake vocabulary", () => {
  assert.deepEqual(CAMPER_ASSISTANCE_CATEGORIES, [
    "maintenance",
    "garbage",
    "septic",
    "electrical",
    "water",
    "wifi",
    "noise",
    "security",
    "rental",
    "store",
    "other",
  ]);
  assert.deepEqual(CAMPER_ASSISTANCE_SEVERITIES, ["routine", "soon", "urgent"]);
  assert.deepEqual(CAMPER_ASSISTANCE_CONTACT_PREFERENCES, [
    "in_app",
    "email",
    "sms",
    "phone",
    "none",
  ]);

  const normalized = normalizeCamperAssistanceInput({
    category: "wifi",
    severity: "soon",
    summary: "Wi-Fi is unavailable at our site",
    details: "The network is visible but will not connect.",
    contactPreference: "sms",
  });
  assert.equal(normalized.category, "wifi");
  assert.equal(normalized.severity, "soon");
  assert.equal(normalized.contactPreference, "sms");
});

test("Build 077 request UUIDs and fingerprints are deterministic and payload-sensitive", () => {
  assert.equal(
    normalizeCamperAssistanceClientRequestId(REQUEST_ID),
    REQUEST_ID,
  );
  assert.throws(
    () => normalizeCamperAssistanceClientRequestId("not-a-uuid"),
    /idempotency key is invalid/u,
  );

  const first = camperAssistanceFingerprint({
    reservationId: RESERVATION_ID,
    sourceChannel: "web",
    input: {
      category: "water",
      severity: "routine",
      summary: "No water at the pedestal",
      contactPreference: "in_app",
    },
  });
  const second = camperAssistanceFingerprint({
    reservationId: RESERVATION_ID,
    sourceChannel: "web",
    input: {
      category: "water",
      severity: "routine",
      summary: "No water at the pedestal",
      contactPreference: "in_app",
    },
  });
  const changed = camperAssistanceFingerprint({
    reservationId: RESERVATION_ID,
    sourceChannel: "web",
    input: {
      category: "water",
      severity: "urgent",
      summary: "No water at the pedestal",
      contactPreference: "in_app",
    },
  });

  assert.equal(first, second);
  assert.notEqual(first, changed);
  assert.match(first, /^[0-9a-f]{64}$/u);
});

test("Build 077 database contract is stay-linked, append-only and forced-RLS", () => {
  const migration = fs.readFileSync(
    new URL(
      "../database/migrations/0099_camper_assistance_request_interface.sql",
      import.meta.url,
    ),
    "utf8",
  );

  assert.match(migration, /public\.camper_assistance_requests/u);
  assert.match(migration, /public\.camper_assistance_request_events/u);
  assert.match(migration, /public\.camper_assistance_request_media/u);
  assert.match(migration, /r\.status = 'checked_in'/u);
  assert.match(migration, /client_request_id/u);
  assert.match(migration, /force row level security/iu);
  assert.match(migration, /Camper assistance intake evidence is append-only/u);
  assert.match(migration, /revoke all on[\s\S]*anon/iu);
  assert.match(migration, /revoke all on[\s\S]*authenticated/iu);
});

test("Build 077 persistence reuses the canonical reservation and Build 008 media stores", () => {
  const service = fs.readFileSync(
    new URL("../lib/camper-assistance/postgres.mjs", import.meta.url),
    "utf8",
  );

  assert.match(service, /public\.reservations/u);
  assert.match(service, /status='checked_in'/u);
  assert.match(service, /icamp_private\.media_assets/u);
  assert.match(service, /icamp_private\.media_lifecycle_events/u);
  assert.match(service, /maximum of five media attachments/iu);
  assert.match(service, /already_submitted/u);
  assert.doesNotMatch(service, /update public\.camper_assistance_requests/iu);
});

test("Build 077 Web/PWA is integrated into My Stay with emergency and next-build boundaries", () => {
  const page = fs.readFileSync(
    new URL("../app/guest/assistance/page.tsx", import.meta.url),
    "utf8",
  );
  const stay = fs.readFileSync(
    new URL("../app/guest/stay/page.tsx", import.meta.url),
    "utf8",
  );
  const actions = fs.readFileSync(
    new URL("../app/guest/assistance/actions.ts", import.meta.url),
    "utf8",
  );
  const help = fs.readFileSync(
    new URL("../lib/help/topics.ts", import.meta.url),
    "utf8",
  );

  assert.match(page, /For campground assistance, not emergency dispatch/u);
  assert.match(page, /Build 078 owns reclassification/u);
  assert.match(page, /addCamperAssistanceMediaAction/u);
  assert.match(stay, /Request camper assistance/u);
  assert.match(stay, /guest\/assistance\?reservation/u);
  assert.match(actions, /validateMediaUpload/u);
  assert.match(actions, /classification: "internal"/u);
  assert.match(help, /"camper\.assistance\.request"/u);
});

test("Build 077 queue advances to Build 078 and preserves the theme prerequisite", () => {
  const queue = fs.readFileSync(
    new URL("../docs/BUILD_QUEUE.md", import.meta.url),
    "utf8",
  );
  const roadmap = fs.readFileSync(
    new URL("../docs/BUILD_ROADMAP.md", import.meta.url),
    "utf8",
  );

  assert.match(queue, /Build 076 — Offline Maintenance Workspace/u);
  assert.match(queue, /FULLY PROMOTED/u);
  assert.match(queue, /Build 077 — Camper Assistance Request Interface/u);
  assert.match(queue, /Build 078 — Assistance Triage & Management Escalation/u);
  assert.match(queue, /Builds 078–081 \(4 builds\)/u);
  assert.match(roadmap, /standard theme ruleset and token contract/u);
  assert.match(roadmap, /No future visual\/style build should bypass/u);
});
