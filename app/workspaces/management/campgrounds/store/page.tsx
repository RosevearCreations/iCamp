import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";

import { AppShell } from "@/components/app-shell";
import { SectionHeading } from "@/components/section-heading";
import { requireAnyCampgroundPermission } from "@/lib/authz/current-user";
import {
  getCampgroundAuthorization,
  listAssignedCampgrounds,
} from "@/lib/authz/postgres.mjs";
import { storeCategories, storeStockLabel } from "@/lib/store-cart/core.mjs";
import type { StoreProduct } from "@/lib/store-cart/postgres.mjs";
import {
  listManagedStoreProducts,
  listStoreReviewQueue,
} from "@/lib/store-cart/postgres.mjs";

import { reviewStoreCartAction, saveStoreProductAction } from "./actions";
import styles from "../../../../events/recreation.module.css";

export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "Campground store management · iCamp",
  description:
    "Private staff-reviewed retail catalog and guest cart preference review queue.",
  robots: { index: false, follow: false },
};

function ProductEditor({
  product,
  campgroundId,
}: {
  product: StoreProduct | null;
  campgroundId: string;
}) {
  return (
    <form action={saveStoreProductAction} className={styles.form}>
      <input type="hidden" name="campgroundId" value={campgroundId} />
      <input type="hidden" name="productId" value={product?.id ?? ""} />
      <input type="hidden" name="rowVersion" value={product?.rowVersion ?? 0} />
      <label>
        Campground SKU
        <input
          name="sku"
          minLength={1}
          maxLength={64}
          required
          defaultValue={product?.sku ?? ""}
          placeholder="FIREWOOD-BUNDLE"
        />
      </label>
      <label>
        Product name
        <input
          name="name"
          minLength={2}
          maxLength={160}
          required
          defaultValue={product?.name ?? ""}
        />
      </label>
      <label>
        Category
        <select
          name="category"
          defaultValue={product?.category ?? "essentials"}
        >
          {storeCategories.map((category) => (
            <option value={category} key={category}>
              {category}
            </option>
          ))}
        </select>
      </label>
      <label>
        Staff-reviewed description
        <textarea
          name="description"
          minLength={10}
          maxLength={1200}
          required
          defaultValue={product?.description ?? ""}
        />
      </label>
      <label>
        Staff-observed stock count (0–9999; blank means not verified)
        <input
          name="stock"
          type="number"
          min={0}
          max={9999}
          defaultValue={product?.staffReportedStock ?? ""}
        />
      </label>
      <label>
        <input
          name="isPublished"
          type="checkbox"
          defaultChecked={product?.isPublished ?? false}
        />{" "}
        Publish this staff-reviewed product
      </label>
      <p>
        Saving a nonempty count records a new staff-review timestamp. Product
        listings carry no pricing or stock reservation. Uncheck publish to
        remove the item from guest discovery; existing cart lines remain visible
        to their owners as no longer published.
      </p>
      <button className="primary-button" type="submit">
        {product ? "Update staff-attested listing" : "Create catalog listing"}
      </button>
    </form>
  );
}

