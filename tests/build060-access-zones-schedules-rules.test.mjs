import assert from "node:assert/strict";
import test from "node:test";

import {
  evaluateZoneAccess,
  scheduleMatches,
} from "../lib/access-control/rules.mjs";

test("matches normal and overnight weekly schedule windows", () => {
  assert.equal(
    scheduleMatches(
      {
        isActive: true,
        weekdays: [1],
        startLocal: "08:00:00",
        endLocal: "17:00:00",
      },
      "2026-10-19T10:30:00",
    ),
    true,
  );

  assert.equal(
    scheduleMatches(
      {
        isActive: true,
        weekdays: [1],
        startLocal: "22:00:00",
        endLocal: "06:00:00",
      },
      "2026-10-19T23:30:00",
    ),
    true,
  );
});

test("camper-only zones require an active stay before rule evaluation", () => {
  const result = evaluateZoneAccess({
    zone: { isActive: true, zoneKind: "camper_only" },
    rules: [
      {
        id: "allow-any",
        priority: 10,
        effect: "allow",
        subjectKind: "any",
        decisionReason: "general allow",
        isActive: true,
      },
    ],
    context: {
      subjectKind: "guest",
      activeStay: false,
      localTimestamp: "2026-10-19T12:00:00",
    },
  });

  assert.deepEqual(result, {
    allowed: false,
    reason: "active_stay_required",
    ruleId: null,
  });
});

test("event zones require event context and can restrict a specific event", () => {
  const result = evaluateZoneAccess({
    zone: { isActive: true, zoneKind: "event" },
    rules: [
      {
        id: "event-allow",
        priority: 100,
        effect: "allow",
        subjectKind: "visitor",
        eventReference: "fall-fair-2026",
        decisionReason: "registered event access",
        isActive: true,
      },
    ],
    context: {
      subjectKind: "visitor",
      activeStay: false,
      eventReference: "fall-fair-2026",
      localTimestamp: "2026-10-19T12:00:00",
    },
  });

  assert.equal(result.allowed, true);
  assert.equal(result.ruleId, "event-allow");
});

test("higher priority deny wins and deny wins a priority tie", () => {
  const result = evaluateZoneAccess({
    zone: { isActive: true, zoneKind: "general" },
    rules: [
      {
        id: "allow",
        priority: 100,
        effect: "allow",
        subjectKind: "visitor",
        decisionReason: "visitor hours",
        isActive: true,
      },
      {
        id: "deny",
        priority: 100,
        effect: "deny",
        subjectKind: "visitor",
        decisionReason: "temporary restriction",
        isActive: true,
      },
    ],
    context: {
      subjectKind: "visitor",
      localTimestamp: "2026-10-19T12:00:00",
    },
  });

  assert.deepEqual(result, {
    allowed: false,
    reason: "temporary restriction",
    ruleId: "deny",
  });
});

test("scheduled staff and contractor rule applies only inside window", () => {
  const schedule = {
    id: "business-hours",
    isActive: true,
    weekdays: [1, 2, 3, 4, 5],
    startLocal: "07:00:00",
    endLocal: "19:00:00",
  };

  const rules = [
    {
      id: "contractor-hours",
      scheduleId: "business-hours",
      priority: 50,
      effect: "allow",
      subjectKind: "contractor",
      decisionReason: "contractor service window",
      isActive: true,
    },
  ];

  assert.equal(
    evaluateZoneAccess({
      zone: { isActive: true, zoneKind: "service" },
      rules,
      schedules: [schedule],
      context: {
        subjectKind: "contractor",
        localTimestamp: "2026-10-19T10:00:00",
      },
    }).allowed,
    true,
  );

  assert.equal(
    evaluateZoneAccess({
      zone: { isActive: true, zoneKind: "service" },
      rules,
      schedules: [schedule],
      context: {
        subjectKind: "contractor",
        localTimestamp: "2026-10-19T20:00:00",
      },
    }).allowed,
    false,
  );
});

test("default decision is deny when no active allow rule matches", () => {
  const result = evaluateZoneAccess({
    zone: { isActive: true, zoneKind: "general" },
    rules: [],
    context: {
      subjectKind: "guest",
      localTimestamp: "2026-10-19T12:00:00",
    },
  });

  assert.deepEqual(result, {
    allowed: false,
    reason: "no_matching_allow_rule",
    ruleId: null,
  });
});
