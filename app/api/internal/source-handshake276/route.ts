import { NextResponse } from "next/server";
import { acceptIndependentHandshake276 } from "@/lib/build276/postgres.mjs";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  if (Number(request.headers.get("content-length") ?? "0") > 2400)
    return NextResponse.json(
      { accepted: false },
      { status: 413, headers: { "cache-control": "no-store" } },
    );
  const body = await request.text();
  if (body.length > 2400)
    return NextResponse.json(
      { accepted: false },
      { status: 413, headers: { "cache-control": "no-store" } },
    );
  try {
    const result = await acceptIndependentHandshake276(
      body,
      request.headers.get("x-icamp-ed25519-signature"),
    );
    return NextResponse.json(result, {
      status: 202,
      headers: { "cache-control": "no-store" },
    });
  } catch {
    return NextResponse.json(
      { accepted: false, status: "NOT_ACCEPTED" },
      { status: 403, headers: { "cache-control": "no-store" } },
    );
  }
}
