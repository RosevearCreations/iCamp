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
import { listManagedRentalOffers } from "@/lib/rental-planner/postgres.mjs";
import { sessionLocalClock263 } from "@/lib/rental-planner/sessions263.mjs";
import { listSupervisedSessions263 } from "@/lib/rental-planner/sessions263-postgres.mjs";

import {
  cancelSupervisedSession263Action,
  planSupervisedSession263Action,
} from "./actions";
import styles from "../../../../events/recreation.module.css";

export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "Build 263 · Supervised rental sessions · iCamp",
  description:
    "Staff-proposed, asset-bound recreation sessions and overlap checks without guest booking or payment.",
  robots: { index: false, follow: false },
};

export default async function SupervisedRentalSessions263Page({
  searchParams,
}: Readonly<{
  searchParams: Promise<{
    campground?: string;
    saved?: string;
    error?: string;
  }>;
}>) {
  const path = "/workspaces/management/campgrounds/rental-sessions263";
  const staff = await requireAnyCampgroundPermission("rental.manage", path);
  const query = await searchParams;
  const assigned = await listAssignedCampgrounds(staff.user.id);
  const allowed = (
    await Promise.all(
      assigned.map(async (campground) => {
        const auth = await getCampgroundAuthorization(
          staff.user.id,
          campground.campgroundId,
        );
        return auth?.permissions.includes("rental.manage") ? campground : null;
      }),
    )
  ).filter((item): item is NonNullable<typeof item> => item !== null);
  if (!allowed.length) redirect("/auth/not-authorized");
  const selected =
    allowed.find((item) => item.campgroundId === query.campground) ??
    allowed[0];
  const [offers, plans] = await Promise.all([
    listManagedRentalOffers({
      userId: staff.user.id,
      campgroundId: selected.campgroundId,
    }),
    listSupervisedSessions263({
      actorUserId: staff.user.id,
      campgroundId: selected.campgroundId,
    }),
  ]);
  const ready = offers.filter(
    (offer) => offer.sourceReady && offer.isPublished,
  );
  return (
    <AppShell>
      <div className="page-stack">
        <nav className="breadcrumbs" aria-label="Breadcrumb">
          <Link href="/workspaces/management/campgrounds">Campgrounds</Link>
          <span>/</span>
          <Link href="/workspaces/management/campgrounds/rentals">
            Rental planning
          </Link>
          <span>/</span>
          <span>Supervised sessions</span>
        </nav>
        <section className="hero-panel">
          <p className="eyebrow">Build 263 · source-bound staff planning</p>
          <h1>Guided activities and equipment session calendar</h1>
          <p className="hero-panel__lead">
            Propose a real rental-offer session, staff safety briefing,
            participant planning limit and time. The database refuses
            overlapping plans for the same registered equipment or facility.
            These entries are not confirmed guest reservations.
          </p>
        </section>
        {query.saved ? (
          <p className={styles.notice} role="status">
            Staff planning record updated and audited. No guest allocation,
            dispatch or payment occurred.
          </p>
        ) : null}
        {query.error ? (
          <p className={styles.warning} role="alert">
            Session could not be saved. Refresh the original asset status,
            scheduling window, migration readiness and overlapping sessions.
          </p>
        ) : null}
        <section className="content-panel">
          <SectionHeading
            id="session263-origin"
            eyebrow="Tenant-isolated source"
            title="Choose a campground"
            helpTopic="campground.structure"
          />
          <form method="get" className={styles.filters}>
            <label>
              Campground
              <select name="campground" defaultValue={selected.campgroundId}>
                {allowed.map((campground) => (
                  <option
                    key={campground.campgroundId}
                    value={campground.campgroundId}
                  >
                    {campground.campgroundName}
                  </option>
                ))}
              </select>
            </label>
            <button className="primary-button" type="submit">
              View planned sessions
            </button>
          </form>
          <p>
            <strong>Original migration:</strong> {plans.status}
          </p>
          {plans.note ? <p role="alert">{plans.note}</p> : null}
        </section>
        <section className="content-panel">
          <SectionHeading
            id="session263-plan"
            eyebrow="Staff planning only"
            title="Propose a supervised session"
            helpTopic="campground.structure"
          />
          {!ready.length ? (
            <p>
              No currently operational and published rental source exists for
              this campground. Add or inspect a real rental asset first.
            </p>
          ) : (
            <form action={planSupervisedSession263Action} className={styles.form}>
              <input
                type="hidden"
                name="campgroundId"
                value={selected.campgroundId}
              />
              <label>
                Registered source asset
                <select name="offerId" required>
                  {ready.map((offer) => (
                    <option value={offer.id} key={offer.id}>
                      {offer.assetName} · {offer.itemType}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                Proposed local date
                <input type="date" name="plannedDay" required />
              </label>
              <label>
                Start (local campground clock)
                <input type="time" name="start" step={900} required />
              </label>
              <label>
                End (same day)
                <input type="time" name="end" step={900} required />
              </label>
              <label>
                Supervised activity
                <select name="activityKind" required>
                  <option value="guided_horse">Guided horseback / equestrian</option>
                  <option value="paddling_instruction">Paddling instruction</option>
                  <option value="kite_clinic">Kite clinic</option>
                  <option value="guided_nature">Guided nature activity</option>
                  <option value="other_guided">Other staff-led session</option>
                </select>
              </label>
              <label>
                Participant planning limit (not tickets)
                <input
                  type="number"
                  name="participantLimit"
                  min={1}
                  max={30}
                  defaultValue={8}
                  required
                />
              </label>
              <label>
                Staff-confirmed safety briefing and supervisor requirements
                <textarea
                  name="safetyBrief"
                  minLength={15}
                  maxLength={500}
                  required
                  placeholder="Describe certified supervision, training, weather, insurance and welfare checks."
                />
              </label>
              <button className="primary-button" type="submit">
                Save proposed session
              </button>
            </form>
          )}
          <p>
            Horseback activities require a qualified on-site instructor,
            animal welfare checks, insurance and appropriate permissions.
            No session auto-assigns an animal, worker, attendee or device.
          </p>
        </section>
        <section className="content-panel">
          <SectionHeading
            id="session263-calendar"
            eyebrow="Original, staff-only calendar"
            title={`Proposed sessions (${plans.sessions.length})`}
            helpTopic="campground.structure"
          />
          {!plans.sessions.length ? (
            <p>No original proposed sessions have been observed in the selected window.</p>
          ) : (
            <div className={styles.cards}>
              {plans.sessions.map((session) => (
                <article className={styles.card} key={session.id}>
                  <h3>{session.assetName}</h3>
                  <p>
                    {session.plannedDay} ·{" "}
                    {sessionLocalClock263(session.startMinute)} to{" "}
                    {sessionLocalClock263(session.endMinute)} local
                  </p>
                  <p>
                    {session.activityKind.replaceAll("_", " ")} · limit{" "}
                    {session.participantLimit} · {session.status}
                  </p>
                  <p>{session.safetyBrief}</p>
                  {session.status === "planned" ? (
                    <form action={cancelSupervisedSession263Action}>
                      <input
                        type="hidden"
                        name="campgroundId"
                        value={selected.campgroundId}
                      />
                      <input
                        type="hidden"
                        name="sessionId"
                        value={session.id}
                      />
                      <button className="primary-button" type="submit">
                        Cancel proposed session
                      </button>
                    </form>
                  ) : null}
                </article>
              ))}
            </div>
          )}
          <p>
            Planning only. No attendee enrolment, animal handover, rental
            capture, refund, ticket, worker dispatch or guest booking is
            created or altered by these operations.
          </p>
        </section>
      </div>
    </AppShell>
  );
}
