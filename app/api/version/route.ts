import { NextResponse } from "next/server";

import { getVersionSnapshot } from "@/lib/observability/health";

export const dynamic = "force-dynamic";

export function GET() {
  return NextResponse.json(getVersionSnapshot(), {
    headers: {
      "Cache-Control": "no-store",
    },
  });
}
