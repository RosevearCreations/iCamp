import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import {
  CAMPER_ASSISTANCE_CATEGORIES,
  camperAssistanceFingerprint,
  normalizeCamperAssistanceClientRequestId,
  normalizeCamperAssistanceInput,
} from "../lib/camper-assistance/core.mjs";

test("Build 077 normalizes the required assistance intake vocabulary", () => {
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

  assert.deepEqual(
    normalizeCamperAssistanceInput({
      category: " WiFi ",
      severity: " Urgent ",
      summary: "  Site Wi-Fi is unavailable  ",
      details: " Router signal disappeared near the site. ",
      contactPreference: " SMS ",
    }),
    {
      category: "wifi",
      severity: "urgent",
      summary: "Site Wi-Fi is unavailable",
      details: "Router signal disappeared near the site.",
      contactPreference: "sms",
    },
  );
});

test("Build 077 rejects unsupported priority and malformed idempotency keys", () => {
  assert.throws(
    () =>
      normalizeCamperAssistanceInput({
        category: "maintenance",
        severity: "emergency",
        summary: "Need help",
        contactPreference: "phone",
      }),
    /severity is invalid/u,
  );
  assert.throws(
    () => normalizeCamperAssistanceClientRequestId("not-a-uuid"),
    /idempotency key is invalid/u,
  );
});

test("Build 077 request fingerprints are deterministic and payload-sensitive", () => {
  const base = {
    reservationId: "11111111-1111-4111-8111-111111111111",
    sourceChannel: "web",
    input: {
      category: "water",
      severity: "soon",
      summary: "Low water pressure",
      details: "Pressure dropped after supper.",
      contactPreference: "in_app",
    },
  };
  assert.equal(camperAssistanceFingerprint(base), camperAssistanceFingerprint(base));
  assert.notEqual(
    camperAssistanceFingerprint(base),
    camperAssistanceFingerprint({
      ...base,
      input: { ...base.input, severity: "urgent" },
    }),
  );
});

test("Build 077 repository contract enforces stay linkage, RLS and secure media reuse", async () => {
  const migration = await readFile(
    "database/migrations/0099_camper_assistance_request_interface.sql",
    "utf8",
  );
  const verify = await readFile(
    "database/verify/0099_camper_assistance_request_interface.sql",
    "utf8",
  );
  const page = await readFile("app/guest/assistance/page.tsx", "utf8");
  const actions = await readFile("app/guest/assistance/actions.ts", "utf8");
  const stay = await readFile("app/guest/stay/page.tsx", "utf8");
  const help = await readFile("lib/help/topics.ts", "utf8");

  assert.match(migration, /status <> 'checked_in'/u);
  assert.match(migration, /force row level security/u);
  assert.match(migration, /revoke all on[\s\S]+anon/u);
  assert.match(migration, /client_request_id/u);
  assert.match(verify, /must force RLS/u);
  assert.match(actions, /validateMediaUpload/u);
  assert.match(actions, /classification: "internal"/u);
  assert.match(actions, /createSupabaseStorageAdapter/u);
  assert.match(page, /For campground assistance, not emergency dispatch/u);
  assert.match(page, /Build 078 owns reclassification/u);
  assert.match(stay, /\/guest\/assistance\?reservation=/u);
  assert.match(help, /"camper\.assistance\.request"/u);
});
