import { NextResponse } from "next/server";

import { requireAnyCampgroundPermission } from "@/lib/authz/current-user";
import { loadIntegrationReadinessConfig } from "@/lib/integration-v1/readiness.mjs";
import { build201HandshakePreflight } from "@/lib/integration-v1/build201-handshake-preflight.mjs";
import manifest from "@/public/.well-known/rosevear-integration-manifest.json";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(request: Request) {
  await requireAnyCampgroundPermission(
    "it.integration.read",
    "/integration/comms-hub",
  );
  if (new URL(request.url).search)
    return NextResponse.json(
      { error: "Query parameters are not permitted." },
      { status: 400 },
    );
  const legacy = loadIntegrationReadinessConfig();
  return NextResponse.json(
    build201HandshakePreflight({
      manifest,
      environment:
        process.env.VERCEL_ENV === "production"
          ? "production"
          : "nonproduction",
      legacyGatewayConfigured: legacy.enabled,
    }),
    { headers: { "Cache-Control": "private, no-store, max-age=0" } },
  );
}
