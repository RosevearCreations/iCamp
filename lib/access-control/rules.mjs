const SUBJECT_KINDS = new Set([
  "guest",
  "visitor",
  "staff",
  "contractor",
  "camper",
  "event",
]);

function parseLocalTimestamp(value) {
  const match = String(value ?? "").match(
    /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})(?::(\d{2}))?$/,
  );

  if (!match) {
    throw new Error("localTimestamp must be YYYY-MM-DDTHH:mm[:ss]");
  }

  const [, year, month, day, hour, minute, second = "00"] = match;
  const date = new Date(
    Date.UTC(
      Number(year),
      Number(month) - 1,
      Number(day),
      Number(hour),
      Number(minute),
      Number(second),
    ),
  );

  if (
    date.getUTCFullYear() !== Number(year) ||
    date.getUTCMonth() !== Number(month) - 1 ||
    date.getUTCDate() !== Number(day)
  ) {
    throw new Error("localTimestamp contains an invalid calendar date");
  }

  return {
    date: `${year}-${month}-${day}`,
    weekday: date.getUTCDay(),
    seconds:
      Number(hour) * 3600 + Number(minute) * 60 + Number(second),
  };
}

function timeToSeconds(value) {
  const match = String(value ?? "").match(/^(\d{2}):(\d{2})(?::(\d{2}))?$/);
  if (!match) throw new Error("Schedule time is invalid");
  return Number(match[1]) * 3600 + Number(match[2]) * 60 + Number(match[3] ?? 0);
}

export function scheduleMatches(schedule, localTimestamp) {
  if (!schedule?.isActive) return false;

  const local = parseLocalTimestamp(localTimestamp);
  const weekdays = schedule.weekdays ?? [0, 1, 2, 3, 4, 5, 6];

  if (!weekdays.includes(local.weekday)) return false;
  if (schedule.validFrom && local.date < schedule.validFrom) return false;
  if (schedule.validUntil && local.date > schedule.validUntil) return false;

  const start = timeToSeconds(schedule.startLocal ?? "00:00:00");
  const end = timeToSeconds(schedule.endLocal ?? "23:59:59");

  if (start <= end) {
    return local.seconds >= start && local.seconds <= end;
  }

  return local.seconds >= start || local.seconds <= end;
}

export function normalizeAccessContext(input) {
  const subjectKind = String(input.subjectKind ?? "").trim().toLowerCase();
  if (!SUBJECT_KINDS.has(subjectKind)) {
    throw new Error("Unsupported access subject kind");
  }

  const eventReference =
    input.eventReference == null ? null : String(input.eventReference).trim();

  if (eventReference != null && (eventReference.length < 1 || eventReference.length > 160)) {
    throw new Error("eventReference must be 1-160 characters");
  }

  return {
    subjectKind,
    activeStay: input.activeStay === true,
    eventReference,
    localTimestamp: String(input.localTimestamp ?? ""),
  };
}

function ruleMatches(rule, context, schedulesById) {
  if (!rule?.isActive) return false;
  if (rule.subjectKind !== "any" && rule.subjectKind !== context.subjectKind) {
    return false;
  }
  if (rule.eventReference && rule.eventReference !== context.eventReference) {
    return false;
  }
  if (rule.requireActiveStay && !context.activeStay) return false;

  if (rule.scheduleId) {
    const schedule = schedulesById.get(rule.scheduleId);
    if (!schedule || !scheduleMatches(schedule, context.localTimestamp)) {
      return false;
    }
  }

  return true;
}

export function evaluateZoneAccess({
  zone,
  rules,
  schedules = [],
  context: rawContext,
}) {
  const context = normalizeAccessContext(rawContext);

  if (!zone?.isActive) {
    return { allowed: false, reason: "zone_inactive", ruleId: null };
  }

  if (zone.zoneKind === "camper_only" && !context.activeStay) {
    return { allowed: false, reason: "active_stay_required", ruleId: null };
  }

  if (zone.zoneKind === "event" && !context.eventReference) {
    return { allowed: false, reason: "event_context_required", ruleId: null };
  }

  if (zone.zoneKind === "staff" && !["staff", "contractor"].includes(context.subjectKind)) {
    return { allowed: false, reason: "staff_or_contractor_required", ruleId: null };
  }

  const schedulesById = new Map(schedules.map((item) => [item.id, item]));
  const matching = (rules ?? [])
    .filter((rule) => ruleMatches(rule, context, schedulesById))
    .sort((a, b) => {
      if (b.priority !== a.priority) return b.priority - a.priority;
      if (a.effect !== b.effect) return a.effect === "deny" ? -1 : 1;
      return String(a.id).localeCompare(String(b.id));
    });

  const winner = matching[0];
  if (!winner) {
    return { allowed: false, reason: "no_matching_allow_rule", ruleId: null };
  }

  return {
    allowed: winner.effect === "allow",
    reason: winner.decisionReason,
    ruleId: winner.id,
  };
}
