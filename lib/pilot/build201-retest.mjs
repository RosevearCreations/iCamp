export const BUILD201_RETEST_SCHEMA = "icamp.build201.retest.v1";
export const BUILD201_MAX_FINDINGS = 24;
export const BUILD201_DEVICE_PROFILES = Object.freeze([
  "PHONE_TOUCH",
  "TABLET_TOUCH",
  "DESKTOP_KEYBOARD",
  "SCREEN_READER_KEYBOARD",
  "OFFLINE_RECOVERY",
]);
export const BUILD201_FINDING_STATES = Object.freeze([
  "OPEN_FINDING",
  "REMEDIATION_READY",
  "RETEST_FAILED",
  "RETEST_REPORTED_PASS",
  "BLOCKED_EXTERNAL_EVIDENCE",
]);

const TICKET =
  /^(?:issue|ticket|review|owner|test|evidence|receipt)-[a-zA-Z0-9][a-zA-Z0-9._-]{4,79}$/;

export function normalizeBuild201Finding(raw, allowedJourneyIds) {
  if (!raw || typeof raw !== "object" || Array.isArray(raw))
    throw new Error("INVALID_FINDING");
  if (!allowedJourneyIds.has(raw.journey)) throw new Error("INVALID_JOURNEY");
  if (!BUILD201_DEVICE_PROFILES.includes(raw.device))
    throw new Error("INVALID_DEVICE");
  if (!BUILD201_FINDING_STATES.includes(raw.state))
    throw new Error("INVALID_RETEST_STATE");
  if (typeof raw.ticket_ref !== "string" || !TICKET.test(raw.ticket_ref))
    throw new Error("INVALID_TICKET_REFERENCE");
  if (
    raw.evidence_ref !== null &&
    raw.evidence_ref !== undefined &&
    (typeof raw.evidence_ref !== "string" || !TICKET.test(raw.evidence_ref))
  )
    throw new Error("INVALID_EVIDENCE_REFERENCE");
  return Object.freeze({
    journey: raw.journey,
    device: raw.device,
    state: raw.state,
    ticket_ref: raw.ticket_ref,
    evidence_ref: raw.evidence_ref ?? null,
    independently_witnessed: false,
  });
}

export function normalizeBuild201Findings(input, journeys) {
  if (!Array.isArray(input) || input.length > BUILD201_MAX_FINDINGS)
    throw new Error("FINDING_COUNT_OUT_OF_RANGE");
  const allowedJourneyIds = new Set(journeys.map((j) => j.id));
  const items = input.map((item) =>
    normalizeBuild201Finding(item, allowedJourneyIds),
  );
  const keys = items.map(
    (item) => `${item.journey}:${item.device}:${item.ticket_ref}`,
  );
  if (new Set(keys).size !== keys.length)
    throw new Error("DUPLICATE_FINDING_REFERENCE");
  return items;
}

export function importBuild201Retest(text, journeys) {
  if (typeof text !== "string" || text.length > 24_000)
    throw new Error("RETEST_PACKET_TOO_LARGE");
  let input;
  try {
    input = JSON.parse(text);
  } catch {
    throw new Error("INVALID_RETEST_JSON");
  }
  if (
    !input ||
    typeof input !== "object" ||
    Array.isArray(input) ||
    input.schema !== BUILD201_RETEST_SCHEMA
  )
    throw new Error("INVALID_RETEST_SCHEMA");
  // Only known row properties survive; caller-supplied approvals, signatures,
  // device claims and decision flags are intentionally discarded.
  return normalizeBuild201Findings(input.rows, journeys);
}

export async function build201RetestPacket(input, journeys) {
  const rows = normalizeBuild201Findings(input, journeys);
  const counts = Object.fromEntries(
    BUILD201_FINDING_STATES.map((state) => [
      state,
      rows.filter((row) => row.state === state).length,
    ]),
  );
  const canonical = JSON.stringify({ schema: BUILD201_RETEST_SCHEMA, rows });
  const bytes = await globalThis.crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(canonical),
  );
  return Object.freeze({
    schema: BUILD201_RETEST_SCHEMA,
    fixture: "Camp Rosevear",
    build: 201,
    source_sha256: Array.from(new Uint8Array(bytes), (b) =>
      b.toString(16).padStart(2, "0"),
    ).join(""),
    rows,
    counts,
    evidence_class: "UNATTESTED_OWNER_LOCAL_RETEST",
    real_device_witness: "UNVERIFIED",
    independent_signoff: "MISSING",
    signed_comms_hub_peer: "MISSING",
    go_live_decision: "NO_GO_PENDING_EVIDENCE",
    external_effects: false,
  });
}
