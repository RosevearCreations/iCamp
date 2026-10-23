import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

import {
  ASSISTANCE_CASE_STATES,
  ASSISTANCE_ESCALATION_LEVELS,
  ASSISTANCE_MESSAGE_CHANNELS,
  ASSISTANCE_OUTCOMES,
  normalizeAssistanceClosure,
  normalizeAssistanceEscalation,
  normalizeAssistanceGuestMessage,
  normalizeAssistanceTriage,
} from "../lib/camper-assistance-triage/core.mjs";

test("Build 078 defines bounded triage, escalation, communication and outcome vocabularies", () => {
  assert.deepEqual(ASSISTANCE_CASE_STATES, [
    "new",
    "triaged",
    "assigned",
    "escalated",
    "closed",
  ]);
  assert.deepEqual(ASSISTANCE_ESCALATION_LEVELS, [
    "main_foreman",
    "manager",
    "owner",
  ]);
  assert.deepEqual(ASSISTANCE_MESSAGE_CHANNELS, [
    "in_app",
    "email",
    "sms",
    "phone",
  ]);
  assert.deepEqual(ASSISTANCE_OUTCOMES, [
    "resolved",
    "referred",
    "duplicate",
    "guest_cancelled",
    "not_reproducible",
    "other",
  ]);

  assert.deepEqual(
    normalizeAssistanceTriage({
      category: " WiFi ",
      severity: " Urgent ",
      assignedToUserId: "",
      note: "  Router signal is down at the site. ",
    }),
    {
      category: "wifi",
      severity: "urgent",
      assignedToUserId: null,
      note: "Router signal is down at the site.",
    },
  );
});

test("Build 078 rejects unbounded escalation, communication and closure values", () => {
  assert.throws(
    () =>
      normalizeAssistanceEscalation({
        level: "911",
        reason: "Immediate help",
      }),
    /Escalation level is invalid/u,
  );
  assert.throws(
    () =>
      normalizeAssistanceGuestMessage({
        channel: "carrier_pigeon",
        message: "Update",
      }),
    /Guest contact channel is invalid/u,
  );
  assert.throws(
    () =>
      normalizeAssistanceClosure({
        outcomeCode: "erase",
        outcomeSummary: "Done",
      }),
    /Outcome is invalid/u,
  );
});

test("Build 078 schema preserves immutable intake and adds forced-RLS operational evidence", () => {
  const migration = fs.readFileSync(
    new URL(
      "../database/migrations/0101_assistance_triage_management_escalation.sql",
      import.meta.url,
    ),
    "utf8",
  );

  for (const permission of [
    "assistance.triage",
    "assistance.escalate",
    "assistance.communicate",
    "assistance.close",
  ]) {
    assert.match(migration, new RegExp(permission.replace(".", "\\."), "u"));
  }

  assert.match(migration, /public\.camper_assistance_cases/u);
  assert.match(migration, /public\.camper_assistance_case_events/u);
  assert.match(migration, /public\.camper_assistance_escalations/u);
  assert.match(migration, /force row level security/iu);
  assert.match(migration, /operational_category/u);
  assert.match(migration, /operational_severity/u);
  assert.match(migration, /operational events are append-only/u);
  assert.match(migration, /camper_assistance_escalations_active_case_idx/u);
  assert.match(migration, /Closed camper assistance cases are terminal/u);
  assert.match(migration, /revoke all on[\s\S]*anon/iu);
  assert.match(migration, /revoke all on[\s\S]*authenticated/iu);
  assert.doesNotMatch(
    migration,
    /update public\.camper_assistance_requests/iu,
  );
});

test("Build 078 persistence enforces same-campground assignment, optimistic concurrency and escalation-before-close governance", () => {
  const service = fs.readFileSync(
    new URL("../lib/camper-assistance-triage/postgres.mjs", import.meta.url),
    "utf8",
  );

  assert.match(service, /campground_assignments/u);
  assert.match(service, /assignment_state='active'/u);
  assert.match(service, /row_version=\$8/u);
  assert.match(service, /row_version=\$5/u);
  assert.match(service, /already has an active escalation/u);
  assert.match(service, /Resolve the active management escalation before closing/u);
  assert.match(service, /externalDispatchClaimed: false/u);
  assert.match(service, /guest_visible/u);
  assert.match(service, /appendAuditEvent/u);
});

test("Build 078 initializes a case with every new Build 077 intake", () => {
  const intake = fs.readFileSync(
    new URL("../lib/camper-assistance/postgres.mjs", import.meta.url),
    "utf8",
  );
  assert.match(intake, /insert into public\.camper_assistance_cases/u);
  assert.match(intake, /on conflict \(request_id\) do nothing/u);
});

test("Build 078 surfaces staff triage and guest-visible operational status", () => {
  const consolePage = fs.readFileSync(
    new URL(
      "../app/workspaces/management/campgrounds/assistance/page.tsx",
      import.meta.url,
    ),
    "utf8",
  );
  const guestPage = fs.readFileSync(
    new URL("../app/guest/assistance/page.tsx", import.meta.url),
    "utf8",
  );
  const shell = fs.readFileSync(
    new URL("../app/workspaces/[workspace]/page.tsx", import.meta.url),
    "utf8",
  );
  const help = fs.readFileSync(
    new URL("../lib/help/topics.ts", import.meta.url),
    "utf8",
  );

  assert.match(consolePage, /Assistance Triage & Management Escalation/u);
  assert.match(consolePage, /Save triage/u);
  assert.match(consolePage, /Record guest update/u);
  assert.match(consolePage, /Resolve escalation/u);
  assert.match(consolePage, /Close assistance case/u);
  assert.match(guestPage, /listGuestAssistanceUpdates/u);
  assert.match(guestPage, /Status \/ updates/u);
  assert.match(shell, /Open assistance triage/u);
  assert.match(help, /"camper\.assistance\.triage"/u);
});

test("Build 078 advances the queue to Build 079 and preserves the theme prerequisite", () => {
  const queue = fs.readFileSync(
    new URL("../docs/BUILD_QUEUE.md", import.meta.url),
    "utf8",
  );
  const roadmap = fs.readFileSync(
    new URL("../docs/BUILD_ROADMAP.md", import.meta.url),
    "utf8",
  );

  assert.match(queue, /Build 077 — Camper Assistance Request Interface/u);
  assert.match(queue, /FULLY PROMOTED/u);
  assert.match(queue, /Build 078 — Assistance Triage & Management Escalation/u);
  assert.match(queue, /Build 079 — Garbage Service Models/u);
  assert.match(queue, /Builds 079–081 \(3 builds\)/u);
  assert.match(roadmap, /standard theme ruleset and token contract/u);
  assert.match(roadmap, /No future visual\/style build should bypass/u);
});
