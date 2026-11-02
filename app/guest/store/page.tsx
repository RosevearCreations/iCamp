import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";

import { AppShell } from "@/components/app-shell";
import { SectionHeading } from "@/components/section-heading";
import { requireSignedIn } from "@/lib/auth/current-session";
import { listGuestRecreationStays } from "@/lib/recreation-events/postgres.mjs";
import { storeStockLabel } from "@/lib/store-cart/core.mjs";
import {
  listOwnStoreCarts,
  listPublicStoreProducts,
  listStoreCampgrounds,
} from "@/lib/store-cart/postgres.mjs";

import {
  addStoreCartItemAction,
  changeStoreCartItemAction,
  saveStoreDeliveryAction,
} from "./actions";
import styles from "../../events/recreation.module.css";

export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "My guest store carts · iCamp",
  description:
    "Private saved campground store planning carts, delivery preferences and internal review requests.",
  robots: { index: false, follow: false },
};

export default async function GuestStoreCartPage({
  searchParams,
}: {
  searchParams: Promise<{
    campground?: string;
    product?: string;
    saved?: string;
    error?: string;
  }>;
}) {
  if (!process.env.DATABASE_URL?.trim())
    return (
      <AppShell>
        <section className="content-panel" role="status">
          <h1>Cart drafts are unavailable</h1>
          <p>
            No database is connected. No draft, payment or delivery request was
            created.
          </p>
        </section>
      </AppShell>
    );
  const session = await requireSignedIn("/guest/store");
  if (session.user.accountType !== "guest") redirect("/auth/not-authorized");
  const params = await searchParams;
  const [campgrounds, products, carts, stays] = await Promise.all([
    listStoreCampgrounds(),
    listPublicStoreProducts(),
    listOwnStoreCarts({ userId: session.user.id }),
    listGuestRecreationStays({ userId: session.user.id }),
  ]);
  const campgroundId =
    campgrounds.find((c) => c.id === params.campground)?.id ??
    carts[0]?.campgroundId ??
    campgrounds[0]?.id ??
    "";
  const availableProducts = products.filter(
    (p) => p.campgroundId === campgroundId,
  );
  const selectedProduct = availableProducts.find(
    (p) => p.id === params.product,
  );
  return (
    <AppShell>
      <div className="page-stack">
        <nav className="breadcrumbs" aria-label="Breadcrumb">
          <Link href="/guest/stay">My Stay</Link>
          <span>/</span>
          <span>Store carts</span>
        </nav>
        <section className="hero-panel">
          <p className="eyebrow">Build 183 · Cross-device cart drafts</p>
          <h1>Plan your campground store visit</h1>
          <p className="hero-panel__lead">
            Save products to your private cart across signed-in devices. Office
            pickup or campsite delivery is a preference for staff review only.
            No order, invoice, payment, inventory reservation, notification or
            delivery dispatch occurs.
          </p>
          <div className="hero-actions">
            <Link className="primary-link" href="/store">
              Browse the store
            </Link>
            <Link className="secondary-link" href="/guest/stay">
              My Stay
            </Link>
          </div>
        </section>
        {params.saved ? (
          <p className={styles.notice} role="status">
            Your cart planning update was saved. Staff review, where requested,
            is internal and does not guarantee supply or delivery.
          </p>
        ) : null}
        {params.error ? (
          <p className={styles.warning} role="alert">
            The cart was not updated. An item, reservation, delivery date,
            review state or account permission may have changed. Refresh and try
            again or ask the office.
          </p>
        ) : null}
        <p className={styles.notice}>
          Changing cart items returns the cart to draft and clears its prior
          pickup/delivery choice. Recheck the preference and eligible stay
          before requesting another review.
        </p>
        <section className="content-panel">
          <SectionHeading
            id="store-cart-select"
            eyebrow="Private planning"
            title="Choose products"
            helpTopic="shell.overview"
          />
          <form method="get" className={styles.filters}>
            <label>
              Campground
              <select name="campground" defaultValue={campgroundId}>
                {campgrounds.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </label>
            <button className="primary-button" type="submit">
              Browse campground
            </button>
          </form>
          {!campgroundId ? (
            <p>No active campground is available for store planning.</p>
          ) : availableProducts.length === 0 ? (
            <p>
              No store products have been published at this campground yet.
              Please contact the office.
            </p>
          ) : (
            <div className={styles.cards}>
              {availableProducts.map((p) => (
                <article className={styles.card} key={p.id}>
                  <h3>{p.name}</h3>
                  <p>{p.description}</p>
                  <p>{storeStockLabel(p)}</p>
                  <form action={addStoreCartItemAction} className={styles.form}>
                    <input
                      type="hidden"
                      name="campgroundId"
                      value={p.campgroundId}
                    />
                    <input type="hidden" name="productId" value={p.id} />
                    <label>
                      Quantity to plan
                      <input
                        type="number"
                        name="quantity"
                        min={1}
                        max={20}
                        defaultValue={1}
                        required
                      />
                    </label>
                    <button type="submit" className="primary-button">
                      Add to draft
                      {selectedProduct?.id === p.id ? " · selected" : ""}
                    </button>
                  </form>
                </article>
              ))}
            </div>
          )}
        </section>
        <section className="content-panel">
          <SectionHeading
            id="store-saved-carts"
            eyebrow="Saved across devices"
            title="My cart drafts and staff decisions"
            helpTopic="shell.overview"
          />
          {carts.length === 0 ? (
            <p>
              You have no saved carts. Add a published product to begin; the
              cart is not a purchase.
            </p>
          ) : (
            carts.map((cart) => (
              <article className={styles.card} key={cart.id}>
                <h3>
                  {cart.campgroundName} ·{" "}
                  {cart.reviewState.replaceAll("_", " ")}
                </h3>
                <p>
                  Last saved: {cart.updatedAt}. A reviewed request does not mean
                  the items were set aside, purchased or delivered.
                </p>
                {cart.lines.length === 0 ? (
                  <p>Your cart is empty.</p>
                ) : (
                  <ul>
                    {cart.lines.map((line) => (
                      <li key={line.productId}>
                        <strong>{line.productName}</strong> (SKU {line.sku}) ·{" "}
                        {line.quantity} planned
                        <p>
                          {line.isPublished
                            ? storeStockLabel(line)
                            : "No longer published — remove this item before requesting review."}
                        </p>
                        <form
                          action={changeStoreCartItemAction}
                          className={styles.filters}
                        >
                          <input type="hidden" name="cartId" value={cart.id} />
                          <input
                            type="hidden"
                            name="productId"
                            value={line.productId}
                          />
                          <label>
                            Quantity (0 removes)
                            <input
                              type="number"
                              name="quantity"
                              min={0}
                              max={20}
                              defaultValue={line.quantity}
                              required
                            />
                          </label>
                          <button type="submit" className="secondary-button">
                            Update quantity
                          </button>
                        </form>
                      </li>
                    ))}
                  </ul>
                )}
                <form action={saveStoreDeliveryAction} className={styles.form}>
                  <input type="hidden" name="cartId" value={cart.id} />
                  <label>
                    Handoff preference
                    <select
                      name="fulfillmentPreference"
                      defaultValue={cart.fulfillmentPreference}
                    >
                      <option value="office_pickup">
                        Discuss office pickup
                      </option>
                      <option value="campsite_delivery">
                        Ask about campsite delivery
                      </option>
                    </select>
                  </label>
                  <p>
                    For campsite delivery, choose one of your eligible stays
                    below and enter a local date within its arrival and
                    departure window (departure day excluded). Office pickup
                    ignores these date and reservation fields.
                  </p>
                  <label>
                    Eligible stay
                    <select
                      name="reservationId"
                      defaultValue={cart.reservationId ?? ""}
                    >
                      <option value="">No stay / office pickup only</option>
                      {stays
                        .filter((s) => s.campgroundId === cart.campgroundId)
                        .map((s) => (
                          <option key={s.id} value={s.id}>
                            {s.arrivalDate} to {s.departureDate} · {s.status} ·{" "}
                            {s.campgroundName}
                          </option>
                        ))}
                    </select>
                  </label>
                  <label>
                    Preferred campsite delivery date
                    <input
                      name="deliveryDate"
                      type="date"
                      defaultValue={cart.deliveryDate ?? ""}
                    />
                  </label>
                  <label>
                    Optional handoff note (no payment information)
                    <textarea
                      name="deliveryNote"
                      maxLength={400}
                      defaultValue={cart.deliveryNote}
                    />
                  </label>
                  <div className={styles.controls}>
                    <button
                      type="submit"
                      name="intent"
                      value="save"
                      className="secondary-button"
                    >
                      Save preference as draft
                    </button>
                    <button
                      type="submit"
                      name="intent"
                      value="request_review"
                      className="primary-button"
                      disabled={cart.lines.length === 0}
                    >
                      Request internal staff review
                    </button>
                  </div>
                </form>
              </article>
            ))
          )}
        </section>
      </div>
    </AppShell>
  );
}
