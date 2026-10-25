import { randomUUID } from "node:crypto";
import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";

import { AppShell } from "@/components/app-shell";
import { SectionHeading } from "@/components/section-heading";
import { requireStaff } from "@/lib/auth/current-session";
import {
  listAssignedCampgrounds,
  hasCampgroundPermission,
} from "@/lib/authz/postgres.mjs";
import { listingIsCurrent } from "@/lib/permanent-unit-market/core.mjs";
import { getPermanentUnitMarket } from "@/lib/permanent-unit-market/postgres.mjs";
import {
  recordOwnerAction,
  draftListingAction,
  reviewListingAction,
  recordBuyerInquiryAction,
} from "./actions";
import styles from "../reservations/reservations.module.css";

export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "Permanent-unit ownership and sale listings · iCamp",
  robots: { index: false, follow: false },
};
function price(cents: string, currency: string) {
  return new Intl.NumberFormat("en-CA", { style: "currency", currency }).format(
    Number(cents) / 100,
  );
}
export default async function PermanentUnitsPage({
  searchParams,
}: Readonly<{
  searchParams: Promise<{
    campground?: string;
    saved?: string;
    error?: string;
  }>;
}>) {
  const path = "/workspaces/management/campgrounds/permanent-units";
  const session = await requireStaff(path);
  const params = await searchParams;
  const available = (
    await Promise.all(
      (await listAssignedCampgrounds(session.user.id)).map(async (item) => ({
        ...item,
        allowed: await hasCampgroundPermission(
          session.user.id,
          item.campgroundId,
          "permanent_unit.manage",
        ),
      })),
    )
  ).filter((x) => x.allowed);
  if (!available.length) redirect("/auth/not-authorized");
  const selected =
    available.find((x) => x.campgroundId === params.campground) ?? available[0];
  const { campground, units, ownership, listings, inquiries } =
    await getPermanentUnitMarket(session.user.id, selected.campgroundId);
  const currentOwnership = ownership.filter(
    (item, index) =>
      ownership.findIndex(
        (other) => other.accommodation_id === item.accommodation_id,
      ) === index && item.event_kind !== "ownership_ended",
  );
  const approved = listings.filter(
    (item) =>
      item.listing_status === "approved" && listingIsCurrent(item, ownership),
  );
  return (
    <AppShell>
      <div className="page-stack">
        <nav className="breadcrumbs" aria-label="Breadcrumb">
          <Link href="/">iCamp</Link>
          <span>/</span>
          <Link href="/workspaces/management/campgrounds">Campgrounds</Link>
          <span>/</span>
          <span>Permanent units</span>
        </nav>
        <section className="hero-panel">
          <p className="eyebrow">Build 091 · Ownership-backed listing desk</p>
          <h1>Permanent-unit ownership, listings &amp; buyer inquiries</h1>
          <p className="hero-panel__lead">
            Record source-linked ownership history for a privately owned unit,
            draft a listing and obtain an independent review before staff can
            intake a buyer inquiry.
          </p>
          <p>
            <strong>Boundary:</strong> Ownership of a trailer or cottage-like
            unit does not convey ownership or occupancy rights to the campground
            land. The desk does not transfer title, approve financing, publish a
            public advertisement or create an agreement.
          </p>
        </section>
        {params.saved ? (
          <p role="status" className={styles.notice}>
            {params.saved}
          </p>
        ) : null}
        {params.error ? (
          <p role="alert" className={`${styles.notice} ${styles.error}`}>
            {params.error}
          </p>
        ) : null}
        <section className="content-panel">
          <SectionHeading
            id="pu-scope"
            eyebrow="Private campground-scoped records"
            title="Choose campground"
            helpTopic="permanent.units"
          />
          <form method="get" className={styles.inlineForm}>
            <label>
              Campground
              <select name="campground" defaultValue={campground.id}>
                {available.map((x) => (
                  <option key={x.campgroundId} value={x.campgroundId}>
                    {x.campgroundName}
                  </option>
                ))}
              </select>
            </label>
            <button type="submit" className="primary-button">
              Open campground
            </button>
          </form>
          <p>
            {campground.name} · {campground.lifecycle_state} · {units.length}{" "}
            permanent units · {approved.length} current approved staff listings
          </p>
        </section>
        <section className="content-panel">
          <SectionHeading
            id="pu-ownership"
            eyebrow="Separate unit from land rights"
            title="Record immutable owner evidence"
            helpTopic="permanent.units"
          />
          <p>
            Only record a seller or owner after verifying a source such as a
            unit bill of sale or title record. Corrections append another event;
            old evidence is retained. Ending ownership invalidates the current
            listing.
          </p>
          <form action={recordOwnerAction} className={styles.formGrid}>
            <input type="hidden" name="campgroundId" value={campground.id} />
            <input type="hidden" name="id" value={randomUUID()} />
            <label>
              Permanent unit
              <select name="accommodationId" required>
                {units.map((x) => (
                  <option key={x.id} value={x.id}>
                    {x.code} · {x.display_name}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Event
              <select name="eventKind">
                <option value="owner_recorded">Record owner</option>
                <option value="ownership_corrected">
                  Correct prior ownership
                </option>
                <option value="ownership_ended">End recorded ownership</option>
              </select>
            </label>
            <label>
              Owner display name
              <input
                name="ownerDisplayName"
                minLength={3}
                maxLength={160}
                required
              />
            </label>
            <label>
              Source reference
              <input
                name="evidenceReference"
                minLength={8}
                maxLength={400}
                required
              />
            </label>
            <label className={styles.full}>
              Evidence/verification note
              <textarea
                name="notes"
                minLength={12}
                maxLength={1200}
                required
                rows={2}
              />
            </label>
            <button
              className="primary-button"
              type="submit"
              disabled={!units.length}
            >
              Append owner evidence
            </button>
          </form>
          <div className={styles.tableWrap}>
            <table>
              <thead>
                <tr>
                  <th>Unit</th>
                  <th>Recorded owner</th>
                  <th>Event</th>
                  <th>Source</th>
                </tr>
              </thead>
              <tbody>
                {ownership.slice(0, 45).map((x) => (
                  <tr key={x.id}>
                    <td>
                      {units.find((u) => u.id === x.accommodation_id)?.code ??
                        "Unknown"}
                    </td>
                    <td>{x.owner_display_name}</td>
                    <td>{x.event_kind.replaceAll("_", " ")}</td>
                    <td>{x.evidence_reference}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
        <section className="content-panel">
          <SectionHeading
            id="pu-listings"
            eyebrow="No automatic public publication"
            title="Draft and independently review a listing"
            helpTopic="permanent.units"
          />
          <form action={draftListingAction} className={styles.formGrid}>
            <input type="hidden" name="campgroundId" value={campground.id} />
            <input type="hidden" name="id" value={randomUUID()} />
            <label>
              Current owner evidence
              <select name="ownershipEventId" required>
                {currentOwnership.map((x) => (
                  <option key={x.id} value={x.id}>
                    {units.find((u) => u.id === x.accommodation_id)?.code} ·{" "}
                    {x.owner_display_name} · {x.evidence_reference}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Unit (must match evidence)
              <select name="accommodationId" required>
                {currentOwnership.map((x) => (
                  <option key={x.id} value={x.accommodation_id}>
                    {units.find((u) => u.id === x.accommodation_id)?.code} ·{" "}
                    {x.owner_display_name}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Headline
              <input name="headline" minLength={8} maxLength={160} required />
            </label>
            <label>
              Asking price (CAD)
              <input
                name="askingPrice"
                inputMode="decimal"
                placeholder="12500.00"
                required
              />
            </label>
            <label className={styles.full}>
              Approved-for-review listing details
              <textarea
                name="description"
                minLength={20}
                maxLength={2500}
                rows={3}
                required
              />
            </label>
            <button
              className="primary-button"
              type="submit"
              disabled={!currentOwnership.length}
            >
              Create private draft
            </button>
          </form>
          <div className={styles.tableWrap}>
            <table>
              <thead>
                <tr>
                  <th>Unit/listing</th>
                  <th>Price</th>
                  <th>State</th>
                  <th>Independent decision</th>
                </tr>
              </thead>
              <tbody>
                {listings.slice(0, 55).map((x) => (
                  <tr key={x.id}>
                    <td>
                      {units.find((u) => u.id === x.accommodation_id)?.code} ·{" "}
                      {x.headline}
                      {!listingIsCurrent(x, ownership)
                        ? " · STALE OWNERSHIP"
                        : null}
                    </td>
                    <td>{price(x.asking_price_cents, x.currency_code)}</td>
                    <td>{x.listing_status}</td>
                    <td>
                      {x.listing_status === "draft" ? (
                        <form action={reviewListingAction}>
                          <input
                            type="hidden"
                            name="campgroundId"
                            value={campground.id}
                          />
                          <input type="hidden" name="listingId" value={x.id} />
                          <label>
                            Decision
                            <select name="decision">
                              <option value="approved">
                                Approve internally
                              </option>
                              <option value="withdrawn">Withdraw</option>
                            </select>
                          </label>
                          <label>
                            Decision source/reason
                            <input
                              name="note"
                              minLength={12}
                              maxLength={1200}
                              required
                            />
                          </label>
                          <button type="submit">Review</button>
                        </form>
                      ) : (
                        (x.approval_note ?? "Recorded")
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
        <section className="content-panel">
          <SectionHeading
            id="pu-inquiry"
            eyebrow="Staff-recorded private intake"
            title="Record a buyer inquiry"
            helpTopic="permanent.units"
          />
          <form action={recordBuyerInquiryAction} className={styles.formGrid}>
            <input type="hidden" name="campgroundId" value={campground.id} />
            <input type="hidden" name="id" value={randomUUID()} />
            <label>
              Approved current listing
              <select name="listingId" required>
                {approved.map((x) => (
                  <option key={x.id} value={x.id}>
                    {x.headline} ·{" "}
                    {price(x.asking_price_cents, x.currency_code)}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Buyer name
              <input
                name="buyerDisplayName"
                minLength={3}
                maxLength={160}
                required
              />
            </label>
            <label className={styles.full}>
              Private contact/CRM reference (not public)
              <input
                name="contactReference"
                minLength={8}
                maxLength={400}
                required
              />
            </label>
            <label className={styles.full}>
              Inquiry and consent/source note
              <textarea
                name="inquiryNote"
                minLength={12}
                maxLength={1200}
                rows={2}
                required
              />
            </label>
            <button
              className="primary-button"
              type="submit"
              disabled={!approved.length}
            >
              Save private inquiry
            </button>
          </form>
          <div className={styles.tableWrap}>
            <table>
              <thead>
                <tr>
                  <th>Buyer</th>
                  <th>Listing</th>
                  <th>Private contact reference</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {inquiries.slice(0, 40).map((x) => (
                  <tr key={x.id}>
                    <td>{x.buyer_display_name}</td>
                    <td>
                      {listings.find((l) => l.id === x.listing_id)?.headline ??
                        "Historical listing"}
                    </td>
                    <td>{x.contact_reference}</td>
                    <td>{x.inquiry_state}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p>
            IVR, DTMF and SMS must hand off to authenticated staff. Do not enter
            payment details or financing documents in inquiry notes; those have
            separate protected workflows.
          </p>
        </section>
      </div>
    </AppShell>
  );
}
