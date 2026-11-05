import { NextResponse } from "next/server";
import {
  requireAnyCampgroundPermission,
  requireCampgroundPermission,
} from "@/lib/authz/current-user";
import {
  build203AuthorizedCampgrounds,
  listBuild203Review,
  recordBuild203Custody,
  recordBuild203OwnerIntent,
} from "@/lib/pilot/build203-custody-postgres.mjs";
import {
  validateBuild203Custody,
  validateBuild203OwnerIntent,
} from "@/lib/pilot/build203-custody.mjs";

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
    "pilot.custody.reconcile",
    "/pilot/acceptance",
  );
  const params = new URL(request.url).searchParams;
  if (
    [...params.keys()].some((key) => key !== "campgroundId") ||
    params.getAll("campgroundId").length > 1
  )
    return fail(400, "Unexpected review query parameter.");
  const campgroundId = params.get("campgroundId");
  if (campgroundId !== null)
    await requireCampgroundPermission(
      campgroundId,
      "pilot.custody.reconcile",
      "/pilot/acceptance",
    );
  try {
    if (campgroundId === null)
      return NextResponse.json(
        {
          campgrounds: await build203AuthorizedCampgrounds(session.user.id),
          connection_state: "DISCONNECTED / HOLD",
        },
        { headers },
      );
    return NextResponse.json(
      await listBuild203Review(session.user.id, campgroundId),
      { headers },
    );
  } catch {
    return fail(
      503,
      "Private custody review is unavailable. No authority was established.",
    );
  }
}

export async function POST(request: Request) {
  if (request.headers.get("origin") !== new URL(request.url).origin)
    return fail(403, "Same-origin owner/I.T. decision required.");
  if (
    !request.headers
      .get("content-type")
      ?.toLowerCase()
      .startsWith("application/json")
  )
    return fail(415, "JSON private decision required.");
  if (Number(request.headers.get("content-length") ?? "0") > 4096)
    return fail(413, "Decision packet too large.");
  let raw: unknown;
  try {
    const body = await request.text();
    if (body.length > 4096) return fail(413, "Decision packet too large.");
    raw = JSON.parse(body);
  } catch {
    return fail(400, "Invalid decision JSON.");
  }
  const action = (raw as { action?: unknown })?.action;
  if (action !== "RECONCILE_SOURCE_CLAIMS" && action !== "OWNER_TEST_INTENT")
    return fail(
      400,
      "Only scoped custody claims and owner TEST intent are accepted.",
    );
  let campgroundId: string;
  try {
    campgroundId =
      action === "RECONCILE_SOURCE_CLAIMS"
        ? validateBuild203Custody(raw).campgroundId
        : validateBuild203OwnerIntent(raw).campgroundId;
  } catch {
    return fail(400, "Invalid or unauthorized decision fields.");
  }
  const permission =
    action === "RECONCILE_SOURCE_CLAIMS"
      ? "pilot.custody.reconcile"
      : "pilot.test.authorize";
  const session = await requireCampgroundPermission(
    campgroundId,
    permission,
    "/pilot/acceptance",
  );
  try {
    const saved =
      action === "RECONCILE_SOURCE_CLAIMS"
        ? await recordBuild203Custody(session.user.id, raw)
        : await recordBuild203OwnerIntent(session.user.id, raw);
    return NextResponse.json(saved, { status: 201, headers });
  } catch (error) {
    const code = (error as { code?: string })?.code;
    if (code === "23505")
      return fail(
        409,
        "The reference or request ID already exists. No duplicate added.",
      );
    if (
      error instanceof Error &&
      /PILOT203_SOURCE_SCOPE_OR_INDEPENDENCE_MISSING|PILOT203_REVIEW_SCOPE_MISSING/.test(
        error.message,
      )
    )
      return fail(
        409,
        "Source scope, independent reviewer or review reference is missing.",
      );
    return fail(
      503,
      "No record was saved. Custody/owner ledger unavailable or access denied.",
    );
  }
}
