export const PUBLIC_SMOKE_PATHS = Object.freeze([
  ["health", "/api/health", "json"],
  ["version", "/api/version", "json"],
  ["status", "/status", "html"],
  ["launch", "/launch/readiness", "html"],
  ["connections", "/integration/comms-hub", "html"],
]);

const PRODUCTION_HOSTS = new Set([
  "i-camp-pi.vercel.app",
  "i-camp-johns-projects-8f256ece.vercel.app",
  "i-camp-git-main-johns-projects-8f256ece.vercel.app",
]);

export function validatedSmokeOrigin(raw) {
  const url = new URL(raw);
  if (
    url.protocol !== "https:" ||
    !PRODUCTION_HOSTS.has(url.hostname) ||
    url.username ||
    url.password ||
    url.port ||
    url.pathname !== "/" ||
    url.search ||
    url.hash
  ) {
    throw new Error("Smoke origin must be an approved HTTPS iCamp host.");
  }
  return url.origin;
}

function safeStatus(response) {
  if (response.status === 401 || response.status === 403)
    return "ACCESS_BLOCKED";
  if (response.status >= 300 && response.status < 400) return "REDIRECTED";
  return response.status === 200 ? "PASS" : "HTTP_FAILURE";
}

export async function runPublicSmoke(
  origin,
  fetcher = fetch,
  expectedSha = "",
) {
  const base = validatedSmokeOrigin(origin);
  const results = [];
  for (const [id, path, format] of PUBLIC_SMOKE_PATHS) {
    let result = "NETWORK_FAILURE";
    try {
      const response = await fetcher(new URL(path, base), {
        method: "GET",
        credentials: "omit",
        redirect: "manual",
        cache: "no-store",
        signal: AbortSignal.timeout(10000),
      });
      result = safeStatus(response);
      if (result === "PASS") {
        const body = await response.text();
        if (format === "json") {
          let document;
          try {
            document = JSON.parse(body);
          } catch {
            result = "INVALID_RESPONSE";
          }
          if (document && id === "health") {
            if (document.status !== "operational" || !document.service)
              result = "INVALID_RESPONSE";
          }
          if (document && id === "version") {
            if (!document.version || !document.buildSha)
              result = "INVALID_RESPONSE";
            else if (expectedSha && document.buildSha !== expectedSha)
              result = "WRONG_COMMIT";
          }
        } else {
          const marker =
            id === "status"
              ? "iCamp system status"
              : id === "launch"
                ? "Launch, tenant billing and connections"
                : "Comms Hub connection";
          if (!body.includes(marker)) result = "INVALID_RESPONSE";
        }
      }
    } catch {
      // Never include network error text, headers, response bodies or tokens.
    }
    results.push({ check: id, result });
  }
  return {
    build: 157,
    origin: base,
    checked_at: new Date().toISOString(),
    checks: results,
    public_smoke: results.every((item) => item.result === "PASS")
      ? "PASSED"
      : "NOT_PASSED",
    billing_provider_verified: false,
    omnichannel_authenticated_test_authorized: false,
    integration_gate: "HOLD",
    operational_launch_authorized: false,
  };
}
