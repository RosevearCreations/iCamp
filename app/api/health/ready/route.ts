import { NextResponse } from "next/server";

import { getReadinessSnapshot } from "@/lib/observability/health";

export const dynamic = "force-dynamic";

export function GET() {
  const snapshot = getReadinessSnapshot();

  return NextResponse.json(snapshot, {
    status: snapshot.status === "ready" ? 200 : 503,
    headers: {
      "Cache-Control": "no-store",
    },
  });
}
