import { NextResponse } from "next/server";

import { requireAnyCampgroundPermission } from "@/lib/authz/current-user";
import { checkPublicCommsHubTransport } from "@/lib/integration-v1/build200-comms-transport.mjs";

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
  return NextResponse.json(await checkPublicCommsHubTransport(), {
    headers: { "Cache-Control": "private, no-store, max-age=0" },
  });
}
