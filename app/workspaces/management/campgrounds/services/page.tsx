import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";

import { AppShell } from "@/components/app-shell";
import { SectionHeading } from "@/components/section-heading";
import { requireStaff } from "@/lib/auth/current-session";
import {
  getCampgroundAuthorization,
  listAssignedCampgrounds,
} from "@/lib/authz/postgres.mjs";
import {
  centsToDollars,
  SERVICE_PRESETS,
} from "@/lib/booking-charges/catalog-editor.mjs";
import {
  listCampgroundServiceCatalogue,
  type CampgroundServiceEntry,
} from "@/lib/booking-charges/catalog-postgres.mjs";

import {
  archiveServiceAction,
  createServiceAction,
  updateServiceAction,
} from "./actions";
import styles from "./services.module.css";

export const metadata: Metadata = {
  title: "Campground Services & Booking Add-Ons · iCamp",
  description:
    "Manage campground-owned optional services, dates, prices and booking visibility.",
  robots: { index: false, follow: false },
};
export const dynamic = "force-dynamic";

const results: Record<string, string> = {
  created:
    "Service saved. Public items now appear in applicable booking quotes.",
  updated:
    "Service updated. New bookings will use the latest pricing and visibility.",
  archived:
    "Service archived. Existing reservation charge snapshots remain unchanged.",
  "create-error":
    "Service could not be saved. Check the code, amount, dates and quantities; a code may already exist.",
  "update-error":
    "Service could not be updated. Refresh the page and check prices, dates and quantities.",
  "archive-error":
    "Service could not be archived. Refresh and check its current state.",
  "archive-confirmation-required":
    "Archive was not performed. Type ARCHIVE to confirm.",
};

function PriceFields({ entry }: { entry?: CampgroundServiceEntry }) {
  return (
    <div className={styles.fields}>
      <label>
        Service name
        <input
          name="displayName"
          maxLength={120}
          placeholder="Use preset name or enter custom name"
          defaultValue={entry?.displayName ?? ""}
        />
      </label>
      <label>
        Description (optional)
        <input
          name="description"
          maxLength={1000}
          placeholder="What the camper receives"
          defaultValue={entry?.description ?? ""}
        />
      </label>
      <label>
        Price (CAD)
        <input
          name="priceDollars"
          type="number"
          min="0"
          max="999999.99"
          step="0.01"
          inputMode="decimal"
          defaultValue={entry ? centsToDollars(entry.unitPriceCents) : "0.00"}
          required
        />
      </label>
      <label>
        Price calculation
        <select
          name="pricingBasis"
          defaultValue={entry?.pricingBasis ?? "per_unit"}
        >
          <option value="per_unit">Per selected unit</option>
          <option value="per_stay">Per stay</option>
          <option value="per_night">Per night</option>
        </select>
      </label>
      <label>
        Unit label
        <input
          name="unitLabel"
          maxLength={40}
          placeholder="Preset or e.g. bundle"
          defaultValue={entry?.unitLabel ?? ""}
        />
      </label>
      <label>
        Minimum selected quantity
        <input
          name="minimumQuantity"
          type="number"
          min="1"
          max="100"
          defaultValue={entry?.minimumQuantity ?? 1}
          required
        />
      </label>
      <label>
        Maximum selected quantity
        <input
          name="maximumQuantity"
          type="number"
          min="1"
          max="100"
          defaultValue={entry?.maximumQuantity ?? 1}
          required
        />
      </label>
      <label>
        Available from (optional)
        <input
          name="startsOn"
          type="date"
          defaultValue={entry?.startsOn ?? ""}
        />
      </label>
      <label>
        Available until (optional)
        <input name="endsOn" type="date" defaultValue={entry?.endsOn ?? ""} />
      </label>
      <label className={styles.checkbox}>
        <input
          name="isPublic"
          type="checkbox"
          defaultChecked={entry?.isPublic ?? false}
        />
        Publish as an optional choice during booking
      </label>
    </div>
  );
}

