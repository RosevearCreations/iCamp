"use server";
import { randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireCampgroundPermission } from "@/lib/authz/current-user";
import type { Permission } from "@/lib/authz/permissions";
import {
  openSaleTransfer,
  recordSaleEvidence,
  reviewSaleTransfer,
  finalizeSaleTransfer,
} from "@/lib/permanent-unit-transfer/postgres.mjs";

const path = "/workspaces/management/campgrounds/permanent-units/transfers";
const f = (form: FormData, key: string) => String(form.get(key) ?? "").trim();
function finish(camp: string, key: "saved" | "error", value: string): never {
  revalidatePath(path);
  redirect(
    `${path}?campground=${encodeURIComponent(camp)}&${key}=${encodeURIComponent(value.slice(0, 180))}`,
  );
}
async function run(
  form: FormData,
  permission: Permission,
  work: (actorUserId: string, campgroundId: string) => Promise<unknown>,
  success: string,
) {
  const camp = f(form, "campgroundId");
  const s = await requireCampgroundPermission(camp, permission, path);
  try {
    await work(s.user.id, camp);
  } catch (error) {
    finish(
      camp,
      "error",
      error instanceof Error ? error.message : "Transfer operation failed.",
    );
  }
  finish(camp, "saved", success);
}
export async function openTransferAction(form: FormData) {
  await run(
    form,
    "permanent_unit.manage",
    (actorUserId, campgroundId) =>
      openSaleTransfer({
        actorUserId,
        campgroundId,
        id: f(form, "id"),
        listingId: f(form, "listingId"),
        inquiryId: f(form, "inquiryId"),
        applicationReference: f(form, "applicationReference"),
        applicationNote: f(form, "applicationNote"),
      }),
    "Buyer application case opened; no sale has been approved.",
  );
}
export async function recordTransferEvidenceAction(form: FormData) {
  await run(
    form,
    "permanent_unit.manage",
    (actorUserId, campgroundId) =>
      recordSaleEvidence({
        actorUserId,
        campgroundId,
        id: f(form, "id"),
        caseId: f(form, "caseId"),
        stepKey: f(form, "stepKey"),
        outcome: f(form, "outcome"),
        sourceReference: f(form, "sourceReference"),
        note: f(form, "note"),
        feeAmount: f(form, "feeAmount"),
      }),
    "Immutable closing evidence recorded.",
  );
}
export async function reviewTransferAction(form: FormData) {
  await run(
    form,
    "permanent_unit.transfer",
    (actorUserId, campgroundId) =>
      reviewSaleTransfer({
        actorUserId,
        campgroundId,
        id: f(form, "id"),
        caseId: f(form, "caseId"),
        decision: f(form, "decision"),
        note: f(form, "note"),
      }),
    "Independent sale review recorded; no ownership handoff yet.",
  );
}
export async function closeTransferAction(form: FormData) {
  await run(
    form,
    "permanent_unit.transfer",
    (actorUserId, campgroundId) =>
      finalizeSaleTransfer({
        actorUserId,
        campgroundId,
        id: f(form, "id"),
        caseId: f(form, "caseId"),
        newOwnershipEventId: randomUUID(),
        agreementReference: f(form, "agreementReference"),
        closingReference: f(form, "closingReference"),
        note: f(form, "note"),
      }),
    "Approved unit ownership handoff and immutable closing receipt recorded. Land/occupancy agreements remain separately controlled.",
  );
}
