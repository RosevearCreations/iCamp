"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { requireCampgroundPermission } from "@/lib/authz/current-user";
import {
  reviewStoreCart,
  saveStoreProduct,
} from "@/lib/store-cart/postgres.mjs";

const path = "/workspaces/management/campgrounds/store";
const field = (form: FormData, name: string) =>
  String(form.get(name) ?? "").trim();
const back = (campgroundId: string, outcome: string) =>
  `${path}?campground=${encodeURIComponent(campgroundId)}&${outcome}`;

function refresh() {
  revalidatePath(path);
  revalidatePath("/store");
  revalidatePath("/guest/store");
}

export async function saveStoreProductAction(form: FormData) {
  const campgroundId = field(form, "campgroundId");
  const session = await requireCampgroundPermission(
    campgroundId,
    "inventory.manage",
    path,
  );
  try {
    await saveStoreProduct({
      actorUserId: session.user.id,
      actorSessionId: session.sessionId,
      campgroundId,
      productId: field(form, "productId") || undefined,
      expectedRowVersion: Number(field(form, "rowVersion")),
      input: {
        sku: field(form, "sku"),
        name: field(form, "name"),
        description: field(form, "description"),
        category: field(form, "category"),
        stock: field(form, "stock"),
        isPublished: form.get("isPublished") === "on",
      },
    });
    refresh();
  } catch (error) {
    if (error && typeof error === "object" && "digest" in error) throw error;
    redirect(back(campgroundId, "error=product"));
  }
  redirect(back(campgroundId, "saved=product"));
}

export async function reviewStoreCartAction(form: FormData) {
  const campgroundId = field(form, "campgroundId");
  const session = await requireCampgroundPermission(
    campgroundId,
    "inventory.manage",
    path,
  );
  try {
    await reviewStoreCart({
      actorUserId: session.user.id,
      actorSessionId: session.sessionId,
      campgroundId,
      cartId: field(form, "cartId"),
      decision: field(form, "decision"),
    });
    refresh();
  } catch (error) {
    if (error && typeof error === "object" && "digest" in error) throw error;
    redirect(back(campgroundId, "error=review"));
  }
  redirect(back(campgroundId, "saved=review"));
}
