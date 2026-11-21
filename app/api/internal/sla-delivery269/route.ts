import { NextResponse } from "next/server";
import { acceptSlaDelivery269 } from "@/lib/campground-pilot269/postgres.mjs";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export async function POST(request: Request) {
  if (Number(request.headers.get("content-length") ?? "0") > 2048)
    return NextResponse.json({ accepted: false }, { status: 413 });
  const body = await request.text();
  if (body.length > 2048)
    return NextResponse.json({ accepted: false }, { status: 413 });
  try {
    const result = await acceptSlaDelivery269(
      body,
      request.headers.get("x-icamp-sla-signature"),
    );
    return NextResponse.json(result, { status: 202 });
  } catch {
    return NextResponse.json(
      { accepted: false, status: "UNVERIFIED_OR_UNENROLLED" },
      { status: 403 },
    );
  }
}
