import { createHash, timingSafeEqual } from "node:crypto";

export function authorizedMonitor283(header, env = process.env) {
  const secret = env.ICAMP283_MONITOR_SECRET;
  if (
    env.VERCEL_ENV !== "production" ||
    env.ICAMP283_MONITOR_ENABLED !== "true" ||
    typeof secret !== "string" ||
    secret.length < 32 ||
    secret.length > 256 ||
    typeof header !== "string" ||
    header.length > 300
  )
    return false;
  const digest = (value) => createHash("sha256").update(value).digest();
  return timingSafeEqual(digest(header), digest("Bearer " + secret));
}

export function escalationDecision283({
  deliveryExists,
  closed,
  attempts,
  lastAttemptAt,
  now,
}) {
  if (closed || deliveryExists) return "NO_AUTOMATIC_RESUBMISSION";
  if (
    !Number.isFinite(now) ||
    !Number.isInteger(attempts) ||
    attempts < 0 ||
    attempts >= 3
  )
    return "INDEPENDENT_REVIEW_REQUIRED";
  if (
    attempts > 0 &&
    (!Number.isFinite(lastAttemptAt) || now - lastAttemptAt < 3600000)
  )
    return "RETRY_COOLDOWN";
  return "ELIGIBLE";
}

export function closureEligible283({ delivery, current, previous, openedAt }) {
  return Boolean(
    delivery === true &&
    current?.verified === true &&
    current.id !== previous?.id &&
    current.providerId === previous?.providerId &&
    current.fingerprint === previous?.fingerprint &&
    current.sourceHost === previous?.sourceHost &&
    Number.isFinite(current.recordedAt) &&
    Number.isFinite(openedAt) &&
    current.recordedAt > openedAt,
  );
}
