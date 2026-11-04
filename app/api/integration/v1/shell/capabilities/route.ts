import { NextResponse } from "next/server";
import { verifyICampShellGet } from "@/lib/integration-v1/ql335-shell.mjs";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

async function respond(request: Request) {
  const result = await verifyICampShellGet({
    method: request.method,
    path: "/api/integration/v1/shell/capabilities",
    query: Object.fromEntries(new URL(request.url).searchParams),
    headers: Object.fromEntries(request.headers),
    runtime: process.env.VERCEL_ENV === "preview" ? "nonproduction" : "hold",
    // A platform-level handshake must never imply access to Camp Rosevear
    // or to any other campground tenant.
  });
  return NextResponse.json(result, {
    status: result.httpStatus,
    headers: {
      "Cache-Control": "private, no-store",
      Vary: "X-Rosevear-Shell-Envelope",
    },
  });
}
export const GET = respond;
export const POST = respond;
export const PUT = respond;
export const PATCH = respond;
export const DELETE = respond;
export const OPTIONS = respond;
