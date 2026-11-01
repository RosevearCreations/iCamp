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
import {
  recreationCapacityLabel,
  recreationCategories,
} from "@/lib/recreation-events/core.mjs";
import {
  listManagedRecreationEvents,
  listManagedRecreationRequests,
} from "@/lib/recreation-events/postgres.mjs";

import {
  reviewRecreationRequestAction,
  saveRecreationEventAction,
} from "./actions";
import styles from "../../../../events/recreation.module.css";

export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "Events & recreation management · iCamp",
  description:
    "Publish campground activities and review reservation-linked requests without ticketing or billing.",
  robots: { index: false, follow: false },
};

type FormEvent = {
  id: string;
  rowVersion: number;
  title: string;
  description: string;
  category: string;
  locationName: string;
  eventDate: string;
  startTime: string;
  endTime: string;
  capacityPlaces: number | null;
  requiresRegistration: boolean;
  acceptingRequests: boolean;
  accessibilityNote: string;
  ageGuidance: string;
  isPublished: boolean;
  status: string;
};

function EventEditor({
  event,
  campgroundId,
}: {
  event: FormEvent | null;
  campgroundId: string;
}) {
  return (
    <form action={saveRecreationEventAction} className={styles.form}>
      <input type="hidden" name="campgroundId" value={campgroundId} />
      <input type="hidden" name="eventId" value={event?.id ?? ""} />
      <input type="hidden" name="rowVersion" value={event?.rowVersion ?? 0} />
      <label>
        Activity title
        <input
          name="title"
          maxLength={160}
          minLength={3}
          required
          defaultValue={event?.title ?? ""}
        />
      </label>
      <label>
        Description
        <textarea
          name="description"
          minLength={10}
          maxLength={2000}
          required
          defaultValue={event?.description ?? ""}
        />
      </label>
      <label>
        Category
        <select name="category" defaultValue={event?.category ?? "family"}>
          {recreationCategories.map((category) => (
            <option value={category} key={category}>
              {category}
            </option>
          ))}
        </select>
      </label>
      <label>
        Meeting place
        <input
          name="locationName"
          minLength={3}
          maxLength={160}
          required
          defaultValue={event?.locationName ?? ""}
        />
      </label>
      <label>
        Campground-local event date
        <input
          type="date"
          name="eventDate"
          required
          defaultValue={event?.eventDate ?? ""}
        />
      </label>
      <div className={styles.controls}>
        <label>
          Local start time
          <input
            type="time"
            name="startTime"
            required
            defaultValue={event?.startTime ?? ""}
          />
        </label>
        <label>
          Local end time
          <input
            type="time"
            name="endTime"
            required
            defaultValue={event?.endTime ?? ""}
          />
        </label>
      </div>
      <label>
        Maximum provisional request places (1–500; blank if unverified)
        <input
          name="capacityPlaces"
          type="number"
          min={1}
          max={500}
          defaultValue={event?.capacityPlaces ?? ""}
        />
      </label>
      <label>
        Accessibility details
        <textarea
          name="accessibilityNote"
          maxLength={500}
          defaultValue={event?.accessibilityNote ?? ""}
          placeholder="Verified route, terrain, support or contact guidance"
        />
      </label>
      <label>
        Age or safety guidance
        <input
          name="ageGuidance"
          maxLength={240}
          defaultValue={event?.ageGuidance ?? ""}
        />
      </label>
      <label>
        Event status
        <select name="status" defaultValue={event?.status ?? "scheduled"}>
          <option value="scheduled">Scheduled</option>
          <option value="cancelled">Cancelled</option>
        </select>
      </label>
      <label>
        <input
          type="checkbox"
          name="requiresRegistration"
          defaultChecked={event?.requiresRegistration ?? false}
        />{" "}
        Registration request required
      </label>
      <label>
        <input
          type="checkbox"
          name="isPublished"
          defaultChecked={event?.isPublished ?? false}
        />{" "}
        Publish to public schedule
      </label>
      <label>
        <input
          type="checkbox"
          name="acceptingRequests"
          defaultChecked={event?.acceptingRequests ?? false}
        />{" "}
        Accept provisional requests (requires published, scheduled event,
        registration and capacity)
      </label>
      <button type="submit" className="primary-button">
        {event ? "Save revised activity" : "Create activity"}
      </button>
    </form>
  );
}

