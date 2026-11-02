"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireStaff } from "@/lib/auth/current-session";
import {
  getVendorPermissions,
  registerVendor,
  registerVendorContract,
  registerVendorRecurring,
  registerVendorRequest,
  recordVendorEvent,
} from "@/lib/vendors/postgres.mjs";

const path = "/workspaces/management/campgrounds/vendors";
const field = (form: FormData, name: string) =>
  String(form.get(name) ?? "").trim();
function done(campgroundId: string, message: string): never {
  revalidatePath(path);
  redirect(
    `${path}?campground=${encodeURIComponent(campgroundId)}&saved=${encodeURIComponent(message)}`,
  );
}
function safeError(error: unknown) {
  const m = error instanceof Error ? error.message : "";
  if (
    /vendor|contract|source|invoice|media|recurring|work order|UUID|date|hours|days|cadence|reference|permission|campground|review|immutable|target|request|detail|expiry/i.test(
      m,
    )
  )
    return "Not saved: " + m.slice(0, 220);
  return "Not saved: this private vendor evidence could not be recorded. Check property scope and permissions.";
}
async function execute(
  form: FormData,
  required: "manage" | "invoiceReview",
  fn: (actor: string, sessionId: string, camp: string) => Promise<unknown>,
  success: string,
) {
  const camp = field(form, "campgroundId");
  const session = await requireStaff(path);
  const permissions = await getVendorPermissions(session.user.id, camp);
  if (!permissions[required]) redirect("/auth/not-authorized");
  let message = success;
  try {
    await fn(session.user.id, session.sessionId, camp);
  } catch (error) {
    message = safeError(error);
  }
  done(camp, message);
}
export async function createVendorAction(form: FormData) {
  await execute(
    form,
    "manage",
    (actorUserId, actorSessionId, campgroundId) =>
      registerVendor({
        actorUserId,
        actorSessionId,
        campgroundId,
        input: {
          id: field(form, "id"),
          displayName: field(form, "displayName"),
          serviceCategory: field(form, "serviceCategory"),
          contactName: field(form, "contactName"),
          contactEmail: field(form, "contactEmail"),
          contactPhone: field(form, "contactPhone"),
          privateNote: field(form, "privateNote"),
        },
      }),
    "Private vendor profile registered. No external communication was sent.",
  );
}
export async function createVendorContractAction(form: FormData) {
  await execute(
    form,
    "manage",
    (actorUserId, actorSessionId, campgroundId) =>
      registerVendorContract({
        actorUserId,
        actorSessionId,
        campgroundId,
        input: {
          id: field(form, "id"),
          vendorId: field(form, "vendorId"),
          supersedesContractId: field(form, "supersedesContractId"),
          contractReference: field(form, "contractReference"),
          title: field(form, "title"),
          validFrom: field(form, "validFrom"),
          expiresOn: field(form, "expiresOn"),
          responseTargetHours: field(form, "responseTargetHours"),
          completionTargetDays: field(form, "completionTargetDays"),
          documentMediaId: field(form, "documentMediaId"),
          privateNote: field(form, "privateNote"),
        },
      }),
    "Source-backed contract/SLA snapshot recorded. No purchase or payable was authorized.",
  );
}
export async function createVendorRecurringAction(form: FormData) {
  await execute(
    form,
    "manage",
    (actorUserId, actorSessionId, campgroundId) =>
      registerVendorRecurring({
        actorUserId,
        actorSessionId,
        campgroundId,
        input: {
          id: field(form, "id"),
          vendorId: field(form, "vendorId"),
          contractId: field(form, "contractId"),
          supersedesPlanId: field(form, "supersedesPlanId"),
          serviceLabel: field(form, "serviceLabel"),
          cadenceDays: field(form, "cadenceDays"),
          nextDueOn: field(form, "nextDueOn"),
          privateNote: field(form, "privateNote"),
        },
      }),
    "Internal recurring service reminder saved; nothing was dispatched.",
  );
}
export async function createVendorRequestAction(form: FormData) {
  await execute(
    form,
    "manage",
    (actorUserId, actorSessionId, campgroundId) =>
      registerVendorRequest({
        actorUserId,
        actorSessionId,
        campgroundId,
        input: {
          id: field(form, "id"),
          vendorId: field(form, "vendorId"),
          contractId: field(form, "contractId"),
          recurringPlanId: field(form, "recurringPlanId"),
          workOrderId: field(form, "workOrderId"),
          title: field(form, "title"),
          requestDescription: field(form, "requestDescription"),
          responseTargetHours: field(form, "responseTargetHours"),
          completionTargetDays: field(form, "completionTargetDays"),
        },
      }),
    "Internal service request logged with owner-set SLA. Nothing was sent to a supplier.",
  );
}
export async function recordVendorEventAction(form: FormData) {
  const kind = field(form, "kind");
  await execute(
    form,
    kind === "invoice_reviewed" ? "invoiceReview" : "manage",
    (actorUserId, actorSessionId, campgroundId) =>
      recordVendorEvent({
        actorUserId,
        actorSessionId,
        campgroundId,
        input: {
          id: field(form, "id"),
          requestId: field(form, "requestId"),
          kind,
          sourceReference: field(form, "sourceReference"),
          note: field(form, "note"),
          evidenceMediaId: field(form, "evidenceMediaId"),
          reviewsEventId: field(form, "reviewsEventId"),
        },
      }),
    kind === "invoice_reviewed"
      ? "Invoice intake independently acknowledged. No payable or payment was executed."
      : "Immutable vendor follow-up evidence recorded. No external transmission occurred.",
  );
}
