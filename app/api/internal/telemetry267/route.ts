import { NextResponse } from "next/server";
import { receiveTelemetry267 } from "@/lib/campground-support267/postgres.mjs";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  if (Number(request.headers.get("content-length") ?? "0") > 2048)
    return NextResponse.json({ error: "Payload too large" }, { status: 413 });
  const body = await request.text();
  if (body.length > 2048)
    return NextResponse.json({ error: "Payload too large" }, { status: 413 });
  try {
    await receiveTelemetry267(
      body,
      request.headers.get("x-icamp-telemetry-signature"),
    );
    return NextResponse.json({ accepted: true }, { status: 202 });
  } catch {
    return NextResponse.json(
      { error: "Telemetry rejected or not enrolled" },
      { status: 403 },
    );
  }
}
