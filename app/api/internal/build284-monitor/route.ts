import { schedulerAuthorized284 } from "@/lib/build284/core.mjs";
import { runScheduler284 } from "@/lib/build284/postgres.mjs";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function POST(request: Request) {
  if (!schedulerAuthorized284(request.headers.get("authorization")))
    return Response.json({ status: "NOT_FOUND" }, { status: 404 });
  try {
    const result = await runScheduler284();
    return Response.json(result, {
      status: result.status === "ORIGINAL_SCHEMA_HOLD" ? 503 : 200,
      headers: { "cache-control": "no-store" },
    });
  } catch {
    return Response.json({ status: "MONITOR_HOLD" }, { status: 503 });
  }
}
