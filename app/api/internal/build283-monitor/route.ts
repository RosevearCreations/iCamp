import { authorizedMonitor283 } from "@/lib/build283/core.mjs";
import { runMonitor283 } from "@/lib/build283/postgres.mjs";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function POST(request: Request) {
  if (!authorizedMonitor283(request.headers.get("authorization")))
    return Response.json({ status: "NOT_FOUND" }, { status: 404 });
  try {
    const result = await runMonitor283();
    return Response.json(result, {
      status: result.status === "ORIGINAL_SCHEMA_HOLD" ? 503 : 200,
      headers: { "cache-control": "no-store" },
    });
  } catch {
    return Response.json({ status: "MONITOR_HOLD" }, { status: 503 });
  }
}
