import test from "node:test";
import assert from "node:assert/strict";
import {
  supportSla266,
  RESPONSE_TARGET_HOURS266,
} from "../lib/campground-support266/sla.mjs";
test("Build266 severity targets and original timestamps", () => {
  assert.deepEqual(RESPONSE_TARGET_HOURS266, {
    critical: 1,
    priority: 8,
    routine: 48,
  });
  const r = supportSla266(
    [
      {
        severity: "critical",
        status: "open",
        created_at: "2026-11-19T10:00:00Z",
      },
      {
        severity: "priority",
        status: "triaged",
        created_at: "2026-11-19T01:00:00Z",
        reviewed_at: "2026-11-19T02:00:00Z",
      },
      {
        severity: "routine",
        status: "resolved",
        created_at: "2026-11-18T00:00:00Z",
      },
      { severity: "critical", status: "open", created_at: "invalid" },
    ],
    new Date("2026-11-19T12:00:00Z"),
  );
  assert.equal(r.overdueResponse, 1);
  assert.equal(r.responseObserved, 1);
  assert.equal(r.missingTimestamp, 1);
  assert.equal(r.unresolved, 3);
});
test("Build266 missing/invalid evidence is not claimed as response", () => {
  const x = supportSla266(
    [
      {
        severity: "priority",
        status: "open",
        createdAt: "2026-11-19T11:00:00Z",
        reviewedAt: "2026-11-19T09:00:00Z",
      },
    ],
    new Date("2026-11-19T12:00:00Z"),
  );
  assert.equal(x.responseObserved, 0);
  assert.equal(x.responseUnknown, 1);
  assert.equal(x.overdueResponse, 0);
});
