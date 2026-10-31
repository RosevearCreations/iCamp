import {
  FORECAST_SCENARIOS,
  FORECAST_WINDOWS,
} from "./capacity-forecast-core.mjs";

export const FORECAST_SAVED_LIMIT = 8;
export const FORECAST_ACTIVITY_LIMIT = 12;

// SHA-256 identifies the exact downloaded bytes; it does not authenticate
// the source or act as a signature. Uses Web Crypto in a secure browser.
export async function sha256Hex(contents) {
  if (typeof contents !== "string") {
    throw new Error("SHA-256 is unavailable in this browser.");
  }
  return sha256ArrayBuffer(new TextEncoder().encode(contents).buffer);
}

export async function sha256ArrayBuffer(bytes) {
  if (!(bytes instanceof ArrayBuffer) || !globalThis.crypto?.subtle) {
    throw new Error("SHA-256 is unavailable in this browser.");
  }
  const digest = await globalThis.crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(digest), (byte) =>
    byte.toString(16).padStart(2, "0"),
  ).join("");
}

// Accept a plain digest or a conventional sha256sum companion line. If a
// companion includes a filename, it must match the chosen file exactly.
export function parseExpectedSha256(raw, filename) {
  if (typeof raw !== "string" || raw.length > 220) {
    throw new Error("Enter a valid SHA-256 checksum.");
  }
  const value = raw.trim();
  const match = value.match(/^([a-f0-9]{64})(?:  \*?([^\r\n]+))?$/i);
  if (!match || (match[2] && match[2] !== filename)) {
    throw new Error(
      "Checksum or companion filename does not match the selected file.",
    );
  }
  return match[1].toLowerCase();
}

// Hash the actual file bytes, not file.text() (which could normalize an
// invalid UTF-8 sequence). Match alone does not establish trusted provenance.
export async function verifyExportChecksum(bytes, expected, filename) {
  const expectedSha256 = parseExpectedSha256(expected, filename);
  const actualSha256 = await sha256ArrayBuffer(bytes);
  return {
    actualSha256,
    expectedSha256,
    matches: actualSha256 === expectedSha256,
  };
}

// A trusted comparison is optional for local preference recovery, but an
// unverified restore must be an explicit exception—not the default click path.
// A checksum can show byte equality; it cannot authenticate a publisher.
export function reviewRecoveryChecksum(
  actualSha256,
  expectedRaw,
  acknowledged,
) {
  if (!/^[a-f0-9]{64}$/.test(actualSha256 ?? "")) {
    return {
      status: "unavailable",
      canRestore: false,
      guidance: "Calculate the backup checksum before reviewing recovery.",
    };
  }
  const expected = typeof expectedRaw === "string" ? expectedRaw.trim() : "";
  if (!expected) {
    return {
      status: "unverified",
      canRestore: acknowledged === true,
      guidance:
        acknowledged === true
          ? "Unverified local restore exception acknowledged. No file origin or owner approval was established."
          : "No trusted digest supplied. Review this exception and explicitly acknowledge the unverified origin before local restore.",
    };
  }
  if (!/^[a-f0-9]{64}$/i.test(expected)) {
    return {
      status: "invalid_digest",
      canRestore: false,
      guidance:
        "A trusted digest must contain exactly 64 hexadecimal characters.",
    };
  }
  if (expected.toLowerCase() !== actualSha256) {
    return {
      status: "mismatch",
      canRestore: false,
      guidance:
        "Checksum mismatch. Recovery is blocked; inspect the independently obtained source before trying another file.",
    };
  }
  return {
    status: "match",
    canRestore: true,
    guidance:
      "Checksum matches the supplied digest. Byte equality does not verify who created or approved this backup.",
  };
}

// Store only bounded operator activity metadata in the scoped browser store.
// Never persist CSV rows, booking figures, backup contents or file names.
export function parseForecastActivityHistory(raw) {
  if (typeof raw !== "string" || raw.length > 6_000) return [];
  try {
    const payload = JSON.parse(raw);
    if (payload.version !== 1 || !Array.isArray(payload.events)) return [];
    return payload.events
      .slice(0, FORECAST_ACTIVITY_LIMIT)
      .filter(
        (item) =>
          item &&
          [
            "backup",
            "comparison_csv",
            "recovery",
            "verification_match",
            "verification_mismatch",
            "recovery_exception",
          ].includes(item.action) &&
          typeof item.occurredAt === "string" &&
          Number.isFinite(Date.parse(item.occurredAt)) &&
          Number.isInteger(item.viewCount) &&
          item.viewCount >= 0 &&
          item.viewCount <= FORECAST_SAVED_LIMIT &&
          typeof item.sha256 === "string" &&
          /^[a-f0-9]{64}$/.test(item.sha256),
      )
      .map(({ action, occurredAt, viewCount, sha256 }) => ({
        action,
        occurredAt,
        viewCount,
        sha256,
      }));
  } catch {
    return [];
  }
}

export function recordForecastActivity(history, event) {
  const validated = parseForecastActivityHistory(
    JSON.stringify({ version: 1, events: [event] }),
  );
  if (validated.length !== 1) throw new Error("Invalid activity metadata.");
  return [validated[0], ...history].slice(0, FORECAST_ACTIVITY_LIMIT);
}

