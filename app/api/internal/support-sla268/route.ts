import { NextResponse } from "next/server";
import { queueOverdueSupport268 } from "@/lib/campground-support268/postgres.mjs";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
// For a separately configured trusted scheduler. Never expose this to browsers.
// The receiver only stages deduplicated notices; dispatch requires enrolled Comms.
export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (
    !secret ||
    secret.length < 32 ||
    request.headers.get("authorization") !== `Bearer ${secret}`
  )
    return NextResponse.json({ status: "UNAUTHORIZED" }, { status: 401 });
  try {
    const x = await queueOverdueSupport268();
    return NextResponse.json(x, {
      status: x.status === "HOLD_DATABASE" ? 503 : 202,
    });
  } catch {
    return NextResponse.json(
      { status: "HOLD_ORIGINAL_SOURCE" },
      { status: 503 },
    );
  }
}
