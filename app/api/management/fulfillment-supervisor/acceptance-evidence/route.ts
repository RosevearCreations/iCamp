import type { NextRequest } from "next/server";

import { getCurrentSession } from "@/lib/auth/current-session";
import { getCampgroundAuthorization } from "@/lib/authz/postgres.mjs";
import { listAttestationCalibrationEvidence } from "@/lib/booking-charges/fulfillment-attestation-postgres.mjs";
import { buildOwnerAcceptanceEvidenceExport } from "@/lib/booking-charges/fulfillment-attestation-core.mjs";
import { listWitnessAuditEvidence } from "@/lib/booking-charges/fulfillment-witness-postgres.mjs";
import { evaluateForecastCheckpoint } from "@/lib/booking-charges/fulfillment-witness-core.mjs";
import { listShiftRecoveryEvidence } from "@/lib/booking-charges/fulfillment-shift-postgres.mjs";
import { listVerificationContinuityEvidence } from "@/lib/booking-charges/fulfillment-verification-postgres.mjs";
import { auditOwnerDossierLineage } from "@/lib/booking-charges/fulfillment-dossier-readback-core.mjs";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/iu;
const SHA = /^[0-9a-f]{40}$/u;
const headers = {
  "Cache-Control": "private, no-store, max-age=0",
  "X-Content-Type-Options": "nosniff",
  "Referrer-Policy": "no-referrer",
};

/** A private unsigned acceptance dossier, not Master source HEALTHY proof. */
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
    return new Response("Invalid campground export scope.", {
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
    return new Response("Active campground Owner / Administrator required.", {
      status: 403,
      headers,
    });
  }
  try {
    const [source, witness, shift, continuity] = await Promise.all([
      listAttestationCalibrationEvidence({
        userId: session.user.id,
        campgroundId,
      }),
      listWitnessAuditEvidence({ userId: session.user.id, campgroundId }),
      listShiftRecoveryEvidence({ userId: session.user.id, campgroundId }),
      listVerificationContinuityEvidence({
        userId: session.user.id,
        campgroundId,
        owner: true,
      }),
    ]);
    const now = new Date().toISOString();
    const truncated =
      source.truncated ||
      witness.truncated ||
      shift.truncated ||
      continuity.truncated;
    const evaluations = witness.checkpoints.map((checkpoint) =>
      evaluateForecastCheckpoint({
        checkpoint,
        reviews: shift.reviews,
        handoffs: shift.handoffs,
        asOf: now,
        truncated,
      }),
    );
    const revision = process.env.VERCEL_GIT_COMMIT_SHA ?? "";
    const evidence = buildOwnerAcceptanceEvidenceExport({
      campgroundId,
      sourceRevision: SHA.test(revision) ? revision : null,
      generatedAt: now,
      witnessEvents: witness.witnesses,
      originalDeviceReviews: source.originalDeviceReviews,
      checkpoints: witness.checkpoints,
      evaluations,
      calibrations: source.calibrations,
      ownerAudits: witness.ownerAudits,
      truncated,
    });
    return Response.json(
      {
        ...evidence,
        continuitySchema: "icamp.owner.dossier-continuity.v1",
        verifiedDeviceSourceCount: continuity.verifiedSourcePackets.length,
        sourceCalibrationClosures: continuity.calibrationClosures.map(
          (item) => ({
            id: item.id,
            checkpointId: item.checkpointId,
            decision: item.decision,
            reviewedAt: item.reviewedAt,
          }),
        ),
        dossierSnapshots: continuity.dossierSnapshots,
        dossierReadback: auditOwnerDossierLineage({
          campgroundId,
          snapshots: continuity.dossierSnapshots,
          windowTruncated: continuity.dossierWindowTruncated,
        }),
        independentDevicePinStatus: continuity.pinStatus,
        independentDeviceAcceptance: "HOLD",
        masterConnection: "HOLD",
        ownerProductionAcceptance: "HOLD",
      },
      {
        headers: {
          ...headers,
          "Content-Disposition":
            'attachment; filename="icamp-private-owner-acceptance-evidence.json"',
          "X-iCamp-Report-Trust": "UNSIGNED_PRIVATE_OWNER_SOURCE",
        },
      },
    );
  } catch {
    return new Response("Private source evidence unavailable.", {
      status: 503,
      headers,
    });
  }
}
