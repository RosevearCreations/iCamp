import { createHash, timingSafeEqual } from "node:crypto";
import { recoveryReasons282 } from "../build282/core.mjs";

export function schedulerAuthorized284(header, env = process.env) {
  const credential = Reflect.get(env, "ICAMP284_SCHEDULER_SECRET");
  if (
    env.VERCEL_ENV !== "production" ||
    env.ICAMP284_SCHEDULER_ENABLED !== "true" ||
    typeof credential !== "string" ||
    credential.length < 32 ||
    credential.length > 256 ||
    typeof header !== "string" ||
    header.length > 300
  )
    return false;
  const digest = (value) => createHash("sha256").update(value).digest();
  return timingSafeEqual(digest(header), digest("Bearer " + credential));
}

export function discoveries284(summary, verifiedAckId) {
  if (
    !verifiedAckId ||
    !summary?.admission?.adopted ||
    !summary.admission.host?.pinned ||
    summary.status === "HOLD_ORIGINAL_PROVIDER_MFA_MONITOR_READBACK"
  )
    return [];
  return recoveryReasons282(summary).filter(
    (reason) => reason !== "ORIGINAL_DATABASE_NOT_VERIFIED",
  );
}

export function relayEnvironment284(env, priorAttempts) {
  if (
    priorAttempts === 0 ||
    env.ICAMP284_RELAY_ENABLED !== "true" ||
    env.ICAMP284_SHARED_IDEMPOTENCY_CONFIRMED !== "true"
  )
    return { env, channel: "PRIMARY" };
  if (
    !env.ICAMP284_RELAY_URL ||
    !Reflect.get(env, "ICAMP284_RELAY_TOKEN") ||
    env.ICAMP284_RELAY_URL === env.ICAMP282_ALERT_URL ||
    Object.is(env.ICAMP284_RELAY_TOKEN, env.ICAMP282_ALERT_TOKEN)
  )
    throw Error("RELAY_CONFIGURATION_HOLD");
  return {
    channel: "SECONDARY_RELAY",
    env: {
      ...env,
      ICAMP282_ALERT_URL: env.ICAMP284_RELAY_URL,
      ICAMP282_ALERT_TOKEN: env.ICAMP284_RELAY_TOKEN,
    },
  };
}
