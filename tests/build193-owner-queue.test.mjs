import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
const source = (path) => readFileSync(new URL("../" + path, import.meta.url), "utf8");

test("Build 193 renewal interests remain immutable, scoped and versioned", () => {
  const sql = source("database/migrations/0207_build193_seasonal_owner_queue.sql");
  assert.match(sql, /force row level security/i);
  assert.match(sql, /unique\(assignment_id,term_version\)/i);
  assert.match(sql, /base_assignment_version<>a\.row_version/i);
  assert.match(sql, /current_term_ends_on<>a\.ends_on/i);
  assert.match(sql, /on delete restrict/i);
  assert.match(sql, /seasonal_owner_immutable/i);
  assert.match(sql, /recorded_by_user_id is distinct from/i);
});
test("Build 193 owner acknowledgement is independent and cannot reopen site safety", () => {
  const sql = source("database/migrations/0207_build193_seasonal_owner_queue.sql");
  assert.match(sql, /author=task_row\.created_by_user_id/i);
  assert.match(sql, /seasonal\.owner\.review/i);
  assert.doesNotMatch(sql, /update\s+public\.(accommodations|seasonal_assignments|spring_reopening_decisions)/i);
  assert.doesNotMatch(sql, /payment_processor|send_sms|send_email|gate_open/i);
});
test("Build 193 queue shows current-source safety deficits and in-app handoff only", () => {
  const readback = source("lib/seasonal-owner-queue/postgres.mjs");
  assert.match(readback, /winter_year=extract\(year from statement_timestamp\(\)\)/i);
  assert.match(readback, /winter_close_event_id=/);
  assert.match(readback, /unresolved site work order/);
  assert.match(readback, /stale against assignment terms/);
  const page = source("app/workspaces/management/campgrounds/seasonal/owner-queue/page.tsx");
  assert.match(page, /requireStaff/);
  assert.match(page, /NOT READY/);
  assert.match(page, /outbound IVR, SMS and MMS remain disconnected/);
  assert.match(page, /no assignment is marked ready/i);
});
