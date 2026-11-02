"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { requireSignedIn } from "@/lib/auth/current-session";
import { saveOwnAccountProfile } from "@/lib/auth/profile-postgres.mjs";

export async function saveAccountProfileAction(formData: FormData) {
  const session = await requireSignedIn("/auth/profile");
  const displayName = String(formData.get("displayName") ?? "");
  const preferredContact = String(formData.get("preferredContact") ?? "none");
  try {
    await saveOwnAccountProfile({
      userId: session.user.id,
      displayName,
      preferredContact: preferredContact as "none" | "email" | "phone",
    });
    revalidatePath("/auth/profile");
  } catch {
    redirect("/auth/profile?status=invalid");
  }
  redirect("/auth/profile?status=saved");
}
