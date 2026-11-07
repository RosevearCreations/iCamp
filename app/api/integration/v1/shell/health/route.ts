import { NextResponse } from "next/server";
import { verifyICampShellGet } from "@/lib/integration-v1/ql335-shell.mjs";
import { handleQl364SourceHealth } from "@/lib/integration-v1/ql364-source-health.mjs";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

async function respond(request: Request) {
  if (request.headers.has("x-rosevear-ql362-request")) {
    return handleQl364SourceHealth({
      request,
      sourceId: "icamp",
      repository: "iCamp",
    });
  }
  const result = await verifyICampShellGet({
    method: request.method,
    path: "/api/integration/v1/shell/health",
    query: Object.fromEntries(new URL(request.url).searchParams),
    headers: Object.fromEntries(request.headers),
    runtime: process.env.VERCEL_ENV === "preview" ? "nonproduction" : "hold",
    // Independent source-owner, broker KMS and durable nonce services are not
    // provisioned. Never fall back to campground keys or a test fixture.
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
