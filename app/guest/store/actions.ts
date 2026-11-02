"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { requireSignedIn } from "@/lib/auth/current-session";
import {
  addToStoreCart,
  saveStoreDeliveryPlan,
  setStoreCartLineQuantity,
} from "@/lib/store-cart/postgres.mjs";

const path = "/guest/store";
const field = (form: FormData, name: string) =>
  String(form.get(name) ?? "").trim();

async function guestSession() {
  const session = await requireSignedIn(path);
  if (session.user.accountType !== "guest") redirect("/auth/not-authorized");
  return session;
}

function refresh() {
  revalidatePath(path);
  revalidatePath("/store");
  revalidatePath("/guest/stay");
}

export async function addStoreCartItemAction(form: FormData) {
  const session = await guestSession();
  try {
    await addToStoreCart({
      userId: session.user.id,
      actorSessionId: session.sessionId,
      campgroundId: field(form, "campgroundId"),
      productId: field(form, "productId"),
      quantity: field(form, "quantity"),
    });
    refresh();
  } catch (error) {
    if (error && typeof error === "object" && "digest" in error) throw error;
    redirect(`${path}?error=add`);
  }
  redirect(`${path}?saved=add`);
}

export async function changeStoreCartItemAction(form: FormData) {
  const session = await guestSession();
  try {
    await setStoreCartLineQuantity({
      userId: session.user.id,
      actorSessionId: session.sessionId,
      cartId: field(form, "cartId"),
      productId: field(form, "productId"),
      quantity: field(form, "quantity"),
    });
    refresh();
  } catch (error) {
    if (error && typeof error === "object" && "digest" in error) throw error;
    redirect(`${path}?error=quantity`);
  }
  redirect(`${path}?saved=quantity`);
}

export async function saveStoreDeliveryAction(form: FormData) {
  const session = await guestSession();
  try {
    await saveStoreDeliveryPlan({
      userId: session.user.id,
      actorSessionId: session.sessionId,
      cartId: field(form, "cartId"),
      requestReview: field(form, "intent") === "request_review",
      input: {
        fulfillmentPreference: field(form, "fulfillmentPreference"),
        reservationId: field(form, "reservationId"),
        deliveryDate: field(form, "deliveryDate"),
        deliveryNote: field(form, "deliveryNote"),
      },
    });
    refresh();
  } catch (error) {
    if (error && typeof error === "object" && "digest" in error) throw error;
    redirect(`${path}?error=delivery`);
  }
  redirect(`${path}?saved=delivery`);
}
