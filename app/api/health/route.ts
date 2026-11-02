import { NextResponse } from "next/server";

import { getPublicHealthSnapshot } from "@/lib/observability/health";

export const dynamic = "force-dynamic";

export function GET() {
  return NextResponse.json(getPublicHealthSnapshot(), {
    headers: {
      "Cache-Control": "no-store",
    },
  });
}
