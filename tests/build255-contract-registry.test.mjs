import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import {
  APPLICATIONS,
  ENVELOPE_SCHEMA,
  EVENT_TYPES,
  REGISTRY_SCHEMA,
  ROLE_PERMISSION_MATRIX,
  SECURITY_TIERS,
  assessPinLifecycle,
  evaluateRoleScope,
  getRegistrySummary,
  validateRegistryAgainstTopology,
  validateSourceEnvelope,
} from "../lib/release/build255-contract-registry.mjs";
import { STANDARD_THEME } from "../lib/theme/standard.mjs";

const topology = JSON.parse(
  readFileSync(
    new URL("../.github/rosevear-master-topology.v1.json", import.meta.url),
    "utf8",
  ),
);
const now = "2026-11-15T14:00:00.000Z";
const sha = "a".repeat(40);
const tenant = "11111111-2222-4333-8444-555555555555";
const principalId = "99999999-2222-4333-8444-555555555555";
const envelope = {
  schema: ENVELOPE_SCHEMA,
  contractVersion: REGISTRY_SCHEMA,
  sourceAppId: "icamp",
  targetAppId: "ai-data-platform",
  sourceRevision: sha,
  eventType: "security_exception.v1",
  issuedAt: "2026-11-15T13:58:00.000Z",
  nonce: "source-nonce-unique-metadata-only-000001",
  tenantId: tenant,
  dataClassification: "non_sensitive_metadata",
};
const principal = {
  appId: "icamp",
  principalId,
  role: "campground_owner",
  tenantId: tenant,
  mfaAssurance: "aal2",
};
const request = {
  targetAppId: "icamp",
  permission: "campground.reservation.manage",
  tenantId: tenant,
  tier: "T4_INDEPENDENT_REVIEW",
};
const pin = {
  appId: "ai-data-platform",
  fingerprintSha256: "b".repeat(64),
  sourceRevision: sha,
  notBefore: "2026-11-01T00:00:00.000Z",
  notAfter: "2026-12-01T00:00:00.000Z",
  custodianAttested: true,
};

test("Canonical topology matches seven unique app identities and exact repository names", () => {
  assert.equal(validateRegistryAgainstTopology(topology).valid, true);
  assert.deepEqual(
    APPLICATIONS.map((app) => app.id),
    [
      "ai-data-platform",
      "rosevear-ai-hub",
      "rosevear-comms-hub",
      "icamp",
      "yw",
      "devilndove",
      "rosiedazzlers",
    ],
  );
  assert.equal(new Set(APPLICATIONS.map((app) => app.id)).size, 7);
  assert.deepEqual(
    APPLICATIONS.filter((app) => app.model === "GOVERNED_EXTERNAL_SHELL").map(
      (app) => app.id,
    ),
    ["icamp", "yw"],
  );
  assert.equal(getRegistrySummary().externalConnected, false);
  assert.equal(getRegistrySummary().ownerAcceptance, "HOLD");
});

test("Mutated app, role model, owner hierarchy and duplicate identity fail topology", () => {
  const copy = () => structuredClone(topology);
  const wrongRepo = copy();
  wrongRepo.applications[0].repository = "RosevearCreations/fake";
  assert.equal(validateRegistryAgainstTopology(wrongRepo).valid, false);
  const wrongRole = copy();
  wrongRole.applications[2].connectionModel = "GOVERNED_EXTERNAL_SHELL";
  assert.equal(validateRegistryAgainstTopology(wrongRole).valid, false);
  const wrongAuthority = copy();
  wrongAuthority.validationAuthority.appId = "icamp";
  assert.equal(validateRegistryAgainstTopology(wrongAuthority).valid, false);
  const duplicate = copy();
  duplicate.applications[1].appId = "ai-data-platform";
  assert.equal(validateRegistryAgainstTopology(duplicate).valid, false);
  const transfer = copy();
  transfer.rules.authorityTransfer = true;
  assert.equal(validateRegistryAgainstTopology(transfer).valid, false);
});

test("Six ordered tier gates and least privilege role matrix are source-only", () => {
  assert.deepEqual(SECURITY_TIERS, [
    "T0_PUBLIC",
    "T1_SOURCE",
    "T2_SIGNED_CUSTODY",
    "T3_SCOPED_IDENTITY",
    "T4_INDEPENDENT_REVIEW",
    "T5_LIVE_TRANSPORT",
  ]);
  assert.equal(Object.keys(ROLE_PERMISSION_MATRIX).length, 7);
  assert.equal(
    Object.values(ROLE_PERMISSION_MATRIX).some((roles) =>
      Object.values(roles).some((permissions) =>
        permissions.includes("receiver.on"),
      ),
    ),
    false,
  );
  assert.equal(EVENT_TYPES.length, 4);
});

test("Valid scoped, fresh event is structurally reviewed, never signed or connected", () => {
  const result = validateSourceEnvelope(envelope, { asOf: now });
  assert.equal(result.valid, true);
  assert.equal(result.cryptographicallyAuthenticated, false);
  assert.equal(result.receiverConnected, false);
  assert.equal(result.ownerAcceptance, "HOLD");
});

