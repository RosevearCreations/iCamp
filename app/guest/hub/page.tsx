import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";

import { AppShell } from "@/components/app-shell";
import { requireSignedIn } from "@/lib/auth/current-session";
import { getOwnArrivalPlanBundle } from "@/lib/arrival-planner/postgres.mjs";
import { getGuestRulePublications } from "@/lib/campground-rules/postgres.mjs";
import { listGuestAssistanceUpdates } from "@/lib/camper-assistance-triage/postgres.mjs";
import { listCamperAssistanceRequests } from "@/lib/camper-assistance/postgres.mjs";
import { getMyStayDetail, listMyStays } from "@/lib/my-stay/postgres.mjs";
import { buildStayHubSummary } from "@/lib/my-stay-hub/core.mjs";
import { listOwnReservationReviewRequests } from "@/lib/reservation-decisions/postgres.mjs";

import styles from "./stay-hub.module.css";

export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "My Stay hub · iCamp",
  description:
    "A private, live-read mobile hub for your reservation, arrival, assistance and campground guidance.",
  robots: { index: false, follow: false },
};

function readable(value: string) {
  return value.replaceAll("_", " ");
}

function displayDate(value: string) {
  if (/^\d{4}-\d{2}-\d{2}$/u.test(value)) return value;
  const date = new Date(value);
  return Number.isFinite(date.getTime())
    ? date.toLocaleString("en-CA", {
        dateStyle: "medium",
        timeStyle: "short",
        timeZone: "UTC",
      }) + " UTC"
    : "Date unavailable";
}

function fallback(title: string, detail: string) {
  return (
    <AppShell>
      <div className="page-stack">
        <section className="content-panel" role="status">
          <h1>{title}</h1>
          <p>{detail}</p>
          <p>
            <Link href="/guest/hub">Retry My Stay hub</Link> ·{" "}
            <Link href="/auth/account">Account</Link>
          </p>
        </section>
      </div>
    </AppShell>
  );
}

