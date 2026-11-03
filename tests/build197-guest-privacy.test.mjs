import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import {
  buildOwnPrivacyExport,
  isPrivacyTerminal,
  normalizePrivacyRequest,
  normalizePrivacyReview,
} from "../lib/guest-privacy/core.mjs";

test("Build197 only accepts privacy request categories, never arbitrary guest narrative", () => {
  assert.deepEqual(
    normalizePrivacyRequest({
      requestKind: "erasure_review",
      subjectArea: "stays",
      notes: "secret",
    }),
    {
      requestKind: "erasure_review",
      subjectArea: "stays",
    },
  );
  assert.throws(
    () =>
      normalizePrivacyRequest({
        requestKind: "delete_now",
        subjectArea: "all",
      }),
    /supported/,
  );
  assert.throws(
    () =>
      normalizePrivacyRequest({
        requestKind: "access",
        subjectArea: "everyone",
      }),
    /supported/,
  );
});

test("Build197 human review requires safe external ticket references for terminal outcomes", () => {
  assert.deepEqual(
    normalizePrivacyReview({ eventKind: "retention_hold_review" }),
    {
      eventKind: "retention_hold_review",
      outcomeCode: "legal_hold_review",
      sourceReference: null,
    },
  );
  assert.throws(
    () =>
      normalizePrivacyReview({
        eventKind: "closed_no_action",
        sourceReference: "",
      }),
    /source ticket/,
  );
  assert.throws(
    () =>
      normalizePrivacyReview({
        eventKind: "manual_action_required",
        sourceReference: "contact:private@example.com",
      }),
    /source ticket/,
  );
  assert.throws(
    () => normalizePrivacyReview({ eventKind: "deleted" }),
    /supported/,
  );
  assert.equal(isPrivacyTerminal("closed_no_action"), true);
  assert.equal(isPrivacyTerminal("retention_hold_review"), false);
  assert.equal(isPrivacyTerminal("manual_action_required"), false);
  assert.equal(isPrivacyTerminal("fulfilled_external"), true);
  assert.equal(
    normalizePrivacyReview({
      eventKind: "manual_action_required",
      sourceReference: "CASE-12345",
    }).sourceReference,
    "CASE-12345",
  );
});

test("Build197 own export is hashed, bounded, private and excludes unrelated source-event notes", () => {
  const input = {
    campgroundId: "camp-1",
    campgroundName: "Sample camp",
    exportedAt: "2026-11-03T00:00:00.000Z",
    detail: {
      profile: {
        id: "profile1",
        firstName: "Test",
        contactEmail: "guest@example.com",
      },
      rvs: [],
      vehicles: [],
      pets: [],
      stays: [],
      receipts: [],
      seasonalAssignments: [],
      events: [
        { summary: "sensitive staff note", metadata: { private: "bad" } },
      ],
    },
    privacy: { requests: [], consentHistory: [], truncated: false },
    records: {
      stays: [{ id: "account-linked cancelled", status: "cancelled" }],
      receipts: [],
      truncated: true,
    },
  };
  const { bytes, sha256 } = buildOwnPrivacyExport(input);
  const result = JSON.parse(bytes.toString("utf8"));
  assert.equal(sha256.length, 64);
  assert.equal(result.coverage.incomplete, true);
  assert.equal(result.stayHistory[0].status, "cancelled");
  assert.equal(result.retention.automaticErasureEnabled, false);
  assert.equal(result.retention.scheduleEstablished, false);
  assert.equal(result.savedProfile.contactEmail, "guest@example.com");
  assert.doesNotMatch(
    bytes.toString("utf8"),
    /sensitive staff note|private.*bad/,
  );
  assert.equal(buildOwnPrivacyExport(input).sha256, sha256);
});

test("Build197 database contract forces tenant RLS, immutable evidence and bounded guest scope", () => {
  const sql = readFileSync(
    new URL(
      "../database/migrations/0211_build197_guest_privacy_requests.sql",
      import.meta.url,
    ),
    "utf8",
  );
  assert.match(sql, /guest_privacy_requests force row level security/i);
  assert.match(sql, /guest_privacy_request_events force row level security/i);
  assert.match(sql, /guest_privacy_event_insert_guard/);
  assert.match(sql, /guest_privacy_requests_immutable/);
  assert.match(sql, /guest_privacy_has_scope/);
  assert.match(sql, /guest_user_id=\(select nullif\(current_setting/);
  assert.doesNotMatch(sql, /delete from .*guest_privacy_requests/i);
});
