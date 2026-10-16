"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { requireCampgroundPermission } from "@/lib/authz/current-user";
import { saveMyStaySettings } from "@/lib/my-stay/postgres.mjs";

const path = "/workspaces/management/campgrounds/guest-experience";

function field(formData: FormData, key: string) {
  return String(formData.get(key) ?? "").trim();
}

export async function saveMyStaySettingsAction(formData: FormData) {
  const campgroundId = field(formData, "campgroundId");
  const session = await requireCampgroundPermission(
    campgroundId,
    "campground.configuration",
    path,
  );

  await saveMyStaySettings({
    actorUserId: session.user.id,
    actorSessionId: session.sessionId,
    campgroundId,
    expectedRowVersion: Number(field(formData, "rowVersion")),
    input: {
      guestRulesSummary: field(formData, "guestRulesSummary"),
      wifiNetworkName: field(formData, "wifiNetworkName"),
      wifiAccessInstructions: field(formData, "wifiAccessInstructions"),
      assistanceInstructions: field(formData, "assistanceInstructions"),
      storeUrl: field(formData, "storeUrl"),
      rentalsUrl: field(formData, "rentalsUrl"),
      eventsUrl: field(formData, "eventsUrl"),
      localInterestsUrl: field(formData, "localInterestsUrl"),
      assistanceUrl: field(formData, "assistanceUrl"),
    },
  });

  revalidatePath(path);
  revalidatePath("/guest/stay");
  redirect(
    path +
      "?campground=" +
      encodeURIComponent(campgroundId) +
      "&saved=" +
      encodeURIComponent("My Stay guest experience settings saved."),
  );
}
