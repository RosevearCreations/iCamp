import type { NextRequest } from "next/server";

import { getCurrentSession } from "@/lib/auth/current-session";
import { getCampgroundAuthorization } from "@/lib/authz/postgres.mjs";
import {
  listCampgroundDispatchEvidence,
  listCampgroundSlaFollowups,
} from "@/lib/booking-charges/fulfillment-dispatch-postgres.mjs";
import { classifyFulfillmentPriority } from "@/lib/booking-charges/fulfillment-priority-core.mjs";
import { listShiftRecoveryEvidence } from "@/lib/booking-charges/fulfillment-shift-postgres.mjs";
import { buildRecoveryTrendAnalytics } from "@/lib/booking-charges/fulfillment-shift-core.mjs";
import { listFieldClosureEvidence } from "@/lib/booking-charges/fulfillment-performance-postgres.mjs";
import { listWitnessAuditEvidence } from "@/lib/booking-charges/fulfillment-witness-postgres.mjs";
import { buildWitnessAuditSummary } from "@/lib/booking-charges/fulfillment-witness-core.mjs";
import {
  buildOwnerShiftPerformanceReport,
  buildSupervisorWorkloadForecast,
} from "@/lib/booking-charges/fulfillment-performance-core.mjs";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/iu;
const SHA = /^[0-9a-f]{40}$/u;
const headers = {
  "Cache-Control": "private, no-store, max-age=0",
  "X-Content-Type-Options": "nosniff",
  "Referrer-Policy": "no-referrer",
};

/** Private per-campground owner-admin report, never a Master Shell feed. */
export async function GET(request: NextRequest) {
  const session = await getCurrentSession();
  if (!session || session.user.accountType !== "staff") {
    return new Response("Staff sign-in required.", { status: 401, headers });
  }
  const params = request.nextUrl.searchParams;
  const campgroundId = params.get("campground") ?? "";
  if (
    !UUID.test(campgroundId) ||
    params.getAll("campground").length !== 1 ||
    [...params.keys()].some((key) => key !== "campground")
  ) {
    return new Response("Invalid campground report scope.", {
      status: 400,
      headers,
    });
  }
  const grant = await getCampgroundAuthorization(session.user.id, campgroundId);
  if (
    !grant?.roleCodes.includes("owner_admin") ||
    !["staff.manage", "reservation.modify"].every((p) =>
      grant.permissions.includes(p),
    )
  ) {
    return new Response(
      "Active campground Owner / Administrator authorization required.",
      {
        status: 403,
        headers,
      },
    );
  }
  try {
    const [dispatch, followup, shift, field, witness] = await Promise.all([
      listCampgroundDispatchEvidence({ userId: session.user.id, campgroundId }),
      listCampgroundSlaFollowups({ userId: session.user.id, campgroundId }),
      listShiftRecoveryEvidence({ userId: session.user.id, campgroundId }),
      listFieldClosureEvidence({ userId: session.user.id, campgroundId }),
      listWitnessAuditEvidence({ userId: session.user.id, campgroundId }).catch(() => null),
    ]);
    const asOf = new Date().toISOString();
    const latest = new Map<string, (typeof followup.followups)[number]>();
    for (const row of followup.followups)
      if (!latest.has(row.dispatchId)) latest.set(row.dispatchId, row);
    const openCases = dispatch.entries.filter(
      (entry) =>
        classifyFulfillmentPriority({
          dispatch: entry.dispatch,
          classification: entry.classification,
          followup: latest.get(entry.dispatch.id) ?? null,
          now: asOf,
        }).isOpen,
    ).length;
    const decisions = new Set(
      shift.handoffs
        .filter((e) => e.eventKind !== "request")
        .map((e) => e.requestId),
    );
    const pendingHandoffs = shift.handoffs.filter(
      (e) => e.eventKind === "request" && !decisions.has(e.id),
    ).length;
    const truncated =
      dispatch.truncated ||
      followup.truncated ||
      shift.truncated ||
      field.truncated ||
      Boolean(witness?.truncated);
    const trend = buildRecoveryTrendAnalytics({
      reviews: shift.reviews,
      handoffs: shift.handoffs,
      asOf,
      days: 7,
      truncated: shift.truncated,
    });
    const forecast = buildSupervisorWorkloadForecast({
      trend,
      openCases,
      pendingHandoffs,
      asOf,
      truncated,
    });
    const revision = process.env.VERCEL_GIT_COMMIT_SHA ?? "";
    const report = buildOwnerShiftPerformanceReport({
      campgroundId,
      sourceRevision: SHA.test(revision) ? revision : null,
      asOf,
      trend,
      forecast,
      closures: field.events,
      truncated,
    });
    const witnessAudit = witness
      ? buildWitnessAuditSummary({
          witnesses: witness.witnesses,
          checkpoints: witness.checkpoints,
          reviews: shift.reviews,
          handoffs: shift.handoffs,
          ownerAudits: witness.ownerAudits,
          asOf,
          truncated,
        })
      : {
          sourceAvailability: "HOLD_BUILD245_MIGRATION_UNVERIFIED",
          independentDeviceAcceptance: "HOLD",
          masterConnection: "HOLD",
        };
    return Response.json({ ...report, fieldWitnessAudit: witnessAudit }, {
      headers: {
        ...headers,
        "Content-Disposition":
          'attachment; filename="icamp-private-owner-shift-performance.json"',
        "X-iCamp-Report-Trust": "UNSIGNED_PRIVATE_OWNER_SNAPSHOT",
      },
    });
  } catch {
    return new Response("Owner report source evidence is unavailable.", {
      status: 503,
      headers,
    });
  }
}
