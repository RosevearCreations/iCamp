import { randomUUID } from "node:crypto";
import type { NextRequest } from "next/server";
import { getCurrentSession } from "@/lib/auth/current-session";
import { exportOwnerResolutionEvidence } from "@/lib/permanent-unit-owner-evidence/postgres.mjs";

export const dynamic = "force-dynamic";
const field = (form: FormData, key: string) =>
  String(form.get(key) ?? "").trim();
const noStore = {
  "Cache-Control": "private, no-store, max-age=0",
  "X-Content-Type-Options": "nosniff",
};
export async function POST(request: NextRequest) {
  // This is a cookie-authenticated state-changing POST; reject cross-site form submission.
  if (request.headers.get("origin") !== new URL(request.url).origin)
    return new Response("Cross-origin export is not permitted.", {
      status: 403,
      headers: noStore,
    });
  const session = await getCurrentSession();
  if (!session || session.user.accountType !== "staff")
    return new Response("Owner sign-in is required.", {
      status: 403,
      headers: noStore,
    });
  const length = Number(request.headers.get("content-length") ?? "0");
  if (length > 12000)
    return new Response("Export request is too large.", {
      status: 413,
      headers: noStore,
    });
  try {
    const form = await request.formData();
    const outcome = await exportOwnerResolutionEvidence(session.user.id, {
      id: randomUUID(),
      sourceCampgroundId: field(form, "sourceCampgroundId"),
      targetCampgroundId: field(form, "targetCampgroundId"),
      status: field(form, "status"),
      query: field(form, "query"),
      from: field(form, "from"),
      to: field(form, "to"),
      evidenceReference: field(form, "evidenceReference"),
      acceptanceNote: field(form, "acceptanceNote"),
      confirmed: field(form, "confirmed"),
    });
    const today = new Date().toISOString().slice(0, 10);
    return new Response(outcome.csv, {
      status: 200,
      headers: {
        ...noStore,
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="icamp-owner-evidence-${today}-${outcome.id.slice(0, 8)}.csv"`,
        "X-iCamp-Export-Receipt": outcome.id,
        "X-iCamp-Export-SHA256": outcome.sha256,
      },
    });
  } catch (error) {
    // Return a bounded user-facing validation rejection; do not echo SQL/connection errors.
    const message = error instanceof Error ? error.message : "Export rejected.";
    const publicMessage =
      /^(Invalid|Choose|Explicit|Export |Evidence |Start |End |Selected |Cross-|There are|This export|Owner|Search |Source |Target |No authorized|Active Owner)/.test(
        message,
      )
        ? message
        : "Evidence export could not be completed; no download was issued.";
    return new Response(publicMessage, {
      status: 400,
      headers: { ...noStore, "Content-Type": "text/plain; charset=utf-8" },
    });
  }
}
