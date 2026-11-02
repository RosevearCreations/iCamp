"use server";

import { redirect } from "next/navigation";

import { requireSignedIn } from "@/lib/auth/current-session";
import { normalizeBookingDraftInput } from "@/lib/booking-drafts/core.mjs";
import {
  deleteOwnBookingDraft,
  saveOwnBookingDraft,
} from "@/lib/booking-drafts/postgres.mjs";
import { getPublicAccommodationDetail } from "@/lib/public-accommodation-detail/postgres.mjs";

function field(form: FormData, name: string) {
  return String(form.get(name) ?? "").trim();
}

function returnPath(form: FormData) {
  const query = new URLSearchParams({
    campground: field(form, "campgroundSlug"),
    arrivalDate: field(form, "arrivalDate"),
    departureDate: field(form, "departureDate"),
  });
  for (let index = 1; index <= 3; index += 1) {
    const extra = field(form, `extra${index}`);
    if (extra) {
      query.set(`extra${index}`, extra);
      query.set(`quantity${index}`, field(form, `quantity${index}`));
    }
  }
  return `/booking/accommodations/${encodeURIComponent(field(form, "accommodationId"))}?${query}`;
}

async function guestSession(path: string) {
  const session = await requireSignedIn(path);
  if (session.user.accountType !== "guest") redirect("/auth/not-authorized");
  return session;
}

export async function saveBookingDraftAction(form: FormData) {
  const path = returnPath(form);
  const session = await guestSession(path);
  if (form.get("saveConsent") !== "on") {
    redirect(`${path}&draftError=consent`);
  }
  let id = "";
  try {
    const input = normalizeBookingDraftInput({
      campgroundSlug: field(form, "campgroundSlug"),
      accommodationId: field(form, "accommodationId"),
      arrivalDate: field(form, "arrivalDate"),
      departureDate: field(form, "departureDate"),
      ...Object.fromEntries(
        [1, 2, 3].flatMap((index) => [
          [`extra${index}`, field(form, `extra${index}`)],
          [`quantity${index}`, field(form, `quantity${index}`)],
        ]),
      ),
    });
    const detail = await getPublicAccommodationDetail({
      ...input,
      selections: input.selections,
    });
    if (!detail || detail.selectionError) {
      redirect(`${path}&draftError=stale`);
    }
    id = await saveOwnBookingDraft({ userId: session.user.id, input, detail });
  } catch (error) {
    // Next.js redirects throw a dedicated control-flow exception. Keep the
    // error surface finite so database messages never appear in public URLs.
    if (error && typeof error === "object" && "digest" in error) throw error;
    redirect(`${path}&draftError=unavailable`);
  }
  redirect(`/guest/booking-drafts/${encodeURIComponent(id)}?saved=1`);
}

export async function deleteBookingDraftAction(form: FormData) {
  const session = await guestSession("/guest/booking-drafts");
  const draftId = field(form, "draftId");
  if (!/^[0-9a-f-]{36}$/iu.test(draftId)) {
    redirect("/guest/booking-drafts?deleted=0");
  }
  try {
    await deleteOwnBookingDraft({ userId: session.user.id, draftId });
  } catch {
    redirect("/guest/booking-drafts?deleted=0");
  }
  redirect("/guest/booking-drafts?deleted=1");
}
