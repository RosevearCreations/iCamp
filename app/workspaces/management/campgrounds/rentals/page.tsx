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
import type { RentalOffer } from "@/lib/rental-planner/core.mjs";
import {
  listManagedRentalOffers,
  listManagedRentalRequests,
  listRentalAssetCandidates,
} from "@/lib/rental-planner/postgres.mjs";

import { reviewRentalPlanningAction, saveRentalOfferAction } from "./actions";
import styles from "../../../../events/recreation.module.css";

export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "Rental planning management · iCamp",
  description:
    "Staff-controlled amenity and equipment planning catalog and request review.",
  robots: { index: false, follow: false },
};

function OfferEditor({
  offer,
  campgroundId,
  assetId,
}: {
  offer: RentalOffer | null;
  campgroundId: string;
  assetId: string;
}) {
  return (
    <form action={saveRentalOfferAction} className={styles.form}>
      <input type="hidden" name="campgroundId" value={campgroundId} />
      <input type="hidden" name="assetId" value={assetId} />
      <input type="hidden" name="offerId" value={offer?.id ?? ""} />
      <input type="hidden" name="rowVersion" value={offer?.rowVersion ?? 0} />
      <label>
        Staff-reviewed description
        <textarea
          name="description"
          minLength={10}
          maxLength={1200}
          required
          defaultValue={offer?.description ?? ""}
          placeholder="Explain what is actually offered for planning; do not promise allocation."
        />
      </label>
      <label>
        Verified accessibility details
        <textarea
          name="accessibilityNote"
          maxLength={500}
          defaultValue={offer?.accessibilityNote ?? ""}
        />
      </label>
      <label>
        Pickup, safety and return guidance
        <textarea
          name="returnGuidance"
          maxLength={500}
          defaultValue={offer?.returnGuidance ?? ""}
        />
      </label>
      <label>
        Maximum request length (inclusive days, 1–14)
        <input
          type="number"
          name="maxDays"
          min={1}
          max={14}
          defaultValue={offer?.maxDays ?? 7}
          required
        />
      </label>
      <label>
        <input
          type="checkbox"
          name="isPublished"
          defaultChecked={offer?.isPublished ?? false}
        />{" "}
        Publish this verified asset to the guest catalog
      </label>
      <label>
        <input
          type="checkbox"
          name="acceptingRequests"
          defaultChecked={offer?.acceptingRequests ?? false}
        />{" "}
        Accept provisional planning requests (requires publication and
        operational asset)
      </label>
      <p>
        One source asset is one provisional slot. An item not marked operational
        in Asset Management cannot be published, even if this checkbox is
        selected.
      </p>
      <button className="primary-button" type="submit">
        {offer ? "Save source-backed listing" : "Create draft listing"}
      </button>
    </form>
  );
}

