import test from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { readFileSync } from "node:fs";
import {
  normalizeEmergencyPlan,
  normalizeEmergencyDecision,
} from "../lib/emergency-notices/core.mjs";

const id = () => randomUUID();
const draft = () => ({
  id: id(),
  audience: "campground",
  severity: "urgent",
  title: "Storm shelter directions",
  message:
    "Severe weather observed. Follow the campground's official shelter directions and staff guidance.",
  onsiteInstructions:
    "Contact local emergency services directly when indicated and follow the posted shelter plan.",
});
const decision = () => ({
  id: id(),
  noticeId: id(),
  kind: "approve",
  boundaryAcknowledged: "yes",
  onsitePlanChecked: "yes",
  note: "Reviewed the on-site emergency plan with the duty manager.",
});

test("audiences and target identities must match exactly one campground scope", () => {
  assert.equal(normalizeEmergencyPlan(draft()).audience, "campground");
  assert.equal(
    normalizeEmergencyPlan({ ...draft(), audience: "staff" }).sectionId,
    null,
  );
  assert.equal(
    normalizeEmergencyPlan({ ...draft(), audience: "section", sectionId: id() })
      .audience,
    "section",
  );
  assert.equal(
    normalizeEmergencyPlan({
      ...draft(),
      audience: "site",
      accommodationId: id(),
    }).audience,
    "site",
  );
  assert.throws(
    () => normalizeEmergencyPlan({ ...draft(), audience: "section" }),
    /exactly one section/u,
  );
  assert.throws(
    () =>
      normalizeEmergencyPlan({
        ...draft(),
        audience: "staff",
        sectionId: id(),
      }),
    /cannot contain/u,
  );
  assert.throws(
    () =>
      normalizeEmergencyPlan({
        ...draft(),
        audience: "site",
        accommodationId: id(),
        sectionId: id(),
      }),
    /exactly one accommodation/u,
  );
  assert.throws(
    () => normalizeEmergencyPlan({ ...draft(), severity: "unknown" }),
    /severity/u,
  );
  assert.throws(
    () => normalizeEmergencyPlan({ ...draft(), message: "no" }),
    /Audience message/u,
  );
});

test("independent approval and manual handoff require distinct explicit evidence", () => {
  assert.equal(normalizeEmergencyDecision(decision()).kind, "approve");
  assert.throws(
    () =>
      normalizeEmergencyDecision({ ...decision(), boundaryAcknowledged: "" }),
    /acknowledgements/u,
  );
  assert.throws(
    () => normalizeEmergencyDecision({ ...decision(), onsitePlanChecked: "" }),
    /acknowledgements/u,
  );
  assert.throws(
    () =>
      normalizeEmergencyDecision({
        ...decision(),
        kind: "manual_handoff",
        method: "",
      }),
    /method/u,
  );
  assert.throws(
    () =>
      normalizeEmergencyDecision({
        ...decision(),
        kind: "manual_handoff",
        method: "onsite_pa",
      }),
    /evidence reference/u,
  );
  assert.equal(
    normalizeEmergencyDecision({
      ...decision(),
      kind: "manual_handoff",
      method: "onsite_pa",
      evidenceReference: "SAMPLE-LOG-086",
    }).method,
    "onsite_pa",
  );
  assert.throws(
    () =>
      normalizeEmergencyDecision({
        ...decision(),
        kind: "cancel",
        method: "onsite_pa",
      }),
    /Only a manual handoff/u,
  );
});

test("database and operator UI preserve emergency-services boundary", () => {
  const migration = readFileSync(
    new URL(
      "../database/migrations/0117_emergency_communication_guardrails.sql",
      import.meta.url,
    ),
    "utf8",
  );
  const page = readFileSync(
    new URL(
      "../app/workspaces/management/campgrounds/emergency-notices/page.tsx",
      import.meta.url,
    ),
    "utf8",
  );
  assert.match(migration, /actor=plan\.created_by_user_id/u);
  assert.match(migration, /lifecycle_state='active'/u);
  assert.match(migration, /real_world_boundary_ack and onsite_plan_checked/u);
  assert.match(migration, /force row level security/gu);
  assert.match(migration, /emergency_notice_events_immutable/u);
  assert.match(page, /iCamp does not call responders/u);
  assert.match(page, /No automated delivery or receipt is asserted/u);
  assert.doesNotMatch(page, /fetch\(|sendSMS|dispatchEmergency/u);
});
