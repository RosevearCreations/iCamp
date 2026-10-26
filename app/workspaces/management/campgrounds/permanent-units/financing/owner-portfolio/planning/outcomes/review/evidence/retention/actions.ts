"use server";
import { randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireStaff } from "@/lib/auth/current-session";
import {
  reconcileOwnerExport,
  recordOwnerExportRetention,
} from "@/lib/permanent-unit-owner-retention/postgres.mjs";

const path =
  "/workspaces/management/campgrounds/permanent-units/financing/owner-portfolio/planning/outcomes/review/evidence/retention";
const field = (f: FormData, name: string) => String(f.get(name) ?? "").trim();
function respond(
  source: string,
  target: string,
  kind: "saved" | "error",
  message: string,
): never {
  revalidatePath(path);
  redirect(
    `${path}?source=${encodeURIComponent(source)}&target=${encodeURIComponent(target)}&${kind}=${encodeURIComponent(message.slice(0, 200))}`,
  );
}
export async function reconcileExportReceiptAction(form: FormData) {
  const session = await requireStaff(path);
  const source = field(form, "sourceCampgroundId"),
    target = field(form, "targetCampgroundId");
  let kind: "saved" | "error" = "saved",
    message = "Independent export digest/count reconciliation was recorded.";
  try {
    const result = await reconcileOwnerExport({
      actorUserId: session.user.id,
      id: randomUUID(),
      exportAcceptanceId: field(form, "exportAcceptanceId"),
      sourceCampgroundId: source,
      targetCampgroundId: target,
      observedSha256: field(form, "observedSha256"),
      observedCount: field(form, "observedCount"),
      evidenceReference: field(form, "evidenceReference"),
      reconciliationNote: field(form, "reconciliationNote"),
    });
    if (result.result === "mismatch")
      message =
        "Digest or row count mismatch recorded. Do not treat this export as reconciled; another review is required.";
  } catch (error) {
    kind = "error";
    message =
      error instanceof Error ? error.message : "Reconciliation rejected.";
  }
  respond(source, target, kind, message);
}
export async function recordExportRetentionAction(form: FormData) {
  const session = await requireStaff(path);
  const source = field(form, "sourceCampgroundId"),
    target = field(form, "targetCampgroundId");
  let kind: "saved" | "error" = "saved",
    message =
      "Copy retention/disposal attestation recorded. Immutable audit receipts remain preserved.";
  try {
    await recordOwnerExportRetention({
      actorUserId: session.user.id,
      id: randomUUID(),
      exportAcceptanceId: field(form, "exportAcceptanceId"),
      sourceCampgroundId: source,
      targetCampgroundId: target,
      eventKind: field(form, "eventKind"),
      retentionDueAt: field(form, "retentionDueAt"),
      evidenceReference: field(form, "evidenceReference"),
      retentionNote: field(form, "retentionNote"),
      confirmed: field(form, "confirmed"),
    });
  } catch (error) {
    kind = "error";
    message =
      error instanceof Error
        ? error.message
        : "Retention attestation rejected.";
  }
  respond(source, target, kind, message);
}
