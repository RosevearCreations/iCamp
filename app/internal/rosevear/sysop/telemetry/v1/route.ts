import { handleSysopTelemetry } from "@/lib/integration-v1/sysop-telemetry-v1.mjs";
import { sampleSysopAggregates264 } from "@/lib/integration-v1/sysop-aggregates264.mjs";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export async function GET(request: Request) {
  return handleSysopTelemetry({
    request,
    env: process.env,
    appId: "icamp",
    sourceCommit: process.env.VERCEL_GIT_COMMIT_SHA,
    readAggregateMetrics: () => sampleSysopAggregates264(process.env),
  });
}
