import type { Metadata } from "next";
import Link from "next/link";

import { AppShell } from "@/components/app-shell";
import { SectionHeading } from "@/components/section-heading";
import { storeCategories, storeStockLabel } from "@/lib/store-cart/core.mjs";
import {
  listPublicStoreProducts,
  listStoreCampgrounds,
} from "@/lib/store-cart/postgres.mjs";

import styles from "../events/recreation.module.css";

export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "Campground guest store · iCamp",
  description:
    "Staff-reviewed campground store products and stock snapshots. Browse without checkout or purchase.",
};

export default async function StoreDiscoveryPage({
  searchParams,
}: {
  searchParams: Promise<{
    campground?: string;
    category?: string;
    search?: string;
  }>;
}) {
  if (!process.env.DATABASE_URL?.trim())
    return (
      <AppShell>
        <section className="content-panel" role="status">
          <h1>Store catalog is unavailable</h1>
          <p>
            The database is not connected. No stock or cart can be verified;
            please ask the campground office.
          </p>
        </section>
      </AppShell>
    );
  const params = await searchParams;
  const [campgrounds, products] = await Promise.all([
    listStoreCampgrounds(),
    listPublicStoreProducts({
      campgroundSlug: params.campground,
      category: params.category,
      search: params.search,
    }),
  ]);
  return (
    <AppShell>
      <div className="page-stack">
        <nav className="breadcrumbs" aria-label="Breadcrumb">
          <Link href="/">iCamp</Link>
          <span>/</span>
          <span>Guest store</span>
        </nav>
        <section className="hero-panel">
          <p className="eyebrow">Build 183 · Guest store discovery</p>
          <h1>Explore your campground store</h1>
          <p className="hero-panel__lead">
            Browse campground-reviewed essentials, food and camping goods.
            Availability is a dated staff-reported snapshot, not live inventory.
            Save a planning cart for your visit; nothing is purchased, charged,
            reserved or scheduled for delivery.
          </p>
          <div className="hero-actions">
            <Link className="primary-link" href="/guest/store">
              My cart drafts
            </Link>
            <Link className="secondary-link" href="/guest/stay">
              My Stay
            </Link>
          </div>
        </section>
        <section className="content-panel">
          <SectionHeading
            id="store-filters"
            eyebrow="Published by campground staff"
            title="Find store items"
            helpTopic="shell.overview"
          />
          <form method="get" className={styles.filters} role="search">
            <label>
              Campground
              <select name="campground" defaultValue={params.campground ?? ""}>
                <option value="">All campgrounds</option>
                {campgrounds.map((c) => (
                  <option key={c.id} value={c.slug}>
                    {c.name}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Category
              <select name="category" defaultValue={params.category ?? ""}>
                <option value="">All categories</option>
                {storeCategories.map((category) => (
                  <option key={category} value={category}>
                    {category}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Search
              <input
                name="search"
                type="search"
                maxLength={100}
                defaultValue={params.search ?? ""}
                placeholder="Firewood, sunscreen…"
              />
            </label>
            <button className="primary-button" type="submit">
              Filter products
            </button>
          </form>
        </section>
        <section className="content-panel" aria-live="polite">
          <SectionHeading
            id="store-products"
            eyebrow="Staff-attested, not reserved"
            title={`${products.length} published product${products.length === 1 ? "" : "s"}`}
            helpTopic="shell.overview"
          />
          {products.length === 0 ? (
            <p>
              No products have been published for these filters. Campgrounds
              control their own catalogs. Contact the office to confirm what is
              available.
            </p>
          ) : (
            <div className={styles.cards}>
              {products.map((p) => (
                <article className={styles.card} key={p.id}>
                  <p className={styles.tag}>
                    {p.campgroundName} · {p.category}
                  </p>
                  <h3>{p.name}</h3>
                  <p>{p.description}</p>
                  <p>
                    <strong>SKU:</strong> {p.sku}
                  </p>
                  <p>{storeStockLabel(p)}</p>
                  <p>
                    Pricing is not provided. No checkout, purchase, stock hold
                    or delivery commitment.
                  </p>
                  <Link
                    href={`/guest/store?campground=${encodeURIComponent(p.campgroundId)}&product=${encodeURIComponent(p.id)}`}
                  >
                    Add to a private cart draft
                  </Link>
                </article>
              ))}
            </div>
          )}
        </section>
      </div>
    </AppShell>
  );
}
