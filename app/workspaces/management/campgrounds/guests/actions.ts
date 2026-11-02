"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { requireStaff } from "@/lib/auth/current-session";
import {
  archiveGuestSavedItem,
  linkGuestProfileToReservation,
  linkGuestProfileToSeasonalAssignment,
  saveGuestPetProfile,
  saveGuestRvProfile,
  saveGuestVehicleProfile,
  saveStaffGuestProfile,
} from "@/lib/guest-profile/postgres.mjs";

function text(formData: FormData, key: string) {
  return String(formData.get(key) ?? "").trim();
}

function errorMessage(error: unknown) {
  return (
    error instanceof Error ? error.message : "Guest profile action failed."
  ).slice(0, 300);
}

function deskPath(campgroundId: string) {
  return (
    "/workspaces/management/campgrounds/guests?campground=" +
    encodeURIComponent(campgroundId)
  );
}

function profilePath(campgroundId: string, profileId: string) {
  return (
    "/workspaces/management/campgrounds/guests/" +
    encodeURIComponent(profileId) +
    "?campground=" +
    encodeURIComponent(campgroundId)
  );
}

export async function saveStaffGuestProfileAction(formData: FormData) {
  const campgroundId = text(formData, "campgroundId");
  const profileId = text(formData, "profileId");
  const returnPath = profileId
    ? profilePath(campgroundId, profileId)
    : deskPath(campgroundId);
  const session = await requireStaff(returnPath);
  let destination: string;

  try {
    const saved = await saveStaffGuestProfile({
      actorUserId: session.user.id,
      campgroundId,
      profileId: profileId || null,
      accountEmail: text(formData, "accountEmail") || null,
      expectedRowVersion: text(formData, "expectedRowVersion")
        ? Number(text(formData, "expectedRowVersion"))
        : null,
      sourceChannel: "staff",
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
    revalidatePath(deskPath(campgroundId));
    revalidatePath(profilePath(campgroundId, saved.id));
    destination =
      profilePath(campgroundId, saved.id) +
      "&saved=" +
      encodeURIComponent("Guest profile saved.");
  } catch (error) {
    destination =
      returnPath + "&error=" + encodeURIComponent(errorMessage(error));
  }

  redirect(destination);
}

async function saveItemAction(
  formData: FormData,
  kind: "rv" | "vehicle" | "pet",
) {
  const campgroundId = text(formData, "campgroundId");
  const profileId = text(formData, "profileId");
  const path = profilePath(campgroundId, profileId);
  const session = await requireStaff(path);

  try {
    if (kind === "rv") {
      await saveGuestRvProfile({
        actorUserId: session.user.id,
        campgroundId,
        profileId,
        sourceChannel: "staff",
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
    } else if (kind === "vehicle") {
      await saveGuestVehicleProfile({
        actorUserId: session.user.id,
        campgroundId,
        profileId,
        sourceChannel: "staff",
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
    } else {
      await saveGuestPetProfile({
        actorUserId: session.user.id,
        campgroundId,
        profileId,
        sourceChannel: "staff",
        input: {
          name: text(formData, "name"),
          species: text(formData, "species"),
          breed: text(formData, "breed"),
          weightKg: text(formData, "weightKg"),
          notes: text(formData, "notes"),
        },
      });
    }
    revalidatePath(path);
  } catch (error) {
    redirect(path + "&error=" + encodeURIComponent(errorMessage(error)));
  }

  redirect(
    path +
      "&saved=" +
      encodeURIComponent(
        kind === "rv"
          ? "RV profile saved."
          : kind === "vehicle"
            ? "Vehicle profile saved."
            : "Pet profile saved.",
      ),
  );
}

export async function saveStaffRvAction(formData: FormData) {
  return saveItemAction(formData, "rv");
}

export async function saveStaffVehicleAction(formData: FormData) {
  return saveItemAction(formData, "vehicle");
}

export async function saveStaffPetAction(formData: FormData) {
  return saveItemAction(formData, "pet");
}

export async function archiveStaffSavedItemAction(formData: FormData) {
  const campgroundId = text(formData, "campgroundId");
  const profileId = text(formData, "profileId");
  const path = profilePath(campgroundId, profileId);
  const session = await requireStaff(path);

  try {
    const itemKind = text(formData, "itemKind");
    if (itemKind !== "rv" && itemKind !== "vehicle" && itemKind !== "pet") {
      throw new Error("Saved item kind is invalid.");
    }
    await archiveGuestSavedItem({
      actorUserId: session.user.id,
      campgroundId,
      profileId,
      itemId: text(formData, "itemId"),
      itemKind,
      expectedRowVersion: Number(text(formData, "expectedRowVersion")),
      sourceChannel: "staff",
    });
    revalidatePath(path);
  } catch (error) {
    redirect(path + "&error=" + encodeURIComponent(errorMessage(error)));
  }

  redirect(path + "&saved=" + encodeURIComponent("Saved stay item archived."));
}

export async function linkReservationAction(formData: FormData) {
  const campgroundId = text(formData, "campgroundId");
  const profileId = text(formData, "profileId");
  const path = profilePath(campgroundId, profileId);
  const session = await requireStaff(path);

  try {
    await linkGuestProfileToReservation({
      actorUserId: session.user.id,
      campgroundId,
      profileId,
      reservationId: text(formData, "reservationId"),
      sourceChannel: "staff",
    });
    revalidatePath(path);
  } catch (error) {
    redirect(path + "&error=" + encodeURIComponent(errorMessage(error)));
  }

  redirect(
    path +
      "&saved=" +
      encodeURIComponent("Reservation linked to guest profile."),
  );
}

export async function linkSeasonalAssignmentAction(formData: FormData) {
  const campgroundId = text(formData, "campgroundId");
  const profileId = text(formData, "profileId");
  const path = profilePath(campgroundId, profileId);
  const session = await requireStaff(path);

  try {
    await linkGuestProfileToSeasonalAssignment({
      actorUserId: session.user.id,
      campgroundId,
      profileId,
      assignmentId: text(formData, "assignmentId"),
      sourceChannel: "staff",
    });
    revalidatePath(path);
  } catch (error) {
    redirect(path + "&error=" + encodeURIComponent(errorMessage(error)));
  }

  redirect(
    path +
      "&saved=" +
      encodeURIComponent("Seasonal/yearly assignment linked to guest profile."),
  );
}
