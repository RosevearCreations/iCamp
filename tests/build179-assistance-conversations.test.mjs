import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

import {
  guestAssistanceProgress,
  normalizeAssistanceReply,
} from "../lib/assistance-conversations/core.mjs";
import { validateMediaUpload } from "../lib/media/validation.mjs";

const request = {
  id: "request-1",
  summary: "No water at site",
  severity: "urgent",
  category: "water",
  submittedAt: "2026-10-30T09:00:00Z",
};

const exampleMessageId = "00000000-0000-4000-8000-000000000001";

test("Build179 guest reply validation requires an idempotency UUID and meaningful bounded content", () => {
  assert.deepEqual(
    normalizeAssistanceReply({
      clientMessageId: exampleMessageId,
      message: "  Still no water.  ",
    }),
    {
      clientMessageId: exampleMessageId,
      message: "Still no water.",
    },
  );
  for (const value of ["", "x", "ab", "a".repeat(2001), "hello\u0000world"]) {
    assert.throws(() =>
      normalizeAssistanceReply({
        clientMessageId: exampleMessageId,
        message: value,
      }),
    );
  }
  assert.throws(() =>
    normalizeAssistanceReply({
      clientMessageId: "not-a-uuid",
      message: "Hello",
    }),
  );
});

test("Build179 guest timeline orders only provided guest-visible events; urgency is not dispatch", () => {
  const view = guestAssistanceProgress({
    request,
    update: {
      requestId: request.id,
      caseState: "escalated",
      severity: "urgent",
      escalationLevel: "manager",
      assigned: true,
      updates: [
        {
          id: "staff-1",
          eventKind: "guest_message",
          occurredAt: "2026-10-30T11:00:00Z",
          summary: "We are reviewing it.",
        },
        {
          id: "guest-1",
          eventKind: "guest_reply",
          occurredAt: "2026-10-30T10:00:00Z",
          summary: "There is no pressure.",
        },
      ],
    },
  });
  assert.equal(view.urgent, true);
  assert.equal(view.escalation, "manager");
  assert.equal(view.assignment, "Assigned to campground staff");
  assert.equal(view.canReply, true);
  assert.deepEqual(
    view.events.map((x) => x.id),
    ["submitted-request-1", "guest-1", "staff-1"],
  );
  assert.deepEqual(
    view.events.map((x) => x.actor),
    ["You", "You", "Campground team"],
  );
});

test("Build179 closed cases are read-only; missing staff case is not mistaken for closed", () => {
  const missing = guestAssistanceProgress({ request, update: null });
  assert.equal(missing.canReply, false);
  assert.equal(missing.caseState, "submitted");
  const closed = guestAssistanceProgress({
    request,
    update: {
      caseState: "closed",
      assigned: false,
      escalationLevel: "none",
      severity: "routine",
      updates: [],
    },
  });
  assert.equal(closed.closed, true);
  assert.equal(closed.canReply, false);
  assert.equal(closed.urgent, false);
});

test("Build179 rejects unsafe attachments using existing internal media validation", () => {
  const invalid = validateMediaUpload({
    classification: "internal",
    filename: "suspicious.pdf",
    contentType: "application/pdf",
    byteSize: 100,
    headerBytes: new Uint8Array([0x4d, 0x5a, 0x00]),
  });
  assert.equal(invalid.ok, false);
  const valid = validateMediaUpload({
    classification: "internal",
    filename: "evidence.pdf",
    contentType: "application/pdf",
    byteSize: 100,
    headerBytes: new Uint8Array([37, 80, 68, 70, 45, 49]),
  });
  assert.equal(valid.ok, true);
});

test("Build179 SQL keeps guest replies owner-scoped, append-only and idempotent", () => {
  const sql = readFileSync(
    new URL(
      "../database/migrations/0189_build179_assistance_in_app_guest_reply.sql",
      import.meta.url,
    ),
    "utf8",
  );
  assert.match(sql, /create policy camper_assistance_case_guest_reply_insert/u);
  assert.match(sql, /r\.guest_user_id=icamp_private\.request_user_id\(\)/u);
  assert.match(sql, /c\.case_state<>'closed'/u);
  assert.match(sql, /build179_guard_guest_reply/u);
  assert.match(sql, /camper_assistance_guest_reply_idempotency_idx/u);
  assert.match(sql, /metadata->>'deliveryMode'='in_app_only'/u);
  assert.doesNotMatch(sql, /grant\s+insert[\s\S]+to\s+(anon|authenticated)/iu);
  const eventsMigration = readFileSync(
    new URL(
      "../database/migrations/0101_assistance_triage_management_escalation.sql",
      import.meta.url,
    ),
    "utf8",
  );
  assert.match(eventsMigration, /camper_assistance_case_events_append_only/u);
});

test("Build179 guest progress redacts staff-only triage and escalation reasons", () => {
  const source = readFileSync(
    new URL("../lib/camper-assistance-triage/postgres.mjs", import.meta.url),
    "utf8",
  );
  const guestReader = source.slice(
    source.indexOf("export async function listGuestAssistanceUpdates"),
  );
  assert.match(guestReader, /where r\.guest_user_id=\$1/u);
  assert.match(guestReader, /case when e\.guest_visible then e\.summary/u);
  assert.match(
    guestReader,
    /when e\.event_kind='triaged' then 'Campground staff reviewed the case\.'/u,
  );
  assert.match(guestReader, /e\.guest_visible=true or e\.event_kind in/u);
  assert.doesNotMatch(guestReader, /staff_note'/u);
});

test("Build179 server mutations and evidence links require auth, roles and owner checks", () => {
  const service = readFileSync(
    new URL("../lib/assistance-conversations/postgres.mjs", import.meta.url),
    "utf8",
  );
  const guest = readFileSync(
    new URL("../app/guest/assistance/actions.ts", import.meta.url),
    "utf8",
  );
  const staff = readFileSync(
    new URL(
      "../app/workspaces/management/campgrounds/assistance/actions.ts",
      import.meta.url,
    ),
    "utf8",
  );
  const media = readFileSync(
    new URL(
      "../app/guest/assistance/media/[mediaId]/route.ts",
      import.meta.url,
    ),
    "utf8",
  );
  assert.match(service, /r\.guest_user_id=\$2/u);
  assert.match(service, /select c\.id,c\.case_state/u);
  assert.match(service, /on conflict do nothing returning/u);
  assert.match(service, /appendAuditEvent/u);
  assert.match(guest, /await guestSession\(path\)/u);
  assert.match(staff, /"assistance.communicate"/u);
  assert.match(staff, /channel: "in_app"/u);
  assert.match(media, /await getCurrentSession\(\)/u);
  assert.match(media, /ownsAssistanceMedia/u);
  assert.match(
    media,
    /hasCampgroundPermission\(\s*session\.user\.id,\s*asset\.campgroundId,\s*"media.read"/u,
  );
  assert.doesNotMatch(
    service + guest + staff + media,
    /sendSms\(|sendEmail\(|dispatchEmergency\(/u,
  );
});
