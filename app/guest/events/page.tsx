import { randomUUID } from "node:crypto";

import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";

import { AppShell } from "@/components/app-shell";
import { SectionHeading } from "@/components/section-heading";
import { requireSignedIn } from "@/lib/auth/current-session";
import {
  guestStayEligibleForEvent,
  recreationCapacityLabel,
} from "@/lib/recreation-events/core.mjs";
import {
  getOwnRecreationRequests,
  listGuestRecreationStays,
  listPublicRecreationEvents,
} from "@/lib/recreation-events/postgres.mjs";

import { requestActivityAction, withdrawActivityAction } from "./actions";
import styles from "../../events/recreation.module.css";

export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "My activity requests · iCamp",
  description:
    "Request campground activity places against an eligible reservation, and manage your request history.",
  robots: { index: false, follow: false },
};

export default async function GuestRecreationPage({
  searchParams,
}: Readonly<{
  searchParams: Promise<{ event?: string; error?: string; saved?: string }>;
}>) {
  if (!process.env.DATABASE_URL?.trim())
    return (
      <AppShell>
        <section className="content-panel" role="status">
          <h1>Activity requests are unavailable</h1>
          <p>
            The database connection is missing. No request or charge was
            created. Please contact your campground office.
          </p>
        </section>
      </AppShell>
    );
  const session = await requireSignedIn("/guest/events");
  if (session.user.accountType !== "guest") redirect("/auth/not-authorized");
  const params = await searchParams;
  const [events, stays, requests] = await Promise.all([
    listPublicRecreationEvents(),
    listGuestRecreationStays({ userId: session.user.id }),
    getOwnRecreationRequests({ userId: session.user.id }),
  ]);
  const selected = events.find((event) => event.id === params.event) ?? null;
  const available = selected
    ? stays.filter((stay) => guestStayEligibleForEvent(stay, selected))
    : [];
  const alreadyRequested =
    selected && requests.some((request) => request.eventId === selected.id);
  return (
    <AppShell>
      <div className="page-stack">
        <nav className="breadcrumbs" aria-label="Breadcrumb">
          <Link href="/guest/stay">My Stay</Link>
          <span>/</span>
          <span>Events & recreation</span>
        </nav>
        <section className="hero-panel">
          <p className="eyebrow">Build 181 · Guest activities</p>
          <h1>Your activity requests</h1>
          <p className="hero-panel__lead">
            Request places for activities on the dates of your own eligible
            stay. Requests are provisional and require campground review; they
            are not admission, payment or a booking change.
          </p>
          <div className="hero-actions">
            <Link className="primary-link" href="/events">
              Browse activities
            </Link>
            <Link className="secondary-link" href="/guest/stay">
              My Stay
            </Link>
          </div>
        </section>
        {params.saved ? (
          <p className={styles.notice} role="status">
            {params.saved === "withdraw"
              ? "Your request was withdrawn and its provisional slots were released."
              : "Your registration request was saved for campground review. No admission was confirmed."}
          </p>
        ) : null}
        {params.error ? (
          <p className={styles.warning} role="alert">
            We could not {params.error === "withdraw" ? "withdraw" : "submit"}{" "}
            that request. Capacity, eligibility or request status may have
            changed. Refresh and try again, or contact the campground.
          </p>
        ) : null}
        <section className="content-panel">
          <SectionHeading
            id="registration-form"
            eyebrow="Reservation-linked"
            title="Request activity places"
            helpTopic="shell.overview"
          />
          {!selected ? (
            <p>
              Choose an activity from the{" "}
              <Link href="/events">public events schedule</Link>. Only published
              activities open for requests can be selected.
            </p>
          ) : (
            <>
              <h3>{selected.title}</h3>
              <p>
                {selected.campgroundName} · {selected.eventDate} ·{" "}
                {selected.startTime}–{selected.endTime} ({selected.timezone})
              </p>
              <p>{recreationCapacityLabel(selected)}</p>
              {alreadyRequested ? (
                <p>
                  A request already exists for this event. Review its status
                  below; no duplicate requests are created.
                </p>
              ) : available.length === 0 ? (
                <p>
                  No eligible reservation is linked to your account for this
                  activity, or request capacity has closed. Your stay must be
                  confirmed or checked in and cover the event date.
                </p>
              ) : (
                <form action={requestActivityAction} className={styles.form}>
                  <input type="hidden" name="eventId" value={selected.id} />
                  <input
                    type="hidden"
                    name="clientRequestId"
                    value={randomUUID()}
                  />
                  <label>
                    Eligible reservation
                    <select name="reservationId" required>
                      {available.map((stay) => (
                        <option key={stay.id} value={stay.id}>
                          {stay.campgroundName} · {stay.arrivalDate} to{" "}
                          {stay.departureDate} · {stay.status}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label>
                    Places requested (1–20)
                    <input
                      type="number"
                      name="partySize"
                      min={1}
                      max={Math.min(
                        20,
                        Math.max(
                          1,
                          (selected.capacityPlaces ?? 0) -
                            selected.requestedPlaces,
                        ),
                      )}
                      defaultValue={1}
                      required
                    />
                  </label>
                  <label>
                    Optional note for campground staff
                    <textarea
                      name="guestNote"
                      maxLength={400}
                      placeholder="Accessibility or coordination request; do not include payment details."
                    />
                  </label>
                  <p>
                    Submitting allocates provisional request slots only. Staff
                    may review or decline; this will not send a message or
                    create a ticket.
                  </p>
                  <button className="primary-button" type="submit">
                    Submit registration request
                  </button>
                </form>
              )}
            </>
          )}
        </section>
        <section className="content-panel">
          <SectionHeading
            id="request-history"
            eyebrow="Private to your account"
            title="Request history"
            helpTopic="shell.overview"
          />
          {requests.length === 0 ? (
            <p>No activity requests are linked to your guest account.</p>
          ) : (
            <div className={styles.cards}>
              {requests.map((request) => (
                <article className={styles.card} key={request.id}>
                  <h3>{request.eventTitle}</h3>
                  <p>
                    {request.campgroundName} · {request.eventDate}
                  </p>
                  <p>Requested places: {request.partySize}</p>
                  <p>
                    Status: <strong>{request.status}</strong>
                    {request.status === "reviewed"
                      ? " — staff reviewed; admission is not confirmed"
                      : ""}
                  </p>
                  {["pending", "reviewed"].includes(request.status) ? (
                    <form action={withdrawActivityAction}>
                      <input
                        name="requestId"
                        type="hidden"
                        value={request.id}
                      />
                      <button className="primary-button" type="submit">
                        Withdraw request
                      </button>
                    </form>
                  ) : null}
                </article>
              ))}
            </div>
          )}
        </section>
      </div>
    </AppShell>
  );
}
