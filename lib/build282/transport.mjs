import { isIP } from "node:net";
import { UUID276, SHA276 } from "../build276/core.mjs";

export async function submitProviderAlert282(
  { incident, key, reason },
  env = process.env,
  send = fetch,
) {
  if (env.ICAMP282_ALERT_ENABLED !== "true")
    throw Error("PROVIDER_TRANSPORT_DISABLED");
  const endpoint = new URL(env.ICAMP282_ALERT_URL ?? "");
  const token = env.ICAMP282_ALERT_TOKEN;
  if (
    endpoint.protocol !== "https:" ||
    endpoint.username ||
    endpoint.password ||
    endpoint.port ||
    endpoint.search ||
    endpoint.hash ||
    !/^[a-z0-9.-]+\.[a-z]{2,}$/u.test(endpoint.hostname) ||
    isIP(endpoint.hostname) ||
    /\.(local|internal|localhost|test|invalid)$/u.test(endpoint.hostname) ||
    !token ||
    !/^[!-~]{16,2048}$/u.test(token) ||
    !key?.providerId ||
    key.providerId !== env.ICAMP282_ALERT_PROVIDER_ID ||
    !UUID276.test(incident?.id ?? "") ||
    !SHA276.test(incident?.ackDigest ?? "") ||
    ![
      "OWNER_RECOVERY_CONTINUITY_HOLD",
      "PROVIDER_ACK_FRESHNESS_HOLD",
      "SOURCE_CONTINUITY_HOLD",
      "INDEPENDENT_MONITOR_HOLD",
    ].includes(reason)
  )
    throw Error("PROVIDER_TRANSPORT_CONFIGURATION_HOLD");
  try {
    const response = await send(endpoint, {
      method: "POST",
      redirect: "error",
      signal: AbortSignal.timeout(5000),
      headers: {
        authorization: "Bearer " + token,
        "content-type": "application/json",
        "idempotency-key": incident.id,
      },
      body: JSON.stringify({
        kind: "icamp-original-provider-alert-v1",
        alertId: incident.id,
        priorAckDigest: incident.ackDigest,
        providerId: key.providerId,
        reason,
      }),
    });
    await response.body?.cancel();
    if (!response.ok) throw Error("REJECTED");
    return { status: "SUBMITTED_DELIVERY_UNVERIFIED" };
  } catch {
    throw Error("PROVIDER_SUBMISSION_UNVERIFIED");
  }
}
