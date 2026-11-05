import { NextResponse } from "next/server";

import {
  requireAnyCampgroundPermission,
  requireCampgroundPermission,
} from "@/lib/authz/current-user";
import {
  build202AuthorizedCampgrounds,
  listBuild202Evidence,
  submitBuild202Evidence,
} from "@/lib/pilot/build202-evidence-postgres.mjs";
import { validateBuild202Evidence } from "@/lib/pilot/build202-evidence.mjs";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
const headers = {
  "Cache-Control": "private, no-store, max-age=0",
  "X-Content-Type-Options": "nosniff",
};
const fail = (status: number, error: string) =>
  NextResponse.json({ error }, { status, headers });

export async function GET(request: Request) {
  const session = await requireAnyCampgroundPermission(
    "pilot.evidence.review",
    "/pilot/acceptance",
  );
  const params = new URL(request.url).searchParams;
  if (
    [...params.keys()].some((key) => key !== "campgroundId") ||
    params.getAll("campgroundId").length > 1
  )
    return fail(400, "Unexpected query parameter.");
  const campgroundId = params.get("campgroundId");
  if (campgroundId !== null)
    await requireCampgroundPermission(
      campgroundId,
      "pilot.evidence.review",
      "/pilot/acceptance",
    );
  try {
    if (campgroundId === null)
      return NextResponse.json(
        {
          campgrounds: await build202AuthorizedCampgrounds(session.user.id),
          connection_state: "DISCONNECTED / HOLD",
        },
        { headers },
      );
    return NextResponse.json(
      await listBuild202Evidence(session.user.id, campgroundId),
      { headers },
    );
  } catch {
    return fail(
      503,
      "Independent intake ledger is unavailable. No claim was verified.",
    );
  }
}

export async function POST(request: Request) {
  if (request.headers.get("origin") !== new URL(request.url).origin)
    return fail(403, "Same-origin evidence intake required.");
  if (
    !request.headers
      .get("content-type")
      ?.toLowerCase()
      .startsWith("application/json")
  )
    return fail(415, "JSON evidence packet required.");
  if (Number(request.headers.get("content-length") ?? "0") > 4096)
    return fail(413, "Evidence packet too large.");
  let raw: unknown;
  try {
    const text = await request.text();
    if (text.length > 4096) return fail(413, "Evidence packet too large.");
    raw = JSON.parse(text);
  } catch {
    return fail(400, "Malformed evidence packet.");
  }
  let normalized;
  try {
    normalized = validateBuild202Evidence(raw);
  } catch {
    return fail(
      400,
      "Only non-sensitive, unverified evidence references are accepted.",
    );
  }
  const session = await requireCampgroundPermission(
    normalized.campgroundId,
    "pilot.evidence.intake",
    "/pilot/acceptance",
  );
  try {
    const saved = await submitBuild202Evidence(session.user.id, raw);
    return NextResponse.json(saved, { status: 201, headers });
  } catch (error) {
    if ((error as { code?: string })?.code === "23505")
      return fail(
        409,
        "That evidence reference already exists for this campground and class.",
      );
    return fail(
      503,
      "No evidence was saved. The private intake ledger is unavailable.",
    );
  }
}
