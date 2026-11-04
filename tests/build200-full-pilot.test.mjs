import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import test from "node:test";

import {
  BUILD200_JOURNEYS,
  build200ReviewPacket,
  build200ReviewRows,
} from "../lib/pilot/build200-pilot.mjs";
import { checkPublicCommsHubTransport } from "../lib/integration-v1/build200-comms-transport.mjs";

const root = new URL("../", import.meta.url);

test("Build 200 source audit enumerates real routes and automated regression coverage for every pilot journey", () => {
  assert.equal(BUILD200_JOURNEYS.length, 7);
  assert.equal(new Set(BUILD200_JOURNEYS.map((j) => j.id)).size, 7);
  for (const journey of BUILD200_JOURNEYS) {
    assert.ok(journey.routes.includes(journey.href));
    assert.ok(journey.tests.length >= 2);
    assert.match(journey.href, /^\/[a-z0-9/\-]+$/);
    for (const route of journey.routes) {
      assert.ok(
        existsSync(new URL(`app${route}/page.tsx`, root)),
        `missing application route: ${route}`,
      );
    }
    for (const testFile of journey.tests) {
      assert.match(testFile, /^[a-z0-9-]+\.test\.mjs$/);
      assert.ok(existsSync(new URL(`tests/${testFile}`, root)));
    }
    assert.ok(journey.manual.length > 20);
  }
});

test("Build 200 local owner reports are sanitized and cannot confer an independent go-live decision", async () => {
  const reports = Object.fromEntries(
    BUILD200_JOURNEYS.map(({ id }) => [
      id,
      { state: "PASS_OWNER_REPORTED", sourceRef: "review-note-2026-0001" },
    ]),
  );
  const review = build200ReviewRows(reports);
  assert.equal(review.counts.PASS_OWNER_REPORTED, 7);
  assert.equal(review.rows[0].awaiting_independent_review, true);
  const packet = await build200ReviewPacket(reports);
  assert.equal(packet.owner_go_live_decision, "NO_GO_PENDING_EVIDENCE");
  assert.equal(packet.public_launch_authorized, false);
  assert.equal(packet.omnichannel_connection, "DISCONNECTED / HOLD");
  assert.equal(packet.signed_original_comms_hub_source, "MISSING");
  assert.equal(packet.independent_pilot_signoff, "MISSING");
  assert.equal(packet.real_device_acceptance, "MISSING");
  assert.equal(packet.external_effects, false);
  assert.equal(packet.source_sha256.length, 64);
  const independentDigest = createHash("sha256")
    .update(JSON.stringify({ schema: packet.schema, rows: packet.rows }))
    .digest("hex");
  assert.equal(packet.source_sha256, independentDigest);
  assert.deepEqual(await build200ReviewPacket(reports), packet);

  const invalid = await build200ReviewPacket({
    guest_discovery_booking: {
      state: "APPROVED_PRODUCTION",
      sourceRef: "guest@example.com?token=private",
    },
  });
  assert.equal(invalid.rows[0].state, "NOT_RUN");
  assert.equal(invalid.rows[0].source_ref, null);
  assert.equal(invalid.counts.NOT_RUN, 7);
  assert.doesNotMatch(JSON.stringify(invalid), /guest@example.com|private/);
});

test("Build 200 public transport check is fixed-host HTTPS GET, credential-free and never claims a signed peer", async () => {
  let called = 0;
  const result = await checkPublicCommsHubTransport(async (url, options) => {
    called += 1;
    assert.equal(url, "https://rosevear-comms-hub.devilndovelive.workers.dev/");
    assert.equal(options.method, "GET");
    assert.equal(options.redirect, "manual");
    assert.equal(options.credentials, "omit");
    assert.equal(options.cache, "no-store");
    assert.deepEqual(options.headers, { Accept: "text/html" });
    assert.ok(options.signal instanceof AbortSignal);
    assert.equal(options.body, undefined);
    return {
      status: 200,
      ok: true,
      url,
      body: { cancel: async () => {} },
    };
  });
  assert.equal(called, 1);
  assert.equal(result.transport, "PUBLIC_HTTPS_REACHABLE");
  assert.equal(result.connection_state, "DISCONNECTED / HOLD");
  assert.equal(result.authenticated_gateway_get, "NOT_ATTEMPTED");
  assert.equal(result.signed_source_identity, "NOT_ENROLLED");
  assert.equal(result.verified_business_connection, false);
  assert.equal(result.external_message_sent, false);
});

test("Build 200 public transport probe fails closed on redirect, foreign origin, HTTP failure and network failure", async () => {
  const expected = [
    {
      response: { status: 302, ok: false },
      transport: "DENY_REDIRECT",
    },
    {
      response: {
        status: 200,
        ok: true,
        url: "https://unapproved.example/",
      },
      transport: "DENY_UNEXPECTED_ORIGIN",
    },
    {
      response: { status: 503, ok: false },
      transport: "PUBLIC_ENDPOINT_HTTP_FAILURE",
    },
  ];
  for (const { response, transport } of expected) {
    const result = await checkPublicCommsHubTransport(async () => response);
    assert.equal(result.transport, transport);
    assert.equal(result.connection_state, "DISCONNECTED / HOLD");
  }
  const unreachable = await checkPublicCommsHubTransport(async () => {
    throw new Error("Do not leak network error details");
  });
  assert.equal(unreachable.transport, "PUBLIC_ENDPOINT_UNREACHABLE");
  assert.doesNotMatch(JSON.stringify(unreachable), /Do not leak/);
  assert.equal(unreachable.response_code, null);
});

test("Build 200 connection API requires staff permission and prohibits request-selected proxy destinations", () => {
  const code = readFileSync(
    new URL("app/api/it/comms-hub/transport/route.ts", root),
    "utf8",
  );
  assert.match(code, /requireAnyCampgroundPermission\(/);
  assert.match(code, /"it\.integration\.read"/);
  assert.match(code, /if \(new URL\(request\.url\)\.search\)/);
  assert.match(code, /private, no-store/);
  assert.doesNotMatch(code, /export async function POST/);
  const manifest = JSON.parse(
    readFileSync(
      new URL("public/.well-known/rosevear-integration-manifest.json", root),
    ),
  );
  assert.equal(manifest.signature?.state, "AWAITING_INDEPENDENT_SOURCE_SIGNER");
  assert.equal(manifest.connection_state, "DISCONNECTED / HOLD");
});