export default async function ManageRecreationPage({
  searchParams,
}: {
  searchParams: Promise<{
    campground?: string;
    saved?: string;
    error?: string;
  }>;
}) {
  const path = "/workspaces/management/campgrounds/events";
  const session = await requireAnyCampgroundPermission("event.manage", path);
  const params = await searchParams;
  const assigned = await listAssignedCampgrounds(session.user.id);
  const authorized = (
    await Promise.all(
      assigned.map(async (cg) => {
        const permission = await getCampgroundAuthorization(
          session.user.id,
          cg.campgroundId,
        );
        return permission?.permissions.includes("event.manage") ? cg : null;
      }),
    )
  ).filter((item): item is NonNullable<typeof item> => item !== null);
  if (!authorized.length) redirect("/auth/not-authorized");
  const selected =
    authorized.find((cg) => cg.campgroundId === params.campground) ??
    authorized[0];
  const [events, requests] = await Promise.all([
    listManagedRecreationEvents({
      userId: session.user.id,
      campgroundId: selected.campgroundId,
    }),
    listManagedRecreationRequests({
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
          <span>Events & recreation</span>
        </nav>
        <section className="hero-panel">
          <p className="eyebrow">Build 181 · Event management</p>
          <h1>Recreation schedule & request review</h1>
          <p className="hero-panel__lead">
            Publish source-backed event times and optional request capacity.
            Requests consume provisional places and remain separate from
            booking, payment, ticketing, SMS, gate access and admission.
          </p>
          <div className="hero-actions">
            <Link className="secondary-link" href="/events">
              View guest schedule
            </Link>
          </div>
        </section>
        {params.saved ? (
          <p role="status" className={styles.notice}>
            Update saved internally and audited. No admission or external
            message was issued.
          </p>
        ) : null}
        {params.error ? (
          <p role="alert" className={styles.warning}>
            The operation was not saved. A version, capacity, permission or
            transition check may have failed; refresh and review the latest
            data.
          </p>
        ) : null}
        <section className="content-panel">
          <SectionHeading
            id="event-property"
            eyebrow="Scoped authority"
            title="Choose campground"
            helpTopic="campground.structure"
          />
          <form className={styles.filters} method="get">
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
              Open schedule
            </button>
          </form>
        </section>
        <section className="content-panel">
          <SectionHeading
            id="new-activity"
            eyebrow="Staff-published"
            title="Create an activity"
            helpTopic="campground.structure"
          />
          <EventEditor event={null} campgroundId={selected.campgroundId} />
        </section>
        <section className="content-panel">
          <SectionHeading
            id="scheduled-activities"
            eyebrow="Event catalog"
            title={`Activities (${events.length})`}
            helpTopic="campground.structure"
          />
          {!events.length ? (
            <p>No activities have been created for this campground.</p>
          ) : (
            events.map((event) => (
              <details key={event.id} className={styles.card}>
                <summary>
                  <strong>{event.title}</strong> · {event.eventDate} ·{" "}
                  {event.status} · {event.isPublished ? "published" : "draft"} ·{" "}
                  {recreationCapacityLabel(event)}
                </summary>
                <p>
                  Active provisional requests: {event.requestedPlaces}. The
                  published schedule never guarantees admission.
                </p>
                <EventEditor
                  event={event}
                  campgroundId={selected.campgroundId}
                />
              </details>
            ))
          )}
        </section>
        <section className="content-panel">
          <SectionHeading
            id="activity-requests"
            eyebrow="Private staff review"
            title={`Registration request queue (${requests.length})`}
            helpTopic="campground.structure"
          />
          {!requests.length ? (
            <p>No reservation-linked registration requests yet.</p>
          ) : (
            <div className={styles.cards}>
              {requests.map((request) => (
                <article className={styles.card} key={request.id}>
                  <h3>{request.eventTitle}</h3>
                  <p>
                    Event: {request.eventDate} · Requested places:{" "}
                    {request.partySize}
                  </p>
                  <p>Reservation reference: {request.reservationId}</p>
                  <p>
                    Request state: <strong>{request.status}</strong>
                  </p>
                  <p>Submitted: {request.createdAt}</p>
                  {request.guestNote ? (
                    <p>Guest note: {request.guestNote}</p>
                  ) : null}
                  {request.status === "pending" ||
                  request.status === "reviewed" ? (
                    <form
                      action={reviewRecreationRequestAction}
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
                          type="submit"
                          name="decision"
                          value="reviewed"
                          className="primary-button"
                        >
                          Mark reviewed (not admitted)
                        </button>
                      ) : null}
                      <button
                        type="submit"
                        name="decision"
                        value="declined"
                        className="primary-button"
                      >
                        Decline / release places
                      </button>
                    </form>
                  ) : null}
                </article>
              ))}
            </div>
          )}
          <p>
            Reviewed does not mean confirmed admission. Coordinate admission
            directly through the campground’s existing authorized process;
            billing and omnichannel operations remain held.
          </p>
        </section>
      </div>
    </AppShell>
  );
}
