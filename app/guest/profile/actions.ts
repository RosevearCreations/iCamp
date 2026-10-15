"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { requireSignedIn } from "@/lib/auth/current-session";
import {
  archiveGuestSavedItem,
  saveGuestPetProfile,
  saveGuestRvProfile,
  saveGuestVehicleProfile,
  saveOwnGuestProfile,
} from "@/lib/guest-profile/postgres.mjs";

function text(formData: FormData, key: string) {
  return String(formData.get(key) ?? "").trim();
}

function errorMessage(error: unknown) {
  return (error instanceof Error ? error.message : "Guest profile action failed.").slice(
    0,
    300,
  );
}

function pathFor(campgroundId: string) {
  return "/guest/profile?campground=" + encodeURIComponent(campgroundId);
}

async function guestSession(path: string) {
  const session = await requireSignedIn(path);
  if (session.user.accountType !== "guest") {
    redirect("/auth/not-authorized");
  }
  return session;
}

export async function saveOwnGuestProfileAction(formData: FormData) {
  const campgroundId = text(formData, "campgroundId");
  const path = pathFor(campgroundId);
  const session = await guestSession(path);

  try {
    await saveOwnGuestProfile({
      userId: session.user.id,
      campgroundId,
      expectedRowVersion: text(formData, "expectedRowVersion")
        ? Number(text(formData, "expectedRowVersion"))
        : null,
      sourceChannel: "web",
      input: {
        firstName: text(formData, "firstName"),
        lastName: text(formData, "lastName"),
        preferredName: text(formData, "preferredName"),
        contactEmail: text(formData, "contactEmail"),
        contactPhone: text(formData, "contactPhone"),
        preferredContactChannel: text(formData, "preferredContactChannel"),
        saveStayPreferences: formData.get("saveStayPreferences") === "on",
        allowStaffProfileLookup:
          formData.get("allowStaffProfileLookup") === "on",
      },
    });
    revalidatePath(path);
  } catch (error) {
    redirect(path + "&error=" + encodeURIComponent(errorMessage(error)));
  }

  redirect(path + "&saved=" + encodeURIComponent("Guest profile saved."));
}

export async function saveOwnRvAction(formData: FormData) {
  const campgroundId = text(formData, "campgroundId");
  const path = pathFor(campgroundId);
  const session = await guestSession(path);

  try {
    await saveGuestRvProfile({
      actorUserId: session.user.id,
      campgroundId,
      profileId: text(formData, "profileId"),
      sourceChannel: "web",
      input: {
        nickname: text(formData, "nickname"),
        rvKind: text(formData, "rvKind"),
        make: text(formData, "make"),
        model: text(formData, "model"),
        modelYear: text(formData, "modelYear"),
        lengthFeet: text(formData, "lengthFeet"),
        slideOutCount: text(formData, "slideOutCount"),
        electricalServiceAmps: text(formData, "electricalServiceAmps"),
        notes: text(formData, "notes"),
      },
    });
    revalidatePath(path);
  } catch (error) {
    redirect(path + "&error=" + encodeURIComponent(errorMessage(error)));
  }

  redirect(path + "&saved=" + encodeURIComponent("RV profile saved."));
}

export async function saveOwnVehicleAction(formData: FormData) {
  const campgroundId = text(formData, "campgroundId");
  const path = pathFor(campgroundId);
  const session = await guestSession(path);

  try {
    await saveGuestVehicleProfile({
      actorUserId: session.user.id,
      campgroundId,
      profileId: text(formData, "profileId"),
      sourceChannel: "web",
      input: {
        nickname: text(formData, "nickname"),
        vehicleKind: text(formData, "vehicleKind"),
        make: text(formData, "make"),
        model: text(formData, "model"),
        color: text(formData, "color"),
        modelYear: text(formData, "modelYear"),
        notes: text(formData, "notes"),
      },
    });
    revalidatePath(path);
  } catch (error) {
    redirect(path + "&error=" + encodeURIComponent(errorMessage(error)));
  }

  redirect(
    path + "&saved=" + encodeURIComponent("Vehicle profile saved."),
  );
}

export async function saveOwnPetAction(formData: FormData) {
  const campgroundId = text(formData, "campgroundId");
  const path = pathFor(campgroundId);
  const session = await guestSession(path);

  try {
    await saveGuestPetProfile({
      actorUserId: session.user.id,
      campgroundId,
      profileId: text(formData, "profileId"),
      sourceChannel: "web",
      input: {
        name: text(formData, "name"),
        species: text(formData, "species"),
        breed: text(formData, "breed"),
        weightKg: text(formData, "weightKg"),
        notes: text(formData, "notes"),
      },
    });
    revalidatePath(path);
  } catch (error) {
    redirect(path + "&error=" + encodeURIComponent(errorMessage(error)));
  }

  redirect(path + "&saved=" + encodeURIComponent("Pet profile saved."));
}

export async function archiveOwnSavedItemAction(formData: FormData) {
  const campgroundId = text(formData, "campgroundId");
  const path = pathFor(campgroundId);
  const session = await guestSession(path);

  try {
    const itemKind = text(formData, "itemKind");
    if (itemKind !== "rv" && itemKind !== "vehicle" && itemKind !== "pet") {
      throw new Error("Saved item kind is invalid.");
    }
    await archiveGuestSavedItem({
      actorUserId: session.user.id,
      campgroundId,
      profileId: text(formData, "profileId"),
      itemId: text(formData, "itemId"),
      itemKind,
      expectedRowVersion: Number(text(formData, "expectedRowVersion")),
      sourceChannel: "web",
    });
    revalidatePath(path);
  } catch (error) {
    redirect(path + "&error=" + encodeURIComponent(errorMessage(error)));
  }

  redirect(
    path + "&saved=" + encodeURIComponent("Saved stay item archived."),
  );
}