test("Unknown origins, stale/future receipts, wrong hash, extra PII and bad nonce are rejected", () => {
  for (const candidate of [
    { sourceAppId: "made-up" },
    { sourceAppId: "ai-data-platform", targetAppId: "ai-data-platform" },
    { sourceRevision: "bad" },
    { eventType: "receiver_on" },
    { issuedAt: "2026-11-15T13:00:00.000Z" },
    { issuedAt: "2026-11-15T14:02:00.000Z" },
    { nonce: "short" },
    { dataClassification: "guest_pii" },
    { email: "guest@example.com" },
    { payload: { cardNumber: "secret" } },
  ]) {
    assert.equal(
      validateSourceEnvelope({ ...envelope, ...candidate }, { asOf: now })
        .valid,
      false,
    );
  }
  assert.equal(validateSourceEnvelope(null, { asOf: now }).valid, false);
});

test("Cross-company tenant data, missing scope and unexpected scope fail closed", () => {
  assert.equal(
    validateSourceEnvelope(
      { ...envelope, targetAppId: "rosiedazzlers" },
      { asOf: now },
    ).valid,
    false,
  );
  assert.equal(
    validateSourceEnvelope({ ...envelope, tenantId: null }, { asOf: now })
      .valid,
    false,
  );
  assert.equal(
    validateSourceEnvelope(
      { ...envelope, eventType: "capability_status.v1", tenantId: tenant },
      { asOf: now },
    ).valid,
    false,
  );
  assert.equal(
    validateSourceEnvelope(
      {
        ...envelope,
        sourceAppId: "devilndove",
        eventType: "security_exception.v1",
      },
      { asOf: now },
    ).valid,
    false,
  );
});

test("Source role and MFA match still cannot grant actual authorization", () => {
  const result = evaluateRoleScope({ principal, request });
  assert.equal(
    result.status,
    "SOURCE_ROLE_MATCH_AWAIT_INDEPENDENT_AUTHORIZATION",
  );
  assert.equal(result.allowed, false);
  assert.equal(result.receiverConnected, false);
});

test("Role, MFA, tenant, app, T5 and principal mismatch are denied", () => {
  const cases = [
    [{ ...principal, role: "campground_viewer" }, request],
    [{ ...principal, mfaAssurance: "aal1" }, request],
    [
      { ...principal, tenantId: "22222222-2222-4333-8444-555555555555" },
      request,
    ],
    [principal, { ...request, targetAppId: "yw" }],
    [principal, { ...request, tier: "T5_LIVE_TRANSPORT" }],
    [{ ...principal, principalId: "not-uuid" }, request],
    [{ ...principal, appId: "rosiedazzlers" }, request],
  ];
  for (const [who, action] of cases) {
    const result = evaluateRoleScope({ principal: who, request: action });
    assert.equal(result.allowed, false);
    assert.notEqual(
      result.status,
      "SOURCE_ROLE_MATCH_AWAIT_INDEPENDENT_AUTHORIZATION",
    );
  }
});

test("Pin rotation only reports source metadata review and never auto-rotates", () => {
  const valid = assessPinLifecycle({
    appId: "ai-data-platform",
    pins: [pin],
    asOf: now,
  });
  assert.equal(valid.status, "SOURCE_PIN_CURRENT_REVIEW_ONLY");
  assert.equal(valid.eligible, false);
  assert.equal(valid.autoRotate, false);
  assert.equal(valid.receiverConnected, false);
  assert.equal(valid.ownerAcceptance, "HOLD");
});

test("Missing, duplicated, revoked, unverified, expired, future and oversized pins HOLD", () => {
  const check = (pins) =>
    assessPinLifecycle({ appId: "ai-data-platform", pins, asOf: now });
  for (const pins of [
    [],
    [pin, pin],
    [{ ...pin, revoked: true }],
    [{ ...pin, custodianAttested: false }],
    [{ ...pin, fingerprintSha256: "short" }],
    [{ ...pin, notAfter: "2026-11-15T13:59:00.000Z" }],
    [{ ...pin, notBefore: "2026-11-20T00:00:00.000Z" }],
    [{ ...pin, notAfter: "2027-11-15T00:00:00.000Z" }],
    [{ ...pin, appId: "yw" }],
  ]) {
    assert.match(check(pins).status, /^HOLD_/u);
    assert.equal(check(pins).eligible, false);
  }
});

test("Renewal due flags only impending expiry, not authority transfer", () => {
  const due = assessPinLifecycle({
    appId: "ai-data-platform",
    pins: [{ ...pin, notAfter: "2026-11-20T00:00:00.000Z" }],
    asOf: now,
  });
  assert.equal(due.status, "SOURCE_PIN_RENEWAL_DUE_REVIEW_ONLY");
  assert.equal(due.eligible, false);
});

test("Protected Sysop integration and original Meadow/Orbit remain unchanged", () => {
  const page = readFileSync(
    new URL("../app/sysop/security-governance/page.tsx", import.meta.url),
    "utf8",
  );
  assert.match(page, /requireSysop\("\/sysop"\)/u);
  assert.match(page, /Build 255/u);
  assert.match(page, /Master CONNECTED: HOLD/u);
  assert.equal(STANDARD_THEME.style, "Meadow & evergreen");
  assert.match(
    readFileSync(
      new URL("../app/settings/themes/page.tsx", import.meta.url),
      "utf8",
    ),
    /Orbit/u,
  );
});
