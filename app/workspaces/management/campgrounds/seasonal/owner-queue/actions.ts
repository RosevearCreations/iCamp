"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireStaff } from "@/lib/auth/current-session";
import {
  getOwnerQueuePermissions,
  recordRenewalIntent,
  createOwnerTask,
  recordOwnerTaskEvent,
} from "@/lib/seasonal-owner-queue/postgres.mjs";

const path = "/workspaces/management/campgrounds/seasonal/owner-queue";
const field = (form: FormData, key: string) => String(form.get(key) ?? "").trim();
function finish(campgroundId: string, message: string): never {
  revalidatePath(path);
  redirect(path + "?campground=" + encodeURIComponent(campgroundId) + "&saved=" + encodeURIComponent(message.slice(0, 240)));
}
async function run(form: FormData, required: "record" | "review", callback: (actor: string, camp: string) => Promise<unknown>, successful: string) {
  const camp = field(form, "campgroundId");
  const session = await requireStaff(path);
  const permissions = await getOwnerQueuePermissions(session.user.id, camp);
  if (!permissions[required]) redirect("/auth/not-authorized");
  let result = successful;
  try {
    await callback(session.user.id, camp);
  } catch (error) {
    const message = error instanceof Error ? error.message : "";
    result = /stale|renewal|assignment|version|evidence|source|date|task|scope|independent|authorized|length|invalid|permission|campground/i.test(message)
      ? "Not saved: " + message.slice(0, 195)
      : "Not saved: review the current source and permissions, then retry.";
  }
  finish(camp, result);
}
export async function recordRenewalIntentAction(form: FormData) {
  await run(form, "record", (actorUserId, campgroundId) =>
    recordRenewalIntent({
      actorUserId,campgroundId,
      input:{
        id: field(form,"id"),assignmentId:field(form,"assignmentId"),
        preference:field(form,"preference"),proposedTermEndsOn:field(form,"proposedTermEndsOn"),
        sourceReference:field(form,"sourceReference"),note:field(form,"note")
      }
    }),"Renewal preference evidence saved; no term has been renewed or charged.");
}
export async function createOwnerTaskAction(form: FormData) {
  await run(form,"record",(actorUserId,campgroundId)=>
    createOwnerTask({
      actorUserId,campgroundId,
      input:{
        id:field(form,"id"),assignmentId:field(form,"assignmentId"),
        taskKind:field(form,"taskKind"),dueOn:field(form,"dueOn"),
        sourceReference:field(form,"sourceReference"),description:field(form,"description")
      }
    }),"Internal owner follow-up task recorded; no notification was sent.");
}
export async function recordOwnerTaskEventAction(form: FormData) {
  const eventKind=field(form,"eventKind");
  await run(form,eventKind==="owner_acknowledged"?"review":"record",(actorUserId,campgroundId)=>
    recordOwnerTaskEvent({
      actorUserId,campgroundId,
      input:{
        id:field(form,"id"),taskId:field(form,"taskId"),
        eventKind,reason:field(form,"reason")
      }
    }),"Append-only owner follow-up recorded. Canonical safety holds remain unchanged.");
}
