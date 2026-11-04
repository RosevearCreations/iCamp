import { NextResponse } from "next/server";

import { requireAnyCampgroundPermission } from "@/lib/authz/current-user";
import {
  BUILD199_SCENARIOS,
  runBuild199Scenario,
} from "@/lib/tenant-subscription/build199-sandbox.mjs";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  await requireAnyCampgroundPermission(
    "subscription.sandbox.run",
    "/workspaces/it-analysis/subscription-sandbox",
  );
  const scenario =
    new URL(request.url).searchParams.get("scenario") ?? "normal";
  if (!Object.hasOwn(BUILD199_SCENARIOS, scenario)) {
    return NextResponse.json(
      { error: "Unknown sandbox fixture scenario." },
      { status: 400, headers: { "Cache-Control": "no-store" } },
    );
  }
  const report = runBuild199Scenario(scenario);
  return NextResponse.json(report, {
    headers: {
      "Cache-Control": "private, no-store, max-age=0",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
