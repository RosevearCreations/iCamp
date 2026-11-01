import type { Metadata } from "next";
import Link from "next/link";

import { AppShell } from "@/components/app-shell";
import { SectionHeading } from "@/components/section-heading";
import {
  recreationCapacityLabel,
  recreationCategories,
} from "@/lib/recreation-events/core.mjs";
import {
  listEventCampgrounds,
  listPublicRecreationEvents,
} from "@/lib/recreation-events/postgres.mjs";

import styles from "./recreation.module.css";

export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "Events & recreation · iCamp",
  description:
    "Published campground activities, local times and transparent registration request availability.",
};

export default async function RecreationDiscoveryPage({
  searchParams,
}: Readonly<{
  searchParams: Promise<{
    campground?: string;
    category?: string;
    search?: string;
  }>;
}>) {
  if (!process.env.DATABASE_URL?.trim())
    return (
      <AppShell>
        <section className="content-panel" role="status">
          <h1>Events are temporarily unavailable</h1>
          <p>
            The campground event database is not connected. No capacity or
            registrations can be verified. Please contact your campground
            office.
          </p>
        </section>
      </AppShell>
    );
  const params = await searchParams;
  const [campgrounds, events] = await Promise.all([
    listEventCampgrounds(),
    listPublicRecreationEvents({
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
          <span>Events & recreation</span>
        </nav>
        <section className="hero-panel">
          <p className="eyebrow">Build 181 · Campground activities</p>
          <h1>Find something fun during your stay</h1>
          <p className="hero-panel__lead">
            Browse activities published by participating campgrounds. Dates and
            times are local to each property. Registration shows provisional
            request availability, never a guaranteed place or ticket.
          </p>
          <div className="hero-actions">
            <Link className="primary-link" href="/guest/events">
              My activity requests
            </Link>
            <Link className="secondary-link" href="/guest/stay">
              My Stay
            </Link>
          </div>
        </section>
        <section className="content-panel">
          <SectionHeading
            id="activity-filters"
            eyebrow="Find activities"
            title="Filter events"
            helpTopic="shell.overview"
          />
          <form method="get" className={styles.filters} role="search">
            <label>
              Campground
              <select name="campground" defaultValue={params.campground ?? ""}>
                <option value="">All campgrounds</option>
                {campgrounds.map((item) => (
                  <option key={item.id} value={item.slug}>
                    {item.name}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Category
              <select name="category" defaultValue={params.category ?? ""}>
                <option value="">All categories</option>
                {recreationCategories.map((category) => (
                  <option key={category} value={category}>
                    {category}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Search
              <input
                type="search"
                name="search"
                maxLength={100}
                defaultValue={params.search ?? ""}
                placeholder="Nature walk, craft night…"
              />
            </label>
            <button className="primary-button" type="submit">
              Filter events
            </button>
          </form>
        </section>
        <section className="content-panel" aria-live="polite">
          <SectionHeading
            id="activity-results"
            eyebrow="Campground-published schedule"
            title={`${events.length} upcoming event${events.length === 1 ? "" : "s"}`}
            helpTopic="shell.overview"
          />
          {events.length === 0 ? (
            <p>
              No published events match these filters. The schedule may not be
              available yet; ask the campground office about activities.
            </p>
          ) : (
            <div className={styles.cards}>
              {events.map((event) => (
                <article className={styles.card} key={event.id}>
                  <p className={styles.tag}>
                    {event.category} · {event.campgroundName}
                  </p>
                  <h3>{event.title}</h3>
                  <p>{event.description}</p>
                  <dl className={styles.details}>
                    <div>
                      <dt>Local date and time</dt>
                      <dd>
                        {event.eventDate} · {event.startTime}–{event.endTime} (
                        {event.timezone})
                      </dd>
                    </div>
                    <div>
                      <dt>Meeting place</dt>
                      <dd>{event.locationName}</dd>
                    </div>
                    {event.ageGuidance ? (
                      <div>
                        <dt>Age guidance</dt>
                        <dd>{event.ageGuidance}</dd>
                      </div>
                    ) : null}
                    <div>
                      <dt>Accessibility</dt>
                      <dd>
                        {event.accessibilityNote ||
                          "No accessibility details supplied; contact the campground for specific needs."}
                      </dd>
                    </div>
                    <div>
                      <dt>Request availability</dt>
                      <dd>{recreationCapacityLabel(event)}</dd>
                    </div>
                  </dl>
                  {event.requiresRegistration &&
                  event.acceptingRequests &&
                  event.capacityPlaces !== null &&
                  event.requestedPlaces < event.capacityPlaces &&
                  event.status === "scheduled" ? (
                    <Link
                      className="primary-link"
                      href={`/guest/events?event=${encodeURIComponent(event.id)}`}
                    >
                      Request activity places
                    </Link>
                  ) : (
                    <p>
                      {event.requiresRegistration
                        ? "Contact the campground to discuss options."
                        : "No online registration request needed; check with the campground for attendance details."}
                    </p>
                  )}
                </article>
              ))}
            </div>
          )}
        </section>
        <section className="content-panel">
          <p>
            <strong>Important:</strong> Requests do not confirm admission. This
            page does not take payment, create tickets, send texts/emails or
            control venue access. The campground is the source of truth for
            activity details.
          </p>
        </section>
      </div>
    </AppShell>
  );
}