export default async function ManageRentalPlannerPage({
  searchParams,
}: {
  searchParams: Promise<{
    campground?: string;
    saved?: string;
    error?: string;
  }>;
}) {
  const path = "/workspaces/management/campgrounds/rentals";
  const session = await requireAnyCampgroundPermission("rental.manage", path);
  const params = await searchParams;
  const assigned = await listAssignedCampgrounds(session.user.id);
  const authorized = (
    await Promise.all(
      assigned.map(async (cg) => {
        const access = await getCampgroundAuthorization(
          session.user.id,
          cg.campgroundId,
        );
        return access?.permissions.includes("rental.manage") ? cg : null;
      }),
    )
  ).filter((item): item is NonNullable<typeof item> => item !== null);
  if (!authorized.length) redirect("/auth/not-authorized");
  const selected =
    authorized.find((cg) => cg.campgroundId === params.campground) ??
    authorized[0];
  const [offers, candidates, requests] = await Promise.all([
    listManagedRentalOffers({
      userId: session.user.id,
      campgroundId: selected.campgroundId,
    }),
    listRentalAssetCandidates({
      userId: session.user.id,
      campgroundId: selected.campgroundId,
    }),
    listManagedRentalRequests({
      userId: session.user.id,
      campgroundId: selected.campgroundId,
    }),
  ]);
  const unlisted = candidates.filter((asset) => !asset.alreadyListed);
  return (
    <AppShell>
      <div className="page-stack">
        <nav className="breadcrumbs" aria-label="Breadcrumb">
          <Link href="/workspaces/management/campgrounds">Campgrounds</Link>
          <span>/</span>
          <span>Rental planning</span>
        </nav>
        <section className="hero-panel">
          <p className="eyebrow">Build 182 · Rental planning</p>
          <h1>Source-backed rental catalog & review queue</h1>
          <p className="hero-panel__lead">
            Offer only campground-owned registered assets with verified
            operational status. Review date-specific, reservation-linked
            requests without charging guests or issuing rental equipment.
          </p>
          <div className="hero-actions">
            <Link className="secondary-link" href="/rentals">
              View public catalog
            </Link>
          </div>
        </section>
        {params.saved ? (
          <p className={styles.notice} role="status">
            The record was saved internally and audited. No rental allocation or
            external message occurred.
          </p>
        ) : null}
        {params.error ? (
          <p className={styles.warning} role="alert">
            This update was not saved. The asset status, permission, request
            overlap or row version may have changed. Review the latest details.
          </p>
        ) : null}
        <section className="content-panel">
          <SectionHeading
            eyebrow="Scoped authority"
            title="Select campground"
            id="rental-property"
            helpTopic="campground.structure"
          />
          <form method="get" className={styles.filters}>
            <label>
              Campground
              <select name="campground" defaultValue={selected.campgroundId}>
                {authorized.map((cg) => (
                  <option value={cg.campgroundId} key={cg.campgroundId}>
                    {cg.campgroundName}
                  </option>
                ))}
              </select>
            </label>
            <button className="primary-button" type="submit">
              Open rentals
            </button>
          </form>
        </section>
        <section className="content-panel">
          <SectionHeading
            eyebrow="Verified inventory sources"
            title="Create a rental planning listing"
            id="rental-source"
            helpTopic="campground.structure"
          />
          {unlisted.length === 0 ? (
            <p>
              No eligible unlisted amenity/equipment assets exist. Add or review
              operational assets first. Maintenance-only and safety-critical
              types are intentionally excluded.
            </p>
          ) : (
            <>
              <p>
                The selected source asset is immutable after listing.
                Unavailable assets may be prepared as drafts but cannot be
                published until marked operational.
              </p>
              {unlisted.slice(0, 30).map((asset) => (
                <details className={styles.card} key={asset.id}>
                  <summary>
                    <strong>{asset.name}</strong> · {asset.code} · {asset.kind}{" "}
                    / {asset.type.replaceAll("_", " ")} · {asset.operatingState}
                  </summary>
                  <OfferEditor
                    offer={null}
                    assetId={asset.id}
                    campgroundId={selected.campgroundId}
                  />
                </details>
              ))}
            </>
          )}
          <p>
            <Link
              href={`/workspaces/management/campgrounds/assets?campground=${encodeURIComponent(selected.campgroundId)}`}
            >
              Review source assets and operational status →
            </Link>
          </p>
        </section>
        <section className="content-panel">
          <SectionHeading
            eyebrow="Staff publications"
            title={`Rental listings (${offers.length})`}
            id="rental-listed"
            helpTopic="campground.structure"
          />
          {!offers.length ? (
            <p>
              No rental planning offers have been published or drafted for this
              campground.
            </p>
          ) : (
            offers.map((offer) => (
              <details className={styles.card} key={offer.id}>
                <summary>
                  <strong>{offer.assetName}</strong> · {offer.assetCode} ·{" "}
                  {offer.sourceReady ? "operational" : "SOURCE UNAVAILABLE"} ·{" "}
                  {offer.isPublished ? "published" : "draft"} ·{" "}
                  {offer.acceptingRequests ? "intake open" : "intake closed"}
                </summary>
                <p>
                  Physical source: {offer.assetClass}/{offer.itemType}.
                  Publication never creates stock, a ticket or a reservation
                  hold.
                </p>
                <OfferEditor
                  offer={offer}
                  assetId={offer.assetId}
                  campgroundId={selected.campgroundId}
                />
              </details>
            ))
          )}
        </section>
        <section className="content-panel">
          <SectionHeading
            eyebrow="Private staff review"
            title={`Planning requests (${requests.length})`}
            id="rental-request-queue"
            helpTopic="campground.structure"
          />
          {!requests.length ? (
            <p>There are no rental planning requests for this campground.</p>
          ) : (
            <div className={styles.cards}>
              {requests.map((request) => (
                <article className={styles.card} key={request.id}>
                  <h3>{request.assetName}</h3>
                  <p>
                    Pickup {request.startDate} · Return {request.endDate}{" "}
                    (inclusive)
                  </p>
                  <p>Reservation reference: {request.reservationId}</p>
                  <p>
                    Status: <strong>{request.status}</strong> · Submitted:{" "}
                    {request.createdAt}
                  </p>
                  {request.guestNote ? (
                    <p>Guest note: {request.guestNote}</p>
                  ) : null}
                  {["pending", "reviewed"].includes(request.status) ? (
                    <form
                      action={reviewRentalPlanningAction}
                      className={styles.controls}
                    >
                      <input
                        type="hidden"
                        name="campgroundId"
                        value={selected.campgroundId}
                      />
                      <input
                        type="hidden"
                        name="requestId"
                        value={request.id}
                      />
                      {request.status === "pending" ? (
                        <button
                          className="primary-button"
                          type="submit"
                          name="decision"
                          value="reviewed"
                        >
                          Mark reviewed (not allocated)
                        </button>
                      ) : null}
                      <button
                        className="primary-button"
                        type="submit"
                        name="decision"
                        value="declined"
                      >
                        Decline / release slot
                      </button>
                    </form>
                  ) : null}
                </article>
              ))}
            </div>
          )}
          <p>
            <strong>Important:</strong> “Reviewed” is an internal staff
            observation, not a paid or issued rental. Any handover, payment,
            deposit or access decision belongs to a future separately approved
            workflow.
          </p>
        </section>
      </div>
    </AppShell>
  );
}