export default async function GuestHubPage({
  searchParams,
}: Readonly<{ searchParams: Promise<{ reservation?: string }> }>) {
  if (!process.env.DATABASE_URL?.trim()) {
    return fallback(
      "My Stay is temporarily unavailable",
      "The live reservation database is not connected in this environment. No reservation, payment, check-in or assistance state was changed. Contact the campground office for current information.",
    );
  }
  const session = await requireSignedIn("/guest/hub");
  if (session.user.accountType !== "guest") redirect("/auth/not-authorized");

  const params = await searchParams;
  let stays;
  try {
    stays = await listMyStays({ userId: session.user.id });
  } catch {
    return fallback(
      "We could not load your stays",
      "Your live reservation records could not be read. Information has not been changed; retry or ask the campground office for assistance.",
    );
  }

  const selected =
    stays.find((stay) => stay.id === params.reservation) ??
    stays.find((stay) => stay.status === "checked_in") ??
    stays.find((stay) => stay.status === "confirmed") ??
    stays[0] ??
    null;
  if (!selected) {
    return (
      <AppShell>
        <div className="page-stack">
          <section className="hero-panel">
            <p className="eyebrow">Build 178 · My Stay hub</p>
            <h1>Your next stay starts here</h1>
            <p>No reservations are linked to your guest account yet.</p>
            <div className="hero-actions">
              <Link className="primary-link" href="/booking/map">
                Find a place to stay
              </Link>
              <Link className="secondary-link" href="/guest/booking-drafts">
                Resume a booking draft
              </Link>
            </div>
          </section>
        </div>
      </AppShell>
    );
  }

  let stay;
  try {
    stay = await getMyStayDetail({
      userId: session.user.id,
      reservationId: selected.id,
    });
  } catch {
    return fallback(
      "Stay details could not be verified",
      "The reservation source is temporarily unavailable. Refresh before relying on dates, access or service status.",
    );
  }
  if (!stay) {
    return fallback(
      "This stay is no longer available",
      "The reservation is not linked to your active guest account or is no longer available. No details are shown.",
    );
  }

  const reservationId = stay.reservation.id;
  const [
    arrivalResult,
    assistanceResult,
    updatesResult,
    reviewsResult,
    rulesResult,
  ] = await Promise.allSettled([
    getOwnArrivalPlanBundle({ userId: session.user.id, reservationId }),
    listCamperAssistanceRequests({ userId: session.user.id, reservationId }),
    listGuestAssistanceUpdates({ userId: session.user.id, reservationId }),
    listOwnReservationReviewRequests({
      userId: session.user.id,
      reservationId,
    }),
    getGuestRulePublications({ userId: session.user.id, reservationId }),
  ]);
  const arrival =
    arrivalResult.status === "fulfilled" ? arrivalResult.value : null;
  const assistance =
    assistanceResult.status === "fulfilled" &&
    updatesResult.status === "fulfilled"
      ? { requests: assistanceResult.value, updates: updatesResult.value }
      : null;
  const reviews =
    reviewsResult.status === "fulfilled" ? reviewsResult.value : null;
  const publications =
    rulesResult.status === "fulfilled" ? rulesResult.value : null;
  const partial = [
    arrivalResult,
    assistanceResult,
    updatesResult,
    reviewsResult,
    rulesResult,
  ].some((result) => result.status === "rejected");
  const summary = buildStayHubSummary({
    stay,
    arrival,
    assistance,
    reviews,
    asOf: new Date().toISOString(),
  });
  const selectHref = (path: string) =>
    `${path}?reservation=${encodeURIComponent(reservationId)}`;
  const mapHref = `/booking/map?campground=${encodeURIComponent(stay.reservation.campground.slug)}&arrivalDate=${encodeURIComponent(stay.reservation.arrivalDate)}&departureDate=${encodeURIComponent(stay.reservation.departureDate)}`;
  const documentsHref = `/booking/reservations/${encodeURIComponent(reservationId)}/documents`;
  const sourceStatus = partial
    ? "Some sources unavailable"
    : "Live read complete";

  return (
    <AppShell>
      <div className={styles.hub}>
        <nav className="breadcrumbs" aria-label="Breadcrumb">
          <Link href="/auth/account">Account</Link>
          <span>/</span>
          <span>My Stay hub</span>
        </nav>

        <header className={styles.hero}>
          <div className={styles.heroTop}>
            <p className={styles.kicker}>iCamp · Your stay companion</p>
            <span className={styles.stateBadge}>
              {readable(stay.reservation.status)}
            </span>
          </div>
          <h1>Everything for your stay, in one place.</h1>
          <p className={styles.intro}>
            {stay.reservation.campground.name} ·{" "}
            {stay.reservation.accommodation.code} ·{" "}
            {stay.reservation.accommodation.displayName}
          </p>
          <div className={styles.dates} aria-label="Reservation dates">
            <div>
              <span>Arrival</span>
              <strong>{stay.reservation.arrivalDate}</strong>
              <small>Campground local date</small>
            </div>
            <div>
              <span>Departure</span>
              <strong>{stay.reservation.departureDate}</strong>
              <small>Campground local date</small>
            </div>
          </div>
          <div className={styles.heroControls}>
            <form action="/guest/hub" method="get">
              <input type="hidden" name="reservation" value={reservationId} />
              <button type="submit" className={styles.refresh}>
                Refresh live status
              </button>
            </form>
            <span className={styles.freshness} role="status">
              {sourceStatus} · {displayDate(summary.asOf)} · reservation v
              {summary.reservationVersion}
            </span>
          </div>
        </header>

        {partial ? (
          <aside className={styles.warning} role="status">
            Some supporting records could not be read. Missing case, arrival or
            notice details are <strong>unknown</strong>, not cleared or
            complete. Retry for current information or contact the campground
            office.
          </aside>
        ) : null}

        {stays.length > 1 ? (
          <nav aria-label="Switch reservation" className={styles.staySwitch}>
            <strong>Other stays</strong>
            <div className={styles.stayLinks}>
              {stays.map((item) => (
                <Link
                  key={item.id}
                  href={`/guest/hub?reservation=${encodeURIComponent(item.id)}`}
                  aria-current={item.id === reservationId ? "page" : undefined}
                  className={
                    item.id === reservationId
                      ? styles.selectedStay
                      : styles.stayLink
                  }
                >
                  {item.campgroundName} · {item.arrivalDate}
                </Link>
              ))}
            </div>
          </nav>
        ) : null}

        <div className={styles.columns}>
          <div className={styles.mainColumn}>
            <section className={styles.next} aria-labelledby="hub-next">
              <p className={styles.kicker}>Suggested next step</p>
              <h2 id="hub-next">{summary.nextAction.title}</h2>
              <p>{summary.nextAction.detail}</p>
              <Link
                className={styles.cta}
                href={selectHref(summary.nextAction.href)}
              >
                Open this step →
              </Link>
            </section>

            <section className={styles.card} aria-labelledby="hub-timeline">
              <div className={styles.sectionTop}>
                <div>
                  <p className={styles.kicker}>Source-backed history</p>
                  <h2 id="hub-timeline">Stay timeline</h2>
                </div>
                <span className={styles.muted}>Recorded ≠ scheduled</span>
              </div>
              {summary.events.length ? (
                <ol className={styles.timeline}>
                  {summary.events.map((item) => (
                    <li key={item.id} className={styles.timelineItem}>
                      <span className={styles.dot} aria-hidden="true" />
                      <div className={styles.eventHeader}>
                        <strong>{item.title}</strong>
                        <span
                          className={
                            item.kind === "needs_review"
                              ? styles.reviewTag
                              : styles.kindTag
                          }
                        >
                          {readable(item.kind)}
                        </span>
                      </div>
                      <p>{item.detail}</p>
                      <small>
                        {item.at ? displayDate(item.at) : "No event timestamp"}{" "}
                        · Source: {item.source}
                      </small>
                    </li>
                  ))}
                </ol>
              ) : (
                <p>
                  No timestamped stay events are available yet. Your reservation
                  details above remain the current source.
                </p>
              )}
              <p className={styles.footnote}>
                Timeline dates with a time are displayed in UTC; scheduled dates
                are campground-local calendar dates. Updates appear when you
                refresh. Only canonical reservations and guest-visible records
                are used.
              </p>
            </section>

            <section className={styles.card} aria-labelledby="hub-guidance">
              <div className={styles.sectionTop}>
                <div>
                  <p className={styles.kicker}>Campground-provided</p>
                  <h2 id="hub-guidance">Notices & guidance</h2>
                </div>
              </div>
              {publications == null ? (
                <p className={styles.warning}>
                  Published rules could not be verified right now.
                </p>
              ) : publications.length ? (
                <ul className={styles.guidanceList}>
                  {publications.slice(0, 4).map((rule) => (
                    <li key={rule.rule_version_id}>
                      <strong>{rule.title}</strong>
                      <span>Published v{rule.version_number}</span>
                      <p>
                        {rule.acknowledgement_required && !rule.acknowledged_at
                          ? "Acknowledgement needed in My Stay."
                          : "Published campground guidance."}
                      </p>
                    </li>
                  ))}
                </ul>
              ) : (
                <p>
                  No published campground rules were returned for this stay. A
                  separate live notice feed is not connected; ask the office for
                  urgent or recent announcements.
                </p>
              )}
              <Link href={selectHref("/guest/stay")}>
                Review full campground rules and amenities →
              </Link>
            </section>
          </div>

          <aside
            className={styles.sideColumn}
            aria-label="Stay essentials and shortcuts"
          >
            <section className={styles.card} aria-labelledby="hub-at-glance">
              <p className={styles.kicker}>At a glance</p>
              <h2 id="hub-at-glance">Your essentials</h2>
              <dl className={styles.facts}>
                <div>
                  <dt>Reservation</dt>
                  <dd>{readable(stay.reservation.status)}</dd>
                </div>
                <div>
                  <dt>Arrival preparation</dt>
                  <dd>
                    {arrival == null
                      ? "Unavailable to verify"
                      : summary.planCurrent
                        ? "Saved for current booking"
                        : arrival.plan
                          ? "Needs recheck"
                          : "Not submitted"}
                  </dd>
                </div>
                <div>
                  <dt>Staff arrival review</dt>
                  <dd>
                    {arrival == null
                      ? "Unavailable to verify"
                      : summary.staffReviewCurrent
                        ? readable(arrival.review?.outcome ?? "unknown")
                        : arrival.review
                          ? "Previous review is stale"
                          : "Not on record"}
                  </dd>
                </div>
                <div>
                  <dt>Check-in</dt>
                  <dd>
                    {stay.checkIn?.checkedInAt ? "Recorded" : "Not recorded"}
                  </dd>
                </div>
                <div>
                  <dt>Visitor count</dt>
                  <dd>{stay.party.visitors} on reservation</dd>
                </div>
                <div>
                  <dt>Access/pass handoff</dt>
                  <dd>
                    {stay.checkIn?.credentialHandoffState
                      ? readable(stay.checkIn.credentialHandoffState)
                      : "Not recorded"}
                  </dd>
                </div>
                <div>
                  <dt>Open assistance cases</dt>
                  <dd>
                    {summary.openCases == null
                      ? "Unavailable to verify"
                      : summary.openCases}
                  </dd>
                </div>
              </dl>
              <p className={styles.footnote}>
                Visitor count does not verify individual passes or access
                rights. Ask staff for current permissions.
              </p>
            </section>

            <section className={styles.card} aria-labelledby="hub-quick-links">
              <p className={styles.kicker}>Quick access</p>
              <h2 id="hub-quick-links">What do you need?</h2>
              <div className={styles.quickLinks}>
                <Link href={selectHref("/guest/arrival-planner")}>
                  Arrival planner <span>→</span>
                </Link>
                <Link href={selectHref("/guest/assistance")}>
                  Assistance & case updates <span>→</span>
                </Link>
                <Link href={selectHref("/guest/reservation-options")}>
                  Change / cancellation review <span>→</span>
                </Link>
                <Link href={selectHref("/guest/stay")}>
                  Full stay & Wi-Fi details <span>→</span>
                </Link>
                {stay.documents.confirmationNumber ? (
                  <Link href={documentsHref}>
                    Confirmation & receipts <span>→</span>
                  </Link>
                ) : (
                  <span className={styles.disabledLink}>
                    Documents not issued yet
                  </span>
                )}
                <Link href={mapHref}>
                  Campground map <span>→</span>
                </Link>
                <Link href="/guest/profile">
                  Saved guest profile <span>→</span>
                </Link>
                <Link href="/guest/booking-drafts">
                  Booking drafts <span>→</span>
                </Link>
              </div>
            </section>

            <section className={styles.support}>
              <strong>Need a person?</strong>
              <p>
                Call or visit the campground office for access, urgent notices,
                or verification. In-app requests are not emergency dispatch or a
                guaranteed response service.
              </p>
              <p>Billing and outbound messaging remain HELD.</p>
            </section>
          </aside>
        </div>
      </div>
    </AppShell>
  );
}