export default async function ManageStorePage({
  searchParams,
}: {
  searchParams: Promise<{
    campground?: string;
    saved?: string;
    error?: string;
  }>;
}) {
  const path = "/workspaces/management/campgrounds/store";
  const session = await requireAnyCampgroundPermission(
    "inventory.manage",
    path,
  );
  const params = await searchParams;
  const assigned = await listAssignedCampgrounds(session.user.id);
  const authorized = (
    await Promise.all(
      assigned.map(async (cg) => {
        const access = await getCampgroundAuthorization(
          session.user.id,
          cg.campgroundId,
        );
        return access?.permissions.includes("inventory.manage") ? cg : null;
      }),
    )
  ).filter((cg): cg is NonNullable<typeof cg> => cg !== null);
  if (!authorized.length) redirect("/auth/not-authorized");
  const selected =
    authorized.find((cg) => cg.campgroundId === params.campground) ??
    authorized[0];
  const [products, reviews] = await Promise.all([
    listManagedStoreProducts({
      userId: session.user.id,
      campgroundId: selected.campgroundId,
    }),
    listStoreReviewQueue({
      userId: session.user.id,
      campgroundId: selected.campgroundId,
    }),
  ]);
  return (
    <AppShell>
      <div className="page-stack">
        <nav className="breadcrumbs" aria-label="Breadcrumb">
          <Link href="/workspaces/management/campgrounds">Campgrounds</Link>
          <span>/</span>
          <span>Store management</span>
        </nav>
        <section className="hero-panel">
          <p className="eyebrow">Build 183 · Inventory-managed catalog</p>
          <h1>Guest store listings & cart handoff</h1>
          <p className="hero-panel__lead">
            Publish only items reviewed by your campground. Count snapshots must
            be observed by staff. Review guests’ requested cart and
            pickup/delivery preferences internally. This queue does not fulfill,
            reserve, bill or message anyone.
          </p>
          <div className="hero-actions">
            <Link className="secondary-link" href="/store">
              Public catalog
            </Link>
          </div>
        </section>
        {params.saved ? (
          <p className={styles.notice} role="status">
            Saved and audited internally. No inventory, payment or delivery
            dispatch occurred.
          </p>
        ) : null}
        {params.error ? (
          <p className={styles.warning} role="alert">
            The update was not saved. Review SKU uniqueness, data validity,
            current guest request state and permissions, then refresh.
          </p>
        ) : null}
        <section className="content-panel">
          <SectionHeading
            eyebrow="Campground-scoped permission"
            title="Select store"
            id="store-management-select"
            helpTopic="campground.structure"
          />
          <form className={styles.filters} method="get">
            <label>
              Campground
              <select name="campground" defaultValue={selected.campgroundId}>
                {authorized.map((cg) => (
                  <option key={cg.campgroundId} value={cg.campgroundId}>
                    {cg.campgroundName}
                  </option>
                ))}
              </select>
            </label>
            <button className="primary-button" type="submit">
              Open store
            </button>
          </form>
        </section>
        <section className="content-panel">
          <SectionHeading
            eyebrow="Staff-attested"
            title="Create new product"
            id="store-create-product"
            helpTopic="shell.overview"
          />
          <ProductEditor product={null} campgroundId={selected.campgroundId} />
        </section>
        <section className="content-panel">
          <SectionHeading
            eyebrow="Current listings"
            title={`${products.length} managed product${products.length === 1 ? "" : "s"}`}
            id="store-manage-products"
            helpTopic="shell.overview"
          />
          {products.length === 0 ? (
            <p>
              No products have been entered. The public catalog will remain
              empty until staff publishes reviewed listings.
            </p>
          ) : (
            <div className={styles.cards}>
              {products.map((p) => (
                <article className={styles.card} key={p.id}>
                  <h3>
                    {p.name} · {p.isPublished ? "Published" : "Draft"}
                  </h3>
                  <p>
                    SKU {p.sku} · {storeStockLabel(p)}
                  </p>
                  <ProductEditor
                    product={p}
                    campgroundId={selected.campgroundId}
                  />
                </article>
              ))}
            </div>
          )}
        </section>
        <section className="content-panel">
          <SectionHeading
            eyebrow="Staff decision only"
            title="Guest cart review queue"
            id="store-review-queue"
            helpTopic="shell.overview"
          />
          {reviews.length === 0 ? (
            <p>No guest cart reviews have been requested.</p>
          ) : (
            <div className={styles.cards}>
              {reviews.map((cart) => (
                <article className={styles.card} key={cart.id}>
                  <h3>
                    Request {cart.id.slice(0, 8)} · {cart.reviewState}
                  </h3>
                  <p>
                    Requested {cart.reviewRequestedAt ?? "not submitted"} · Last
                    updated {cart.updatedAt}
                  </p>
                  <p>
                    Preference:{" "}
                    {cart.fulfillmentPreference === "campsite_delivery"
                      ? "Campsite delivery discussion"
                      : "Office pickup discussion"}
                  </p>
                  {cart.reservationId ? (
                    <p>
                      Stay reference: {cart.reservationId} · Requested date:{" "}
                      {cart.deliveryDate ?? "none"}
                    </p>
                  ) : null}
                  {cart.deliveryNote ? (
                    <p>Guest note: {cart.deliveryNote}</p>
                  ) : null}
                  <ul>
                    {cart.lines.map((line) => (
                      <li key={line.productId}>
                        {line.productName} (SKU {line.sku}) · {line.quantity}{" "}
                        requested ·{" "}
                        {line.isPublished ? "Published" : "Unpublished"}
                      </li>
                    ))}
                  </ul>
                  {cart.reviewState === "submitted" ? (
                    <form
                      action={reviewStoreCartAction}
                      className={styles.controls}
                    >
                      <input
                        type="hidden"
                        name="campgroundId"
                        value={selected.campgroundId}
                      />
                      <input type="hidden" name="cartId" value={cart.id} />
                      <button
                        type="submit"
                        name="decision"
                        value="reviewed"
                        className="primary-button"
                      >
                        Mark internally reviewed
                      </button>
                      <button
                        type="submit"
                        name="decision"
                        value="declined"
                        className="secondary-button"
                      >
                        Decline planning request
                      </button>
                    </form>
                  ) : (
                    <p>
                      Decision recorded. No order or fulfillment action was
                      taken.
                    </p>
                  )}
                </article>
              ))}
            </div>
          )}
        </section>
      </div>
    </AppShell>
  );
}
