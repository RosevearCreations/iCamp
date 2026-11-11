import { createHash } from "node:crypto";
import type { NextRequest } from "next/server";

import { getCurrentSession } from "@/lib/auth/current-session";
import { getCampgroundAuthorization } from "@/lib/authz/postgres.mjs";
import { buildSupervisorPrivateExport } from "@/lib/booking-charges/fulfillment-continuity-core.mjs";
import { listSupervisorContinuityEvidence } from "@/lib/booking-charges/fulfillment-continuity-postgres.mjs";
import { listFulfillmentSupervisorEvidence } from "@/lib/booking-charges/fulfillment-supervisor-postgres.mjs";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/iu;
const SHA = /^[0-9a-f]{40}$/u;
const headers = {
  "Cache-Control": "private, no-store, max-age=0",
  "X-Content-Type-Options": "nosniff",
  "Referrer-Policy": "no-referrer",
};

export async function GET(request: NextRequest) {
  const session = await getCurrentSession();
  if (!session || session.user.accountType !== "staff") {
    return new Response("Staff sign-in required.", { status: 401, headers });
  }
  const params = request.nextUrl.searchParams;
  const campgroundId = params.get("campground") ?? "";
  if (
    !UUID.test(campgroundId) ||
    [...params.keys()].some((key) => key !== "campground") ||
    params.getAll("campground").length !== 1
  ) {
    return new Response("Invalid private export scope.", {
      status: 400,
      headers,
    });
  }
  const grant = await getCampgroundAuthorization(session.user.id, campgroundId);
  if (
    !["staff.manage", "reservation.modify"].every((permission) =>
      grant?.permissions.includes(permission),
    )
  ) {
    return new Response("Not authorized for this campground.", {
      status: 403,
      headers,
    });
  }
  try {
    const [supervisor, continuity] = await Promise.all([
      listFulfillmentSupervisorEvidence({
        userId: session.user.id,
        campgroundId,
      }),
      listSupervisorContinuityEvidence({
        userId: session.user.id,
        campgroundId,
      }),
    ]);
    const revision = process.env.VERCEL_GIT_COMMIT_SHA ?? "";
    const snapshot = buildSupervisorPrivateExport({
      campgroundId,
      asOf: new Date().toISOString(),
      sourceRevision: SHA.test(revision) ? revision : null,
      supervisor,
      continuity,
    });
    const content = `${JSON.stringify(snapshot, null, 2)}\n`;
    const digest = createHash("sha256").update(content, "utf8").digest("hex");
    return new Response(content, {
      status: 200,
      headers: {
        ...headers,
        "Content-Type": "application/json; charset=utf-8",
        "Content-Disposition":
          'attachment; filename="icamp-private-fulfillment-evidence.json"',
        "X-iCamp-Export-SHA256": digest,
        "X-iCamp-Export-Trust": "UNSIGNED_CAMPGROUND_PRIVATE_SNAPSHOT",
      },
    });
  } catch {
    return new Response("Private source evidence is currently unavailable.", {
      status: 503,
      headers,
    });
  }
}