export function serializeForecastActivityHistory(history) {
  return JSON.stringify({ version: 1, events: history });
}

export function normalizeSavedForecastView(input) {
  if (!input || typeof input !== "object") return null;
  const label = typeof input.label === "string" ? input.label.trim() : "";
  if (
    !label ||
    label.length > 48 ||
    !FORECAST_WINDOWS.includes(input.lookbackMonths) ||
    !FORECAST_SCENARIOS.includes(input.scenario)
  ) {
    return null;
  }
  return {
    key: `${input.lookbackMonths}:${input.scenario}`,
    label,
    lookbackMonths: input.lookbackMonths,
    scenario: input.scenario,
  };
}

// Only labels and validated filter choices are stored; never booking data,
// occupancy figures, campground names or evidence records.
export function parseSavedForecastViews(raw) {
  if (typeof raw !== "string" || raw.length > 8_000) return [];
  try {
    const payload = JSON.parse(raw);
    if (payload.version !== 1 || !Array.isArray(payload.views)) return [];
    const unique = new Set();
    const views = [];
    for (const item of payload.views.slice(0, FORECAST_SAVED_LIMIT)) {
      const normalized = normalizeSavedForecastView(item);
      if (normalized && !unique.has(normalized.key)) {
        unique.add(normalized.key);
        views.push(normalized);
      }
    }
    return views;
  } catch {
    return [];
  }
}

export function upsertSavedForecastView(views, input) {
  const next = normalizeSavedForecastView(input);
  if (!next) throw new Error("Enter a name and supported scenario filters.");
  const existing = views.filter((view) => view.key !== next.key);
  if (existing.length >= FORECAST_SAVED_LIMIT) {
    throw new Error("Remove a saved view before adding another.");
  }
  return [...existing, next];
}

export function serializeSavedForecastViews(views) {
  return JSON.stringify({ version: 1, views });
}

// An opt-in portable backup includes the authorized user/campground scope,
// so a recovery file cannot accidentally overwrite another scoped view list.
export function createSavedForecastBackup(views, { userId, campgroundId }) {
  if (!userId || !campgroundId || views.length > FORECAST_SAVED_LIMIT) {
    throw new Error("Invalid backup scope or number of saved views.");
  }
  const normalized = views.map(normalizeSavedForecastView);
  if (normalized.some((item) => !item)) {
    throw new Error("Invalid saved view in backup.");
  }
  return JSON.stringify({
    format: "icamp-scenario-preferences-v1",
    scope: { userId, campgroundId },
    views: normalized,
  });
}

export function recoverSavedForecastBackup(raw, { userId, campgroundId }) {
  if (typeof raw !== "string" || raw.length > 8_000) {
    throw new Error("Backup exceeds the 8 KB limit or is unreadable.");
  }
  let payload;
  try {
    payload = JSON.parse(raw);
  } catch {
    throw new Error("Backup is not valid JSON.");
  }
  if (
    payload?.format !== "icamp-scenario-preferences-v1" ||
    payload?.scope?.userId !== userId ||
    payload?.scope?.campgroundId !== campgroundId ||
    !Array.isArray(payload.views) ||
    payload.views.length > FORECAST_SAVED_LIMIT
  ) {
    throw new Error(
      "Backup format, signed-in user or campground does not match.",
    );
  }
  const views = payload.views.map(normalizeSavedForecastView);
  if (
    views.some((item) => !item) ||
    new Set(views.map((item) => item.key)).size !== views.length
  ) {
    throw new Error("Backup contains invalid or repeated scenario filters.");
  }
  return views;
}

// CSV values are quoted and formula-like labels are neutralized before they
// reach a spreadsheet. Figures come solely from the current authorized read.
function csvCell(value) {
  let cell = String(value ?? "Unavailable").replace(/[\r\n]+/g, " ");
  if (/^\s*[=+\-@\t]/.test(cell)) cell = `'${cell}`;
  return `"${cell.replaceAll('"', '""')}"`;
}

export function exportSavedForecastComparisonCsv(views, comparisons) {
  const header = [
    "Saved view",
    "Historical months",
    "Scenario",
    "Source observed at UTC",
    "Actual booked site nights",
    "Historical-rate estimate site nights",
    "Actual minus estimate site nights",
    "Comparable accommodation types",
    "Excluded accommodation types",
    "Interpretation",
  ];
  const rows = views.map((view) => {
    const item = comparisons.find(
      (candidate) =>
        candidate.lookbackMonths === view.lookbackMonths &&
        candidate.scenario === view.scenario,
    );
    return [
      view.label,
      view.lookbackMonths,
      view.scenario,
      item?.generatedAt ?? "Unavailable",
      item?.total?.actualBookedNights ?? "Unavailable",
      item?.total?.expectedNights ?? "Unavailable",
      item?.total?.varianceNights ?? "Unavailable",
      item?.total?.comparableKinds ?? "Unavailable",
      item?.total?.excludedKinds ?? "Unavailable",
      "Historical-rate sensitivity only; not future demand or authorization",
    ];
  });
  return (
    [header, ...rows].map((row) => row.map(csvCell).join(",")).join("\r\n") +
    "\r\n"
  );
}
