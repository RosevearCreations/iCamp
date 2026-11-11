import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import {
  fieldAcceptanceLabel,
  validateCaseOwnership,
  validateMobileFieldReport,
  validateSavedPriorityView,
} from "../lib/booking-charges/fulfillment-supervisor-core.mjs";

const read = (path) =>
  readFileSync(new URL(`../${path}`, import.meta.url), "utf8");
const dispatchId = "f2d0ef14-c48f-488d-805c-faa09be41b2d";
const previousEventId = "a2d0ef14-c48f-488d-805c-faa09be41b2d";

test("Build 241 saved views accept only named, known priority filters", () => {
  assert.deepEqual(
    validateSavedPriorityView({
      label: "  Today's overdue  ",
      filter: "overdue",
    }),
    {
      label: "Today's overdue",
      filter: "overdue",
    },
  );
  for (const invalid of [
    { label: "x", filter: "open" },
    { label: "x".repeat(49), filter: "all" },
    { label: "Valid", filter: "../other-campground" },
  ]) {
    assert.throws(() => validateSavedPriorityView(invalid));
  }
});

test("Build 241 case ownership is an explicit versioned claim or release", () => {
  assert.deepEqual(
    validateCaseOwnership({
      dispatchId,
      previousEventId,
      intent: "claim",
      note: " Review overdue receipt ",
    }),
    {
      dispatchId,
      previousEventId,
      intent: "claim",
      note: "Review overdue receipt",
    },
  );
  assert.equal(
    validateCaseOwnership({
      dispatchId,
      previousEventId: "",
      intent: "release",
      note: "Case returned to queue",
    }).previousEventId,
    null,
  );
  for (const invalid of [
    { dispatchId: "bad" },
    { previousEventId: "bad" },
    { intent: "auto-assign" },
    { note: "x" },
    { note: "x".repeat(301) },
  ]) {
    assert.throws(() =>
      validateCaseOwnership({
        dispatchId,
        previousEventId,
        intent: "claim",
        note: "Detailed source follow-up",
        ...invalid,
      }),
    );
  }
});

test("Build 241 mobile observations never assert independent owner or device acceptance", () => {
  assert.deepEqual(
    validateMobileFieldReport({
      dispatchId,
      deviceKind: "mobile",
      outcome: "blocked",
      note: "Buttons hidden on phone",
    }),
    {
      dispatchId,
      deviceKind: "mobile",
      outcome: "blocked",
      note: "Buttons hidden on phone",
    },
  );
  assert.match(fieldAcceptanceLabel(null), /No worker device evidence/u);
  assert.match(
    fieldAcceptanceLabel({ outcome: "usable" }),
    /independent acceptance HOLD/u,
  );
  assert.match(
    fieldAcceptanceLabel({ outcome: "blocked" }),
    /independent acceptance HOLD/u,
  );
  for (const invalid of [
    { dispatchId: "missing" },
    { deviceKind: "unknown" },
    { outcome: "owner_accepted" },
    { note: "a" },
  ]) {
    assert.throws(() =>
      validateMobileFieldReport({
        dispatchId,
        deviceKind: "mobile",
        outcome: "blocked",
        note: "Tested my work inbox",
        ...invalid,
      }),
    );
  }
});

test("Build 241 source history is immutable, constrained by campground and self-claim actor", () => {
  const sql = read(
    "database/migrations/0225_build241_fulfillment_saved_views_ownership_mobile.sql",
  );
  const verify = read(
    "database/verify/0225_build241_fulfillment_saved_views_ownership_mobile.sql",
  );
  assert.match(sql, /force row level security/gu);
  assert.match(sql, /unique \(dispatch_id, previous_event_id\)/u);
  assert.match(sql, /service_fulfillment_case_owner_first_idx/u);
  assert.match(sql, /new\.previous_event_id is distinct from latest\.id/u);
  assert.match(
    sql,
    /new\.claimed_by_user_id is distinct from new\.changed_by_user_id/u,
  );
  assert.match(
    sql,
    /new\.reported_by_user_id is distinct from icamp_private\.request_user_id/u,
  );
  assert.match(
    sql,
    /current_dispatch\.current_worker is distinct from new\.reported_by_user_id/u,
  );
  assert.match(
    sql,
    /grant select, insert on public\.service_fulfillment_mobile_field_reports/u,
  );
  assert.match(verify, /histories must remain immutable/u);
  assert.match(verify, /private evidence exposed to anon/u);
});

test("Build 241 server actions reauthorize, audit source writes and avoid guest changes", () => {
  const service = read(
    "lib/booking-charges/fulfillment-supervisor-postgres.mjs",
  );
  const actions = read(
    "app/workspaces/management/campgrounds/fulfillment-priority/actions.ts",
  );
  const workerActions = read(
    "app/workspaces/management/campgrounds/worker-inbox/actions.ts",
  );
  const supervisorPage = read(
    "app/workspaces/management/campgrounds/fulfillment-priority/page.tsx",
  );
  const workerPage = read(
    "app/workspaces/management/campgrounds/worker-inbox/page.tsx",
  );
  assert.match(service, /set local role icamp_app/u);
  assert.match(service, /assertSupervisor\(actorUserId, campgroundId\)/u);
  assert.match(service, /appendAuditEvent\(client/u);
  assert.match(service, /claimed_by_user_id/u);
  assert.match(service, /assigned_user_id=\$3/u);
  assert.match(
    actions,
    /requireCampgroundPermission\(\s*campgroundId,\s*"staff\.manage"/u,
  );
  assert.match(
    actions,
    /requireCampgroundPermission\(\s*campgroundId,\s*"reservation\.modify"/u,
  );
  assert.match(workerActions, /recordWorkerMobileFieldReport/u);
  assert.match(supervisorPage, /worker-reported|Worker device evidence/u);
  assert.match(workerPage, /Record my device observation/u);
  assert.doesNotMatch(
    service,
    /update public\.reservations|insert into public\.payments/u,
  );
});

test("MASTER363 iCamp keeps platform identity while public signer and receipt remain held", () => {
  const manifest = JSON.parse(
    read("public/.well-known/rosevear-integration-manifest.json"),
  );
  const build = read("scripts/build241-sync-public-source-manifest.mjs");
  const route = read("app/api/integration/v1/shell/convergence/route.ts");
  const ql364 = read("app/api/integration/v1/shell/health/route.ts");
  assert.equal(manifest.source_id, "icamp");
  assert.equal(manifest.source_role, "platform_shell");
  assert.equal(manifest.tenant_boundary, "platform_shell");
  assert.equal(
    manifest.source_revision,
    "e2d343595363ca9106e7f1dbc60006e3a6c616aa",
  );
  assert.equal(manifest.signature.value, null);
  assert.equal(manifest.connection_state, "DISCONNECTED / HOLD");
  assert.match(build, /VERCEL_GIT_COMMIT_SHA/u);
  assert.match(build, /Production source manifest needs an exact/u);
  assert.match(route, /export async function GET\(\)/u);
  assert.doesNotMatch(route, /url\.search/u);
  assert.match(route, /LOCAL_BUILD_REVISION_MATCH/u);
  assert.match(route, /DEPLOYMENT_SELF_REPORT_REQUIRES_INDEPENDENT/u);
  assert.match(route, /signedHealthReceipt: "HOLD_NO_ORIGINAL_SOURCE_SIGNER"/u);
  assert.match(route, /connected: false/u);
  assert.match(
    ql364,
    /Independent source-owner, broker KMS and durable nonce services are not/u,
  );
});
