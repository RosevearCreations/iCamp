import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

import {
  SECURITY_DASHBOARD_EXPIRY_HOURS,
  SECURITY_DASHBOARD_RECENT_HOURS,
  incidentSignalLabel,
  normalizeSecurityDashboardLimit,
  securityDeviceNeedsAttention,
} from "../lib/security-dashboard/core.mjs";

test("Build 063 uses bounded dashboard windows and limits", () => {
  assert.equal(SECURITY_DASHBOARD_RECENT_HOURS, 24);
  assert.equal(SECURITY_DASHBOARD_EXPIRY_HOURS, 48);
  assert.equal(normalizeSecurityDashboardLimit(0), 1);
  assert.equal(normalizeSecurityDashboardLimit(200), 50);
  assert.equal(normalizeSecurityDashboardLimit("bad", 12), 12);
});

test("Build 063 identifies device attention without flagging inactive hardware", () => {
  assert.equal(securityDeviceNeedsAttention("healthy", true), false);
  assert.equal(securityDeviceNeedsAttention("offline", true), true);
  assert.equal(securityDeviceNeedsAttention("unknown", true), true);
  assert.equal(securityDeviceNeedsAttention("offline", false), false);
});

test("Build 063 labels only supported incident signals", () => {
  assert.equal(incidentSignalLabel("device_fault"), "Device fault");
  assert.equal(incidentSignalLabel("denied_access"), "Denied access");
  assert.equal(incidentSignalLabel("override_failure"), "Override failure");
  assert.throws(
    () => incidentSignalLabel("invented_case"),
    /Unsupported security incident signal kind/u,
  );
});

test("Build 063 dashboard reads canonical access domains under RLS", () => {
  const service = fs.readFileSync(
    new URL("../lib/security-dashboard/postgres.mjs", import.meta.url),
    "utf8",
  );

  assert.match(service, /set local role icamp_app/u);
  assert.match(service, /public\.access_devices/u);
  assert.match(service, /public\.access_device_events/u);
  assert.match(service, /public\.access_events/u);
  assert.match(service, /public\.access_credentials/u);
  assert.match(service, /public\.gate_override_requests/u);
  assert.match(service, /public\.gate_override_outcomes/u);
  assert.match(service, /public\.access_passes/u);
  assert.match(service, /e\.outcome='denied'/u);
  assert.match(service, /e\.event_kind='fault'/u);
  assert.doesNotMatch(service, /secret_fingerprint/u);
  assert.doesNotMatch(service, /validation_fingerprint/u);
});

test("Build 063 exposes a protected visual dashboard and honest incident boundary", () => {
  const page = fs.readFileSync(
    new URL("../app/workspaces/security/dashboard/page.tsx", import.meta.url),
    "utf8",
  );
  const workspace = fs.readFileSync(
    new URL("../app/workspaces/[workspace]/page.tsx", import.meta.url),
    "utf8",
  );

  assert.match(page, /Security & Access Operations Dashboard/u);
  assert.match(page, /permissions\.includes\("gate\.state\.read"\)/u);
  assert.match(page, /permissions\.includes\("access\.events\.read"\)/u);
  assert.match(page, /Canonical incident case management requires its own/u);
  assert.match(workspace, /workspaces\/security\/dashboard/u);
});
