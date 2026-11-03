"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireStaff } from "@/lib/auth/current-session";
import { getCampgroundAuthorization } from "@/lib/authz/postgres.mjs";
import { modulesForPermissions } from "@/lib/command-centre/module-catalog";
import { deleteCommandView, saveCommandView } from "@/lib/command-centre/layout-postgres.mjs";

const path = "/workspaces/management/command";
const field = (form: FormData, key: string) => String(form.get(key) ?? "").trim();
function finish(campgroundId: string, message: string, viewId?: string): never {
  revalidatePath(path);
  const params = new URLSearchParams({ campground: campgroundId, commandNotice: message.slice(0, 180) });
  if (viewId) params.set("view", viewId);
  redirect(path + "?" + params.toString());
}
function safeMessage(error: unknown): string {
  const message = error instanceof Error ? error.message : "";
  if (/view|layout|favorite|search|category|density|metric|version|concurrent|limit|authorized|access|campground|unique|duplicate|name/i.test(message)) {
    return "Not saved: " + message.slice(0, 130);
  }
  return "Not saved. Refresh the current authorized workspace and try again.";
}
export async function saveCommandViewAction(form: FormData) {
  const session = await requireStaff(path);
  const campgroundId = field(form, "campgroundId");
  const authorization = await getCampgroundAuthorization(session.user.id, campgroundId);
  if (!authorization?.permissions.includes("reports.read")) redirect("/auth/not-authorized");
  let message = "Saved to this staff account and campground; live metrics will be recalculated.";
  let viewId: string | undefined;
  try {
    const result = await saveCommandView({
      userId: session.user.id,
      campgroundId,
      authorizedModules: modulesForPermissions(authorization.permissions),
      input: {
        viewId: field(form, "viewId") || null,
        expectedVersion: Number(field(form, "expectedVersion")),
        label: field(form, "label"),
        perspective: field(form, "perspective"),
        category: field(form, "category"),
        searchTerm: field(form, "searchTerm"),
        density: field(form, "density"),
        favoriteHrefs: form.getAll("favoriteHrefs").map(String),
        kpiOrder: form.getAll("kpiOrder").map(String),
        isDefault: field(form, "isDefault") === "yes",
      },
    });
    viewId = result.id;
  } catch (error) {
    message = safeMessage(error);
  }
  finish(campgroundId, message, viewId);
}
export async function deleteCommandViewAction(form: FormData) {
  const session = await requireStaff(path);
  const campgroundId = field(form, "campgroundId");
  const authorization = await getCampgroundAuthorization(session.user.id, campgroundId);
  if (!authorization?.permissions.includes("reports.read")) redirect("/auth/not-authorized");
  let message = "Saved view removed. Existing campground records were not changed.";
  try {
    await deleteCommandView({
      userId: session.user.id,
      campgroundId,
      viewId: field(form, "viewId"),
      expectedVersion: Number(field(form, "expectedVersion")),
    });
  } catch (error) {
    message = safeMessage(error);
  }
  finish(campgroundId, message);
}
