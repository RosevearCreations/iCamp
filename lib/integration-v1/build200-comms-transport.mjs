const HUB_ORIGIN = "https://rosevear-comms-hub.devilndovelive.workers.dev";

/**
 * Public HTTPS reachability probe only; never a private signed handshake.
 * The operator cannot select a host/path, avoiding an SSRF/proxy capability.
 */
export async function checkPublicCommsHubTransport(fetcher = fetch) {
  let status = "TLS_TRANSPORT_NOT_VERIFIED";
  let httpStatus = null;
  try {
    const response = await fetcher(`${HUB_ORIGIN}/`, {
      method: "GET",
      redirect: "manual",
      cache: "no-store",
      credentials: "omit",
      signal: AbortSignal.timeout(4500),
      headers: { Accept: "text/html" },
    });
    httpStatus = response.status;
    if (response.url && response.url !== `${HUB_ORIGIN}/`)
      status = "DENY_UNEXPECTED_ORIGIN";
    else if (response.status >= 300 && response.status < 400)
      status = "DENY_REDIRECT";
    else if (response.ok) status = "PUBLIC_HTTPS_REACHABLE";
    else status = "PUBLIC_ENDPOINT_HTTP_FAILURE";
    await response.body?.cancel();
  } catch {
    status = "PUBLIC_ENDPOINT_UNREACHABLE";
  }
  return Object.freeze({
    schema: "icamp.build200.comms-transport-readback.v1",
    target: "Rosevear Comms Hub public homepage",
    transport: status,
    response_code: httpStatus,
    signed_source_identity: "NOT_ENROLLED",
    independent_source_proof: "MISSING",
    isolated_nonproduction_tenant: "NOT_VERIFIED",
    authenticated_gateway_get: "NOT_ATTEMPTED",
    verified_business_connection: false,
    external_message_sent: false,
    connection_state: "DISCONNECTED / HOLD",
  });
}