export default async function CampgroundServicesPage({
  searchParams,
}: Readonly<{
  searchParams: Promise<{ campground?: string; result?: string }>;
}>) {
  const path = "/workspaces/management/campgrounds/services";
  const session = await requireStaff(path);
  const params = await searchParams;
  const assigned = await listAssignedCampgrounds(session.user.id);
  const authorized = (
    await Promise.all(
      assigned.map(async (item) => {
        const grant = await getCampgroundAuthorization(
          session.user.id,
          item.campgroundId,
        );
        return grant?.permissions.includes("pricing.manage") ? item : null;
      }),
    )
  ).filter((item): item is NonNullable<typeof item> => item !== null);

  if (!authorized.length) redirect("/auth/not-authorized");
  if (
    params.campground &&
    !authorized.some((item) => item.campgroundId === params.campground)
  ) {
    redirect("/auth/not-authorized");
  }
  const selected =
    authorized.find((item) => item.campgroundId === params.campground) ??
    authorized[0];
  const catalog = await listCampgroundServiceCatalogue({
    userId: session.user.id,
    campgroundId: selected.campgroundId,
  });
  const countVisible = catalog.entries.filter(
    (item) => item.isActive && item.isPublic,
  ).length;
  const notice = params.result ? results[params.result] : null;

  return (
    <AppShell>
      <div className="page-stack standard-ops-page">
        <nav className="breadcrumbs" aria-label="Breadcrumb">
          <Link href="/campground">Campground</Link>
          <span aria-hidden="true">/</span>
          <Link
            href={`/workspaces/management/campgrounds?campground=${encodeURIComponent(selected.campgroundId)}`}
          >
            Management
          </Link>
          <span aria-hidden="true">/</span>
          <span>Services and add-ons</span>
        </nav>
        <section className="hero-panel meadow-hero">
          <p className="eyebrow">Campground product · Build 233</p>
          <h1>Services &amp; booking add-ons</h1>
          <p className="hero-panel__lead">
            Each campground controls its own optional services. Campers can
            select published extras during booking, and the server recalculates
            their final quote.
          </p>
        </section>
        <section className="content-panel">
          <SectionHeading
            eyebrow="Owner control"
            title="Selected campground"
            id="service-scope"
            helpTopic="campground.structure"
          />
          <form method="get" className={styles.selector}>
            <label>
              Campground
              <select name="campground" defaultValue={selected.campgroundId}>
                {authorized.map((item) => (
                  <option key={item.campgroundId} value={item.campgroundId}>
                    {item.campgroundName}
                  </option>
                ))}
              </select>
            </label>
            <button className="secondary-button" type="submit">
              Open catalogue
            </button>
          </form>
          <p>
            <strong>{catalog.campgroundName}</strong>: {catalog.entries.length}{" "}
            catalogue entries · {countVisible} currently published and active.
          </p>
          {notice ? (
            <p role="status" className={styles.notice}>
              {notice}
            </p>
          ) : null}
          {catalog.truncated ? (
            <p role="alert">
              Only the first 500 charges are shown. Archive unused entries or
              contact support to review older records.
            </p>
          ) : null}
        </section>
        <section className="content-panel">
          <SectionHeading
            eyebrow="New optional item"
            title="Create a campground service"
            id="create-service"
            helpTopic="campground.structure"
          />
          <p>
            Start with a common camping service or create a custom add-on. New
            entries remain hidden until we check the publish box.
          </p>
          <form action={createServiceAction} className={styles.form}>
            <input
              type="hidden"
              name="campgroundId"
              value={selected.campgroundId}
            />
            <div className={styles.fields}>
              <label>
                Service template
                <select name="preset" defaultValue="">
                  <option value="">Custom service</option>
                  {SERVICE_PRESETS.map((item) => (
                    <option key={item.code} value={item.code}>
                      {item.name}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                Unique code (leave blank for template)
                <input
                  name="code"
                  maxLength={80}
                  pattern="[a-z0-9]+(-[a-z0-9]+)*"
                  placeholder="e.g. kayak-rental"
                />
              </label>
            </div>
            <PriceFields />
            <button className="primary-button" type="submit">
              Save service
            </button>
          </form>
        </section>
        <section className="content-panel">
          <SectionHeading
            eyebrow="Published and draft"
            title="Manage existing services"
            id="manage-services"
            helpTopic="campground.structure"
          />
          <p>
            Changing a price affects new booking quotes only. Archived services
            cannot be restored, and existing confirmed reservation charge
            snapshots remain unchanged.
          </p>
          {catalog.entries.length === 0 ? (
            <p>
              No services yet. Create our first optional booking add-on above.
            </p>
          ) : (
            <div className={styles.list}>
              {catalog.entries.map((entry) => (
                <article key={entry.id} className={styles.item}>
                  <div className={styles.itemHeader}>
                    <div>
                      <h3>{entry.displayName}</h3>
                      <p>
                        <code>{entry.code}</code> ·{" "}
                        {entry.pricingBasis === "percent_of_stay"
                          ? `${(entry.percentageBasisPoints ?? 0) / 100}% of stay`
                          : `${centsToDollars(entry.unitPriceCents)} ${entry.currencyCode}`}{" "}
                        · {entry.pricingBasis.replaceAll("_", " ")}
                      </p>
                    </div>
                    <strong>
                      {!entry.isActive
                        ? "Archived"
                        : !entry.isPublic
                          ? "Draft / hidden"
                          : "Published"}
                    </strong>
                  </div>
                  <p>{entry.description || "No description"}</p>
                  {entry.startsOn || entry.endsOn ? (
                    <p>
                      Booking dates: {entry.startsOn ?? "Any start"} –{" "}
                      {entry.endsOn ?? "Any end"}
                    </p>
                  ) : null}
                  {entry.editable ? (
                    <details>
                      <summary>Edit service, visibility and pricing</summary>
                      <form
                        action={updateServiceAction}
                        className={styles.form}
                      >
                        <input
                          type="hidden"
                          name="campgroundId"
                          value={selected.campgroundId}
                        />
                        <input type="hidden" name="chargeId" value={entry.id} />
                        <input
                          type="hidden"
                          name="rowVersion"
                          value={entry.rowVersion}
                        />
                        <PriceFields entry={entry} />
                        <button className="primary-button" type="submit">
                          Save changes
                        </button>
                      </form>
                      <details className={styles.archive}>
                        <summary>Archive this service permanently</summary>
                        <p>
                          Archived charges disappear from future booking
                          choices. Type ARCHIVE to confirm; existing
                          reservations are preserved.
                        </p>
                        <form
                          action={archiveServiceAction}
                          className={styles.archiveForm}
                        >
                          <input
                            type="hidden"
                            name="campgroundId"
                            value={selected.campgroundId}
                          />
                          <input
                            type="hidden"
                            name="chargeId"
                            value={entry.id}
                          />
                          <input
                            type="hidden"
                            name="rowVersion"
                            value={entry.rowVersion}
                          />
                          <label>
                            Confirmation{" "}
                            <input
                              name="confirmation"
                              autoComplete="off"
                              pattern="ARCHIVE"
                              required
                            />
                          </label>
                          <button className="secondary-button" type="submit">
                            Archive service
                          </button>
                        </form>
                      </details>
                    </details>
                  ) : (
                    <p>
                      This legacy, pass, automatic-fee or archived entry is
                      read-only in the optional-service editor.
                    </p>
                  )}
                </article>
              ))}
            </div>
          )}
        </section>
        <section className="content-panel">
          <h2>Booking and capacity notes</h2>
          <p>
            Published extras are eligible only within their date window. Minimum
            and maximum quantities apply <strong>per booking</strong>, not to
            campground-wide stock or staff capacity. Fulfilment and global
            inventory controls remain separate operations.
          </p>
          <p>
            <Link href="/booking/map">Review the guest booking experience</Link>
          </p>
        </section>
      </div>
    </AppShell>
  );
}
