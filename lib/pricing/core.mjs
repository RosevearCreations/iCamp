const DAY_MS = 86400000;

function asDate(value, label) {
  const text = String(value ?? "").trim();
  if (!/^\d{4}-\d{2}-\d{2}$/u.test(text))
    throw new Error(label + " must use YYYY-MM-DD.");
  const date = new Date(text + "T00:00:00Z");
  if (Number.isNaN(date.getTime()) || date.toISOString().slice(0, 10) !== text)
    throw new Error(label + " is invalid.");
  return date;
}

function dateText(date) {
  return date.toISOString().slice(0, 10);
}

function nightsBetween(a, b) {
  return Math.round((b.getTime() - a.getTime()) / DAY_MS);
}

function isoDay(date) {
  const day = date.getUTCDay();
  return day === 0 ? 7 : day;
}

function inRange(day, start, end) {
  return (!start || day >= start) && (!end || day <= end);
}

function cents(value) {
  const number = Number(value);
  return Number.isInteger(number) && number >= 0 ? number : null;
}

export function selectRatePlan({
  plans = [],
  accommodationId,
  accommodationKind,
  arrivalDate,
  departureDate,
}) {
  const arrival = dateText(asDate(arrivalDate, "Arrival date"));
  const departure = dateText(asDate(departureDate, "Departure date"));
  return (
    plans
      .filter(
        (plan) =>
          plan.isActive !== false &&
          plan.startsOn <= arrival &&
          plan.endsOn >= departure,
      )
      .filter(
        (plan) =>
          String(plan.accommodationId ?? "") ===
            String(accommodationId ?? "") ||
          (!plan.accommodationId &&
            plan.accommodationKind === accommodationKind),
      )
      .sort((a, b) => {
        const aSpecific = a.accommodationId ? 1 : 0;
        const bSpecific = b.accommodationId ? 1 : 0;
        if (aSpecific !== bSpecific) return bSpecific - aSpecific;
        return Number(a.priority ?? 100) - Number(b.priority ?? 100);
      })[0] ?? null
  );
}

function unitBase(plan, nights) {
  let remaining = nights;
  let total = 0;

  const use = (size, key) => {
    const amount = cents(plan[key]);
    if (amount === null || remaining < size) return;
    const count = Math.floor(remaining / size);
    total += count * amount;
    remaining -= count * size;
  };

  use(365, "yearlyCents");
  use(30, "monthlyCents");
  use(7, "weeklyCents");

  const nightly = cents(plan.nightlyCents);
  if (remaining > 0) {
    if (nightly === null) return null;
    total += remaining * nightly;
  }
  return total;
}

function matchesRule(rule, { day, weekend, periods }) {
  if (rule.isActive === false) return false;
  if (rule.ruleKind === "weekend") return weekend;
  if (rule.calendarPeriodId)
    return periods.some((period) => period.id === rule.calendarPeriodId);
  return inRange(day, rule.startsOn ?? null, rule.endsOn ?? null);
}

export function quoteAccommodationStay({
  plans = [],
  rules = [],
  periods = [],
  weekendIsoDays = [6, 7],
  accommodationId,
  accommodationKind,
  arrivalDate,
  departureDate,
}) {
  const arrival = asDate(arrivalDate, "Arrival date");
  const departure = asDate(departureDate, "Departure date");
  const nights = nightsBetween(arrival, departure);
  if (nights < 1) throw new Error("Departure must be after arrival.");

  const plan = selectRatePlan({
    plans,
    accommodationId,
    accommodationKind,
    arrivalDate,
    departureDate,
  });
  if (!plan) {
    return {
      status: "unavailable",
      nights,
      currencyCode: null,
      totalCents: null,
      plan: null,
      adjustments: [],
    };
  }

  const base = unitBase(plan, nights);
  if (base === null) {
    return {
      status: "unavailable",
      nights,
      currencyCode: plan.currencyCode,
      totalCents: null,
      plan,
      adjustments: [],
    };
  }

  const nightly = cents(plan.nightlyCents);
  const adjustments = [];
  let adjustmentTotal = 0;

  for (let index = 0; index < nights; index += 1) {
    const date = new Date(arrival.getTime() + index * DAY_MS);
    const day = dateText(date);
    const matchingPeriods = periods.filter(
      (period) =>
        period.isActive !== false &&
        period.startsOn <= day &&
        period.endsOn >= day,
    );
    const weekend = weekendIsoDays.map(Number).includes(isoDay(date));
    const matchingRules = rules
      .filter((rule) => String(rule.ratePlanId) === String(plan.id))
      .sort((a, b) => Number(a.priority ?? 100) - Number(b.priority ?? 100));

    for (const rule of matchingRules) {
      if (!matchesRule(rule, { day, weekend, periods: matchingPeriods }))
        continue;
      const percent = Number(rule.adjustmentPercent ?? 0);
      const fixed = Number(rule.adjustmentCents ?? 0);
      const reference = nightly ?? Math.round(base / nights);
      const delta = Math.round(reference * (percent / 100)) + fixed;
      adjustmentTotal += delta;
      adjustments.push({
        date: day,
        code: rule.code,
        displayName: rule.displayName,
        deltaCents: delta,
      });
    }
  }

  return {
    status: "quoted",
    nights,
    currencyCode: plan.currencyCode,
    baseCents: base,
    adjustmentCents: adjustmentTotal,
    totalCents: Math.max(0, base + adjustmentTotal),
    plan: {
      id: plan.id,
      code: plan.code,
      displayName: plan.displayName,
    },
    adjustments,
  };
}

export function formatMoney(centsValue, currencyCode = "CAD") {
  const value = Number(centsValue);
  if (!Number.isFinite(value)) return "Rate unavailable";
  return new Intl.NumberFormat("en-CA", {
    style: "currency",
    currency: currencyCode,
  }).format(value / 100);
}
