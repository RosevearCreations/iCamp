import { createHmac, timingSafeEqual } from "node:crypto";

const UUID =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu;
const SOURCE = /^[a-z0-9_-]{8,64}$/u;
const NONCE = /^[A-Za-z0-9_-]{16,96}$/u;
const STAGES = [
  "guest_search",
  "guest_checkout",
  "staff_action",
  "health_probe",
];
const REF = /^[A-Za-z0-9:._/-]{12,160}$/u;
export const TRAFFIC_STAGES269 = Object.freeze(STAGES);
export function verifySignedRaw269(body, signature, secret) {
  if (
    typeof body !== "string" ||
    body.length > 2048 ||
    typeof secret !== "string" ||
    secret.length < 32 ||
    typeof signature !== "string" ||
    !/^[a-f0-9]{64}$/u.test(signature)
  )
    return false;
  const expected = createHmac("sha256", secret).update(body).digest();
  return timingSafeEqual(expected, Buffer.from(signature, "hex"));
}
function timestamp(v, now) {
  if (typeof v !== "string") throw Error("Original event timestamp required");
  const stamp = Date.parse(v);
  if (!Number.isFinite(stamp) || stamp < now - 60000 || stamp > now + 60000)
    throw Error("Original signed event must be fresh within one minute");
  return new Date(stamp).toISOString();
}
function bounded(value, maximum) {
  if (!Number.isSafeInteger(value) || value < 0 || value > maximum)
    throw Error("Invalid bounded telemetry counter");
  return value;
}
function exactFields(object, keys) {
  if (
    !object ||
    typeof object !== "object" ||
    Array.isArray(object) ||
    Object.keys(object).sort().join("|") !== [...keys].sort().join("|")
  )
    throw Error("Unexpected fields; guest text and identities prohibited");
}
export function normalizeStage269(raw, now = Date.now()) {
  exactFields(raw, [
    "campgroundId",
    "sourceId",
    "nonce",
    "stage",
    "observedAt",
    "requests",
    "errors",
    "latencyP95Ms",
  ]);
  if (
    !UUID.test(raw.campgroundId) ||
    !SOURCE.test(raw.sourceId) ||
    !NONCE.test(raw.nonce) ||
    !STAGES.includes(raw.stage)
  )
    throw Error("Invalid original source or traffic stage");
  const requests = bounded(raw.requests, 10000000);
  const errors = bounded(raw.errors, requests);
  const latencyP95Ms = bounded(raw.latencyP95Ms, 600000);
  return {
    ...raw,
    requests,
    errors,
    latencyP95Ms,
    observedAt: timestamp(raw.observedAt, now),
  };
}
export function normalizeSlaReceipt269(raw, now = Date.now()) {
  exactFields(raw, [
    "outboxId",
    "sourceId",
    "providerEventId",
    "nonce",
    "eventKind",
    "observedAt",
  ]);
  if (
    !UUID.test(raw.outboxId) ||
    !SOURCE.test(raw.sourceId) ||
    !REF.test(raw.providerEventId) ||
    !NONCE.test(raw.nonce) ||
    !["delivered", "failed"].includes(raw.eventKind)
  )
    throw Error("Invalid scoped downstream SLA acknowledgement");
  return { ...raw, observedAt: timestamp(raw.observedAt, now) };
}
export function trafficFreshness269(
  { enrollmentState, lastReceivedAt, campgroundState },
  now = Date.now(),
) {
  if (campgroundState !== "active") return "SEASONAL_PAUSE_OR_INACTIVE";
  if (enrollmentState !== "active") return "SOURCE_NOT_ENROLLED";
  if (lastReceivedAt == null) return "NO_SIGNED_SAMPLES";
  const time = Date.parse(lastReceivedAt);
  if (!Number.isFinite(time) || time > now + 60000)
    return "BAD_ORIGINAL_TIMESTAMP";
  return now - time <= 15 * 60000 ? "FRESH" : "STALE";
}
export function restoreWitnessStatus269(rows) {
  const originals = rows.filter((r) => r.kind === "original_backup");
  const isolated = rows.filter((r) => r.kind === "isolated_restore");
  const independent = rows.filter((r) => r.kind === "independent_review");
  for (const b of originals) {
    for (const s of isolated.filter((x) => x.digest === b.digest)) {
      if (
        independent.some(
          (i) => i.digest === b.digest && i.actorId !== s.actorId,
        )
      )
        return "TWO_PERSON_RECEIPT_CHAIN_PRESENT_REQUIRES_EXTERNAL_RESTORE_VERIFICATION";
    }
  }
  return "HOLD_NO_DISTINCT_ORIGINAL_RESTORE_WITNESS_CHAIN";
}
