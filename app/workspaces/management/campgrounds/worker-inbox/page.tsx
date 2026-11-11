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
  DISPATCH_ACK_LABELS,
  DISPATCH_COMPLETION_LABELS,
} from "@/lib/booking-charges/fulfillment-dispatch-core.mjs";
import { listWorkerFulfillmentInbox } from "@/lib/booking-charges/fulfillment-dispatch-postgres.mjs";
import { validateInboxPage } from "@/lib/booking-charges/fulfillment-followup-core.mjs";
import { workerRecoveryGuidance } from "@/lib/booking-charges/fulfillment-priority-core.mjs";

import { acknowledgeWorkerInboxDispatchAction } from "./actions";
import styles from "./inbox.module.css";

export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "My Dispatch Inbox · iCamp",
  description: "Private campground worker assignment receipts",
  robots: { index: false, follow: false },
};

export default async function WorkerInboxPage({
  searchParams,
}: Readonly<{
  searchParams: Promise<{
    campground?: string;
    page?: string;
    result?: string;
  }>;
}>) {
  const path = "/workspaces/management/campgrounds/worker-inbox";
  const session = await requireStaff(path);
  const params = await searchParams;
  const assigned = await listAssignedCampgrounds(session.user.id);
  const allowed = (
    await Promise.all(
      assigned.map(async (item) => {
        const grant = await getCampgroundAuthorization(
          session.user.id,
          item.campgroundId,
        );
        return grant?.permissions.includes("reservation.modify") ? item : null;
      }),
    )
  ).filter((item): item is NonNullable<typeof item> => item !== null);
  if (
    !allowed.length ||
    (params.campground &&
      !allowed.some((item) => item.campgroundId === params.campground))
  ) {
    redirect("/auth/not-authorized");
  }
  const selected =
    allowed.find((item) => item.campgroundId === params.campground) ??
    allowed[0];
  const inbox = await listWorkerFulfillmentInbox({
    userId: session.user.id,
    campgroundId: selected.campgroundId,
    page: validateInboxPage(params.page),
  });
  const base = `${path}?campground=${encodeURIComponent(selected.campgroundId)}`;
  return (
    <AppShell>
      <div className="page-stack standard-ops-page">
        <nav className="breadcrumbs" aria-label="Breadcrumb">
          <Link href="/campground">Campground</Link>
          <span aria-hidden="true">/</span>
          <Link
            href={`/workspaces/management/campgrounds/service-fulfillment?campground=${encodeURIComponent(selected.campgroundId)}`}
          >
            Fulfillment queue
          </Link>
          <span aria-hidden="true">/</span>
          <span>My dispatch inbox</span>
        </nav>
        <section className="hero-panel meadow-hero">
          <p className="eyebrow">Build 240 · Assigned campground worker only</p>
          <h1>My dispatch inbox</h1>
          <p className="hero-panel__lead">
            Review your own campground service handoffs and record receipt or a
            request for supervisor support. Your actions are recorded but never
            send guest messages, change payment, or confirm job completion.
          </p>
        </section>
        <section className="content-panel">
          <SectionHeading
            eyebrow="Private worker workspace"
            title="Assigned campground and current messages"
            id="worker-inbox-scope"
            helpTopic="campground.structure"
          />
          <form method="get" className={styles.form}>
            <label>
              Campground
              <select name="campground" defaultValue={selected.campgroundId}>
                {allowed.map((item) => (
                  <option key={item.campgroundId} value={item.campgroundId}>
                    {item.campgroundName}
                  </option>
                ))}
              </select>
            </label>
            <button className="secondary-button" type="submit">
              Open my inbox
            </button>
          </form>
          {params.result === "acknowledged" ? (
            <p role="status" className={styles.message}>
              Your acknowledgement was recorded.
            </p>
          ) : null}
          {params.result === "ack-error" ? (
            <p role="alert" className={styles.message}>
              No receipt was recorded. Refresh and confirm that this handoff is
              still assigned to you and has not already been acknowledged.
            </p>
          ) : null}
          <p>
            These are only dispatches addressed to your account. Earlier
            handoffs may be marked superseded after a change; they remain
            read-only evidence, not current work instructions.
          </p>
        </section>
        <section className="content-panel">
          <SectionHeading
            eyebrow="Worker-only · 20 handoffs per page"
            title="My received work handoffs"
            id="worker-inbox-list"
            helpTopic="campground.structure"
          />
          {inbox.entries.length ? (
            <div className={styles.list}>
              {inbox.entries.map((item) => (
                <article key={item.dispatch.id} className={styles.card}>
                  <h3>
                    {item.serviceName} × {item.quantity}
                  </h3>
                  <p>
                    Reservation {item.reservationReference} · {item.serviceDate}{" "}
                    · {item.serviceWindow}
                  </p>
                  <p className={styles.status}>
                    {item.classification?.status === "superseded"
                      ? "Superseded handoff — history only"
                      : "Current assignment handoff"}
                  </p>
                  <p>
                    Received:{" "}
                    {item.dispatch.dispatchedAt.slice(0, 16).replace("T", " ")}{" "}
                    UTC
                  </p>
                  <p>
                    Reply due:{" "}
                    {item.dispatch.acknowledgementDueAt
                      .slice(0, 16)
                      .replace("T", " ")}{" "}
                    UTC
                  </p>
                  <p>
                    <strong>
                      {DISPATCH_ACK_LABELS[
                        item.classification?.acknowledgement ?? ""
                      ] ?? "Awaiting evidence"}
                    </strong>
                  </p>
                  <p>
                    Completion:{" "}
                    {DISPATCH_COMPLETION_LABELS[
                      item.classification?.completion ?? ""
                    ] ?? "Not configured"}
                  </p>
                  <aside
                    className={styles.guidance}
                    aria-label="Mobile handoff recovery guidance"
                  >
                    <strong>
                      {workerRecoveryGuidance(item.classification).title}
                    </strong>
                    <p>{workerRecoveryGuidance(item.classification).step}</p>
                    {workerRecoveryGuidance(item.classification).urgent ? (
                      <p className={styles.emphasis}>
                        Supervisor attention may be needed. This page does not
                        notify them automatically.
                      </p>
                    ) : null}
                  </aside>
                  {item.dispatch.responseNote ? (
                    <p>My note: {item.dispatch.responseNote}</p>
                  ) : null}
                  {item.classification?.canAcknowledge ? (
                    <form
                      action={acknowledgeWorkerInboxDispatchAction}
                      className={styles.form}
                    >
                      <input
                        type="hidden"
                        name="campgroundId"
                        value={selected.campgroundId}
                      />
                      <input
                        type="hidden"
                        name="dispatchId"
                        value={item.dispatch.id}
                      />
                      <label>
                        My response
                        <select name="response" required>
                          <option value="accepted">I received this work</option>
                          <option value="needs_support">
                            I need supervisor support
                          </option>
                        </select>
                      </label>
                      <label>
                        Optional note (required when requesting support)
                        <input
                          name="ackNote"
                          maxLength={300}
                          placeholder="Details for my supervisor"
                        />
                      </label>
                      <button type="submit" className="primary-button">
                        Record my response
                      </button>
                    </form>
                  ) : null}
                </article>
              ))}
            </div>
          ) : (
            <p>No dispatch records appear on this page for your account.</p>
          )}
          <nav className={styles.pager} aria-label="Inbox pagination">
            {inbox.page > 1 ? (
              <Link href={`${base}&page=${inbox.page - 1}`}>
                Previous handoffs
              </Link>
            ) : (
              <span />
            )}
            <span>Page {inbox.page}</span>
            {inbox.hasNext && inbox.page < 100 ? (
              <Link href={`${base}&page=${inbox.page + 1}`}>
                Older handoffs
              </Link>
            ) : null}
          </nav>
          {inbox.page === 100 && inbox.hasNext ? (
            <p role="alert">
              Further history requires an archived evidence request.
            </p>
          ) : null}
        </section>
      </div>
    </AppShell>
  );
}
