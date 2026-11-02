import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

import {
  canRequestIncidentClosure,
  independentReviewEligibility,
  incidentText,
  incidentUuid,
  normalizeIncidentIntake,
} from "../lib/security-incidents/core.mjs";

const read = (path) => readFileSync(new URL(path, import.meta.url), "utf8");
const officer = "11000000-0000-4000-8000-000000000001";
const reviewer = "11000000-0000-4000-8000-000000000002";
const assignee = "11000000-0000-4000-8000-000000000003";

test("Build187 incident intake validates severity and exact optional canonical source signal", () => {
  const input = {
    title: "Gate-side security concern",
    category: "access",
    severity: "high",
    operationalSummary: "Staff observed a repeated late-night access concern.",
    linkedSignalKind: "access_denied",
    linkedSignalId: officer,
  };
  assert.deepEqual(normalizeIncidentIntake(input), input);
  assert.throws(
    () => normalizeIncidentIntake({ ...input, severity: "emergency_dispatch" }),
    /severity/,
  );
  assert.throws(
    () => normalizeIncidentIntake({ ...input, linkedSignalId: "" }),
    /provided together/,
  );
  assert.throws(
    () =>
      normalizeIncidentIntake({ ...input, linkedSignalKind: "alert_clear" }),
    /Unknown security signal/,
  );
  assert.throws(() => incidentUuid("not-an-id"), /UUID/);
  assert.throws(() => incidentText("short", "Rationale", 20, 1500), /20–1500/);
});

test("Build187 requires independent closure after an investigation and validated evidence", () => {
  const pending = {
    status: "closure_pending",
    openedByUserId: officer,
    assigneeUserId: assignee,
    closureRequestedByUserId: officer,
  };
  const events = [
    { actorUserId: officer, eventKind: "intake" },
    { actorUserId: assignee, eventKind: "investigated" },
  ];
  assert.equal(
    independentReviewEligibility(pending, reviewer, events).eligible,
    true,
  );
  assert.equal(
    independentReviewEligibility(pending, officer, events).eligible,
    false,
  );
  assert.equal(
    independentReviewEligibility(pending, assignee, events).eligible,
    false,
  );
  assert.equal(
    independentReviewEligibility(
      { ...pending, status: "closed" },
      reviewer,
      events,
    ).eligible,
    false,
  );
  assert.equal(
    independentReviewEligibility(
      { ...pending, assigneeUserId: null },
      reviewer,
      [...events, { actorUserId: reviewer, eventKind: "evidence_attached" }],
    ).eligible,
    false,
  );
  assert.equal(
    canRequestIncidentClosure({ status: "investigating" }, []),
    false,
  );
  assert.equal(
    canRequestIncidentClosure({ status: "investigating" }, [
      { lifecycleState: "archived", validationState: "validated" },
    ]),
    false,
  );
  assert.equal(
    canRequestIncidentClosure({ status: "escalated" }, [
      { lifecycleState: "active", validationState: "validated" },
    ]),
    true,
  );
  assert.equal(
    canRequestIncidentClosure({ status: "open" }, [
      { lifecycleState: "active", validationState: "validated" },
    ]),
    false,
  );
});

test("Build187 database migration protects chronology, independent review, attachments and RLS", () => {
  const sql = read(
    "../database/migrations/0197_build187_canonical_security_incidents.sql",
  );
  for (const fragment of [
    "create table icamp_private.security_incident_cases",
    "create table icamp_private.security_incident_sensitive",
    "create table icamp_private.security_incident_attachments",
    "create table icamp_private.security_incident_closure_reviews",
    "security_incident_review_guard",
    "security_incident_media_retain",
    "security_incident_events_immutable",
    "force row level security",
    "security.incident.sensitive.read",
    "security.incident.review",
    "and e.outcome='denied'",
    "m.lifecycle_state='active' and m.validation_state='validated'",
  ])
    assert.ok(sql.includes(fragment), `Missing ${fragment}`);
  assert.match(
    sql,
    /raise exception 'Security incident closure requires an independent approved review'/,
  );
  assert.match(
    sql,
    /Retained security incident evidence cannot be modified or removed/,
  );
});

test("Build187 UI and route enforce staff-only confidential evidence and held integrations", () => {
  const page = read("../app/workspaces/security/incidents/page.tsx");
  const actions = read("../app/workspaces/security/incidents/actions.ts");
  const route = read(
    "../app/workspaces/security/incidents/media/[attachmentId]/route.ts",
  );
  const generic = read("../app/api/media/[mediaId]/access/route.ts");
  const backend = read("../lib/security-incidents/postgres.mjs");
  assert.match(page, /requireStaff\(PATH\)/);
  assert.match(page, /Billing and\s+outbound Omnichannel are HELD/);
  assert.match(page, /Independent closure review/);
  assert.match(
    actions,
    /requireCampgroundPermission\(\s*campgroundId,\s*"security.incident.review",\s*PATH,?\s*\)/,
  );
  assert.match(actions, /validateMediaUpload/);
  assert.match(route, /getSecurityIncidentAttachment/);
  assert.match(generic, /isSecurityIncidentMedia/);
  assert.match(backend, /set local role icamp_app/);
  assert.match(backend, /for update/);
  assert.doesNotMatch(backend, /fetch\(/);
});
