export const SYSOP_TELEMETRY_PATH = "/internal/rosevear/sysop/telemetry/v1";
export const SYSOP_TELEMETRY_SCHEMA = "rosevear.sysop.statistics.v1";
const enc = new TextEncoder();
const read = (env, key) => env?.[key] ?? globalThis.process?.env?.[key] ?? "";
const canonical = (v) =>
  Array.isArray(v)
    ? "[" + v.map(canonical).join(",") + "]"
    : v && typeof v === "object"
      ? "{" +
        Object.keys(v)
          .sort()
          .map((k) => JSON.stringify(k) + ":" + canonical(v[k]))
          .join(",") +
        "}"
      : JSON.stringify(v);
const bytesToHex = (bytes) =>
  Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
function pemBytes(pem) {
  const b64 = String(pem).replace(
    /-----BEGIN PRIVATE KEY-----|-----END PRIVATE KEY-----|\s+/g,
    "",
  );
  if (!b64) return null;
  const bin =
    typeof atob === "function"
      ? atob(b64)
      : Buffer.from(b64, "base64").toString("binary");
  return Uint8Array.from(bin, (c) => c.charCodeAt(0));
}
function same(a, b) {
  if (typeof a !== "string" || typeof b !== "string" || a.length !== b.length)
    return false;
  let n = 0;
  for (let i = 0; i < a.length; i++) n |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return n === 0;
}
function response(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "Content-Type": "application/json",
      "Cache-Control": "private, no-store",
      "X-Content-Type-Options": "nosniff",
      "Referrer-Policy": "no-referrer",
      "Access-Control-Allow-Origin": "none",
    },
  });
}
export async function handleSysopTelemetry({
  request,
  env = {},
  appId,
  sourceCommit,
  nowMs = Date.now(),
  readAggregateMetrics = null,
}) {
  const url = new URL(request.url);
  if (request.method !== "GET")
    return response(
      { state: "DENY_METHOD", connected: false, authorizesAction: false },
      405,
    );
  if (url.pathname !== SYSOP_TELEMETRY_PATH || url.search || url.hash)
    return response(
      { state: "DENY_SCOPE", connected: false, authorizesAction: false },
      404,
    );
  const token = read(env, "ROSEVEAR_SYSOP_TELEMETRY_READ_TOKEN"),
    pem = read(env, "ROSEVEAR_SYSOP_TELEMETRY_PRIVATE_KEY_PEM");
  const commit =
    sourceCommit ||
    read(env, "VERCEL_GIT_COMMIT_SHA") ||
    read(env, "CF_PAGES_COMMIT_SHA") ||
    read(env, "GITHUB_SHA");
  if (!token || !pem || !/^[a-f0-9]{40}$/.test(commit))
    return response(
      { state: "NOT_ENROLLED", connected: false, authorizesAction: false },
      503,
    );
  if (!same(request.headers.get("x-rosevear-telemetry-token") ?? "", token))
    return response(
      { state: "NOT_AUTHORIZED", connected: false, authorizesAction: false },
      401,
    );
  try {
    const pkcs8 = pemBytes(pem);
    if (!pkcs8) throw Error("key");
    const key = await crypto.subtle.importKey(
      "pkcs8",
      pkcs8,
      { name: "Ed25519" },
      false,
      ["sign"],
    );
    const nonce = new Uint8Array(16);
    crypto.getRandomValues(nonce);
    const eventId = crypto.randomUUID().replaceAll("-", "");
    const uptime =
      typeof globalThis.process?.uptime === "function"
        ? Math.floor(globalThis.process.uptime())
        : null;
    // Authenticated aggregate sampler may only query bounded counts; if
    // the original Production database is unavailable, report UNKNOWN/null.
    const measured = typeof readAggregateMetrics === "function"
      ? await Promise.resolve().then(readAggregateMetrics).catch(() => null)
      : null;
    const count = (key) =>
      Number.isSafeInteger(measured?.[key]) && measured[key] >= 0 &&
      measured[key] < 2147483647 ? measured[key] : null;
    const payload = {
      schema: SYSOP_TELEMETRY_SCHEMA,
      protocolVersion: "1.1",
      appId,
      sourceCommit: commit,
      eventId,
      nonce: bytesToHex(nonce),
      issuedAtMs: nowMs,
      expiresAtMs: nowMs + 60000,
      state: "UNKNOWN",
      metricsWindowSeconds: 60,
      metrics: {
        requests: null,
        serverErrors: null,
        jobsCompleted: count("jobsCompleted"),
        jobsFailed: count("jobsFailed"),
        queueDepth: count("queueDepth"),
        latencyP95Ms: null,
        activeSessions: count("activeSessions"),
      },
      sysop: {
        eventKind: "HEARTBEAT",
        observedAtMs: nowMs,
        processUptimeSec: uptime,
        restartCount: null,
        lastRestartAtMs: null,
        bootTimeMs: null,
        rebootIsIndependentlyWitnessed: false,
      },
      dataClass: "NON_SENSITIVE_AGGREGATE",
      tenantId: null,
      authorizesAction: false,
    };
    const signature = bytesToHex(
      new Uint8Array(
        await crypto.subtle.sign(
          "Ed25519",
          key,
          enc.encode(canonical(payload)),
        ),
      ),
    );
    return response({ payload, signature });
  } catch {
    return response(
      {
        state: "HOLD_SIGNER_UNAVAILABLE",
        connected: false,
        authorizesAction: false,
      },
      503,
    );
  }
}
