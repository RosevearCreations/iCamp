"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireStaff } from "@/lib/auth/current-session";
import {
  closeStorePosSession,
  createStockLocation,
  openStorePosSession,
  recordStoreStockCount,
  recordStoreStockOperation,
  reviewStorePosSession,
  reviewStoreStockCount,
  setStockReorderRule,
  storeOperationsPermissions,
} from "@/lib/store-operations/postgres.mjs";

const path = "/workspaces/management/campgrounds/store/operations";
const field = (form: FormData, name: string) =>
  String(form.get(name) ?? "").trim();
function scopedKey(value: string) {
  const [productId, locationId, expectedVersion, extra] = value.split(":");
  if (!productId || !locationId || !expectedVersion || extra)
    throw new Error("Choose a current product and stock location.");
  return { productId, locationId, expectedVersion };
}
function safeError(error: unknown) {
  const message = error instanceof Error ? error.message : "";
  if (
    /permission|denied|unauthoriz|forbidden|syntax|postgres|relation|query|connection|database|role|server|column/i.test(
      message,
    )
  )
    return "Not saved: campground permission, connection or record scope requires review.";
  return `Not saved: ${message.slice(0, 190) || "refresh and review the latest record"}`;
}
async function execute(
  form: FormData,
  key: "manage" | "audit",
  fn: (actor: string, sessionId: string, camp: string) => Promise<unknown>,
  success: string,
) {
  const camp = field(form, "campgroundId");
  const session = await requireStaff(path);
  const permissions = await storeOperationsPermissions(session.user.id, camp);
  if (!permissions[key]) redirect("/auth/not-authorized");
  let message = success;
  try {
    await fn(session.user.id, session.sessionId, camp);
  } catch (error) {
    message = safeError(error);
  }
  revalidatePath(path);
  redirect(
    `${path}?campground=${encodeURIComponent(camp)}&saved=${encodeURIComponent(message)}`,
  );
}
export async function createStockLocationAction(form: FormData) {
  await execute(
    form,
    "manage",
    (actorUserId, actorSessionId, campgroundId) =>
      createStockLocation({
        actorUserId,
        actorSessionId,
        campgroundId,
        input: {
          id: field(form, "id"),
          locationCode: field(form, "locationCode"),
          displayName: field(form, "displayName"),
        },
      }),
    "Stock location created; no inventory has been assumed.",
  );
}
export async function setReorderRuleAction(form: FormData) {
  await execute(
    form,
    "manage",
    (actorUserId, actorSessionId, campgroundId) =>
      setStockReorderRule({
        actorUserId,
        actorSessionId,
        campgroundId,
        input: {
          productId: field(form, "productId"),
          expectedVersion: field(form, "expectedVersion"),
          reorderPoint: field(form, "reorderPoint"),
          targetQuantity: field(form, "targetQuantity"),
        },
      }),
    "Internal reorder suggestion thresholds updated; no purchase was placed.",
  );
}
export async function openPosSessionAction(form: FormData) {
  await execute(
    form,
    "manage",
    (actorUserId, actorSessionId, campgroundId) =>
      openStorePosSession({
        actorUserId,
        actorSessionId,
        campgroundId,
        input: {
          id: field(form, "id"),
          registerCode: field(form, "registerCode"),
          openingCashCents: field(form, "openingCashCents"),
        },
      }),
    "Manual POS session opened; no processor or settlement was contacted.",
  );
}
export async function postStockOperationAction(form: FormData) {
  await execute(
    form,
    "manage",
    (actorUserId, actorSessionId, campgroundId) => {
      const source = scopedKey(field(form, "stockKey"));
      const target = field(form, "destinationKey")
        ? scopedKey(field(form, "destinationKey"))
        : null;
      if (target && target.productId !== source.productId)
        throw new Error("Transfer must stay on one product.");
      return recordStoreStockOperation({
        actorUserId,
        actorSessionId,
        campgroundId,
        input: {
          id: field(form, "id"),
          productId: source.productId,
          locationId: source.locationId,
          expectedVersion: source.expectedVersion,
          targetLocationId: target?.locationId,
          targetVersion: target?.expectedVersion,
          kind: field(form, "kind"),
          quantity: field(form, "quantity"),
          posSessionId: field(form, "posSessionId"),
          expectedCashCents: field(form, "expectedCashCents"),
          sourceReference: field(form, "sourceReference"),
          reasonNote: field(form, "reasonNote"),
        },
      });
    },
    "Atomic stock movement recorded; no payment, order or dispatch executed.",
  );
}
export async function recordStockCountAction(form: FormData) {
  await execute(
    form,
    "manage",
    (actorUserId, actorSessionId, campgroundId) => {
      const selected = scopedKey(field(form, "stockKey"));
      return recordStoreStockCount({
        actorUserId,
        actorSessionId,
        campgroundId,
        input: {
          id: field(form, "id"),
          productId: selected.productId,
          locationId: selected.locationId,
          observedQuantity: field(form, "observedQuantity"),
          sourceReference: field(form, "sourceReference"),
          reasonNote: field(form, "reasonNote"),
        },
      });
    },
    "Physical count saved as pending independent review; available stock is unchanged.",
  );
}
export async function reviewStockCountAction(form: FormData) {
  await execute(
    form,
    "audit",
    (actorUserId, actorSessionId, campgroundId) =>
      reviewStoreStockCount({
        actorUserId,
        actorSessionId,
        campgroundId,
        input: {
          id: field(form, "id"),
          countId: field(form, "countId"),
          adjustmentEventId: field(form, "adjustmentEventId"),
          decision: field(form, "decision"),
          reasonNote: field(form, "reasonNote"),
        },
      }),
    "Independent count review recorded; any accepted adjustment is in the immutable stock ledger.",
  );
}
export async function closePosSessionAction(form: FormData) {
  await execute(
    form,
    "manage",
    (actorUserId, actorSessionId, campgroundId) =>
      closeStorePosSession({
        actorUserId,
        actorSessionId,
        campgroundId,
        input: {
          sessionId: field(form, "sessionId"),
          expectedVersion: field(form, "expectedVersion"),
          observedCashCents: field(form, "observedCashCents"),
          note: field(form, "note"),
        },
      }),
    "POS register closed with a recorded variance; independent review is pending.",
  );
}
export async function reviewPosSessionAction(form: FormData) {
  await execute(
    form,
    "audit",
    (actorUserId, actorSessionId, campgroundId) =>
      reviewStorePosSession({
        actorUserId,
        actorSessionId,
        campgroundId,
        input: {
          id: field(form, "id"),
          sessionId: field(form, "sessionId"),
          disposition: field(form, "disposition"),
          reasonNote: field(form, "reasonNote"),
        },
      }),
    "Independent POS close review saved. No payment settlement occurred.",
  );
}
