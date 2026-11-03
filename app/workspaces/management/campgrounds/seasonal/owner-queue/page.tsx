import { randomUUID } from "node:crypto";
import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { AppShell } from "@/components/app-shell";
import { requireStaff } from "@/lib/auth/current-session";
import { listAssignedCampgrounds } from "@/lib/authz/postgres.mjs";
import {
  getOwnerQueue,
  getOwnerQueuePermissions,
} from "@/lib/seasonal-owner-queue/postgres.mjs";
import {
  createOwnerTaskAction,
  recordOwnerTaskEventAction,
  recordRenewalIntentAction,
} from "./actions";

export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "Seasonal renewal & owner readiness · iCamp",
  description:
    "Staff-only annual terms, winter/spring evidence and owner follow-up queue",
  robots: { index: false, follow: false },
};
const base = "/workspaces/management/campgrounds/seasonal/owner-queue";
export default async function OwnerSeasonalQueuePage({
  searchParams,
}: Readonly<{
  searchParams: Promise<{ campground?: string; saved?: string; view?: string }>;
}>) {
  const session = await requireStaff(base);
  const params = await searchParams;
  const assigned = await listAssignedCampgrounds(session.user.id);
  const authorized = (
    await Promise.all(
      assigned.map(async (camp) => ({
        ...camp,
        rights: await getOwnerQueuePermissions(
          session.user.id,
          camp.campgroundId,
        ),
      })),
    )
  ).filter((camp) => Object.values(camp.rights).some(Boolean));
  if (!authorized.length) redirect("/auth/not-authorized");
  const selected =
    authorized.find((item) => item.campgroundId === params.campground) ??
    authorized[0];
  const data = await getOwnerQueue(
    session.user.id,
    selected.campgroundId,
  ).catch(() => null);
  const view = ["all", "blocked", "followup"].includes(params.view ?? "")
    ? params.view
    : "all";
  const shown =
    data?.rows.filter((row) =>
      view === "blocked"
        ? !row.readyForOwnerReview
        : view === "followup"
          ? row.tasks.length > 0
          : true,
    ) ?? [];
  const query = "?campground=" + encodeURIComponent(selected.campgroundId);
  const selector =
    data?.rows.map((row) => ({
      id: row.id,
      label: row.siteCode + " · " + row.reference,
    })) ?? [];
  return (
    <AppShell>
      <div className="page-stack">
        <nav className="breadcrumbs" aria-label="Breadcrumb">
          <Link href="/">iCamp</Link>
          <span>/</span>
          <Link href="/workspaces/management/campgrounds">Campgrounds</Link>
          <span>/</span>
          <Link href="/workspaces/management/campgrounds/seasonal">
            Seasonal assignments
          </Link>
          <span>/</span>
          <span>Owner renewal queue</span>
        </nav>
        <section className="hero-panel">
          <p className="eyebrow">Build 193 · Source-matched seasonal command</p>
          <h1>Seasonal renewal &amp; owner readiness</h1>
          <p className="hero-panel__lead">
            Review expiring annual/seasonal terms, canonical winterization and
            spring sign-offs, unresolved site work and in-app owner tasks from
            one campground-scoped workspace.
          </p>
          <p>
            <strong>Review only:</strong> a recorded interest is not a signed
            renewal; an owner acknowledgement is not a safety inspection, a new
            booking, a payment, or an outbound notice.
          </p>
          <p>
            <Link
              href={"/workspaces/management/campgrounds/winterization" + query}
            >
              Winterization records
            </Link>
            {" · "}
            <Link
              href={
                "/workspaces/management/campgrounds/winter-readiness" + query
              }
            >
              Winter open-readiness
            </Link>
            {" · "}
            <Link
              href={
                "/workspaces/management/campgrounds/spring-reopening" + query
              }
            >
              Spring inspections
            </Link>
          </p>
        </section>
        {params.saved ? (
          <p role="status" className="notice">
            {params.saved}
          </p>
        ) : null}
        <section className="content-panel" aria-labelledby="owner-scope-title">
          <h2 id="owner-scope-title">Campground and queue view</h2>
          <form method="get">
            <label htmlFor="owner-property">Campground</label>{" "}
            <select
              id="owner-property"
              name="campground"
              defaultValue={selected.campgroundId}
            >
              {authorized.map((camp) => (
                <option key={camp.campgroundId} value={camp.campgroundId}>
                  {camp.campgroundName}
                </option>
              ))}
            </select>{" "}
            <label htmlFor="owner-view">Show</label>{" "}
            <select id="owner-view" name="view" defaultValue={view}>
              <option value="all">All active assignments</option>
              <option value="blocked">Blocked or incomplete</option>
              <option value="followup">Assignments with owner tasks</option>
            </select>{" "}
            <button className="secondary-button" type="submit">
              Apply
            </button>
          </form>
          <p className="field-help">
            Source data is freshly checked on each request. No automatic
            activation, billing, SMS or email.
          </p>
        </section>
        {!data ? (
          <section className="content-panel" role="alert">
            <h2>Readback unavailable</h2>
            <p>
              We could not verify the current seasonal safety evidence. No
              assignment is marked ready. Please retry or use the linked source
              workboards.
            </p>
          </section>
        ) : (
          <>
            <section className="content-panel" aria-labelledby="owner-summary">
              <h2 id="owner-summary">Live owner overview</h2>
              <p>
                <strong>{data.rows.length}</strong> active assignments ·{" "}
                <strong>
                  {data.rows.filter((x) => !x.readyForOwnerReview).length}
                </strong>{" "}
                with unresolved readiness blockers ·{" "}
                <strong>{data.tasks.length}</strong> recorded follow-ups
              </p>
              <p className="field-help">
                Source readback {new Date(data.asOf).toLocaleString("en-CA")}.
                Data is bounded to 250 assignments and follow-ups per
                campground; consult source workboards for full histories.
              </p>
            </section>
            <section
              className="content-panel"
              aria-labelledby="owner-assignments"
            >
              <h2 id="owner-assignments">Renewal and seasonal safety queue</h2>
              {shown.length === 0 ? (
                <p>No matching active assignments. No clearance is implied.</p>
              ) : (
                shown.map((row) => (
                  <article
                    className="content-panel"
                    key={row.id}
                    aria-label={row.siteCode + " seasonal assignment"}
                  >
                    <h3>
                      {row.siteCode} · {row.siteName}
                    </h3>
                    <p>
                      <strong>Reference:</strong> {row.reference} ·{" "}
                      {row.assignmentKind} · Term ends {row.endsOn} ·{" "}
                      {row.occupancyState.replaceAll("_", " ")}
                    </p>
                    <p>
                      <strong>Renewal interest:</strong>{" "}
                      {row.renewalPreference?.replaceAll("_", " ") ??
                        "Not recorded"}{" "}
                      {row.renewalVersion
                        ? "(version " + row.renewalVersion + ")"
                        : ""}
                      {row.proposedTermEndsOn
                        ? " · proposed end " + row.proposedTermEndsOn
                        : ""}
                    </p>
                    <p>
                      <strong>Canonical evidence:</strong> winter sign-off{" "}
                      {row.winterDecision ?? "missing"} · spring decision{" "}
                      {row.springDecision ?? "missing"} · open work orders{" "}
                      {row.unresolvedWorkOrders}
                    </p>
                    {row.blockers.length ? (
                      <div
                        role="group"
                        aria-label="Outstanding readiness conditions"
                      >
                        <strong>NOT READY — requires review</strong>
                        <ul>
                          {row.blockers.map((blocker, i) => (
                            <li key={i}>{blocker}</li>
                          ))}
                        </ul>
                      </div>
                    ) : (
                      <p>
                        <strong>
                          Source checks clear for owner review only.
                        </strong>{" "}
                        This is not a reopening or renewal authorization.
                      </p>
                    )}
                    {row.tasks.length ? (
                      <details>
                        <summary>
                          {row.tasks.length} recorded owner follow-up(s)
                        </summary>
                        <ul>
                          {row.tasks.map((t) => (
                            <li key={t.id}>
                              <strong>
                                {t.task_kind.replaceAll("_", " ")}
                              </strong>{" "}
                              · Due {t.due_on} · {t.description} · Source{" "}
                              {t.source_reference}
                              {t.events.length > 0 ? (
                                <ul>
                                  {t.events.map((e) => (
                                    <li key={e.id}>
                                      {e.event_kind.replaceAll("_", " ")}:{" "}
                                      {e.reason}
                                    </li>
                                  ))}
                                </ul>
                              ) : (
                                <p>Awaiting independent review or follow-up</p>
                              )}
                              {data.permissions.record ||
                              data.permissions.review ? (
                                <form action={recordOwnerTaskEventAction}>
                                  <input
                                    type="hidden"
                                    name="campgroundId"
                                    value={selected.campgroundId}
                                  />
                                  <input
                                    type="hidden"
                                    name="taskId"
                                    value={t.id}
                                  />
                                  <input
                                    type="hidden"
                                    name="id"
                                    value={randomUUID()}
                                  />
                                  <label>
                                    Follow-up action{" "}
                                    <select
                                      name="eventKind"
                                      defaultValue="followup_note"
                                    >
                                      {data.permissions.record ? (
                                        <option value="followup_note">
                                          Record follow-up note
                                        </option>
                                      ) : null}
                                      {data.permissions.record ? (
                                        <option value="reopened">
                                          Reopen owner follow-up
                                        </option>
                                      ) : null}
                                      {data.permissions.review &&
                                      t.created_by_user_id !==
                                        session.user.id ? (
                                        <option value="owner_acknowledged">
                                          Independent owner acknowledgement
                                        </option>
                                      ) : null}
                                    </select>
                                  </label>{" "}
                                  <label>
                                    Reason / actual evidence{" "}
                                    <input
                                      name="reason"
                                      required
                                      minLength={12}
                                      maxLength={1200}
                                    />
                                  </label>{" "}
                                  <button
                                    className="secondary-button"
                                    type="submit"
                                  >
                                    Append evidence
                                  </button>
                                </form>
                              ) : null}
                            </li>
                          ))}
                        </ul>
                      </details>
                    ) : null}
                  </article>
                ))
              )}
            </section>
            {data.permissions.record ? (
              <section className="content-panel" aria-labelledby="owner-record">
                <h2 id="owner-record">Record internal renewal preference</h2>
                <p>
                  Use a genuine office/contact reference. A proposed end date is
                  required only for <em>Interested</em>; no existing terms are
                  modified.
                </p>
                <form action={recordRenewalIntentAction}>
                  <input
                    type="hidden"
                    name="campgroundId"
                    value={selected.campgroundId}
                  />
                  <input type="hidden" name="id" value={randomUUID()} />
                  <label>
                    Assignment{" "}
                    <select name="assignmentId" required>
                      {selector.map((x) => (
                        <option value={x.id} key={x.id}>
                          {x.label}
                        </option>
                      ))}
                    </select>
                  </label>{" "}
                  <label>
                    Staff-recorded preference{" "}
                    <select name="preference" defaultValue="needs_discussion">
                      <option value="needs_discussion">Needs discussion</option>
                      <option value="interested">Interested</option>
                      <option value="declined">Declined</option>
                    </select>
                  </label>{" "}
                  <label>
                    Proposed new end date{" "}
                    <input name="proposedTermEndsOn" type="date" />
                  </label>{" "}
                  <label>
                    Source reference{" "}
                    <input
                      name="sourceReference"
                      required
                      minLength={8}
                      maxLength={180}
                      placeholder="Office conversation or source receipt"
                    />
                  </label>{" "}
                  <label>
                    Evidence note{" "}
                    <textarea
                      name="note"
                      required
                      minLength={12}
                      maxLength={1200}
                      rows={2}
                    />
                  </label>{" "}
                  <button
                    className="primary-button"
                    type="submit"
                    disabled={!selector.length}
                  >
                    Record versioned interest
                  </button>
                </form>
                <h2>Queue an owner follow-up</h2>
                <form action={createOwnerTaskAction}>
                  <input
                    type="hidden"
                    name="campgroundId"
                    value={selected.campgroundId}
                  />
                  <input type="hidden" name="id" value={randomUUID()} />
                  <label>
                    Assignment{" "}
                    <select name="assignmentId" required>
                      {selector.map((x) => (
                        <option value={x.id} key={x.id}>
                          {x.label}
                        </option>
                      ))}
                    </select>
                  </label>{" "}
                  <label>
                    Category{" "}
                    <select name="taskKind" defaultValue="owner_followup">
                      <option value="owner_followup">Owner follow-up</option>
                      <option value="renewal">Renewal</option>
                      <option value="winterization">Winterization</option>
                      <option value="spring_reopening">Spring reopening</option>
                      <option value="deficiency">Deficiency</option>
                    </select>
                  </label>{" "}
                  <label>
                    Due date <input name="dueOn" type="date" required />
                  </label>{" "}
                  <label>
                    Evidence reference{" "}
                    <input
                      name="sourceReference"
                      required
                      minLength={8}
                      maxLength={180}
                    />
                  </label>{" "}
                  <label>
                    Task description{" "}
                    <textarea
                      name="description"
                      required
                      minLength={12}
                      maxLength={1200}
                      rows={2}
                    />
                  </label>{" "}
                  <button
                    className="primary-button"
                    type="submit"
                    disabled={!selector.length}
                  >
                    Add private owner task
                  </button>
                </form>
              </section>
            ) : null}
            <section className="content-panel">
              <h2>Channel and safety boundaries</h2>
              <p>
                Staff Web/PWA only. For telephone or SMS requests, use an
                authenticated staffed office handoff; outbound IVR, SMS and MMS
                remain disconnected. This queue cannot certify a site, reopen
                availability, alter a seasonal contract, send a notice, collect
                a payment or operate physical utilities.
              </p>
            </section>
          </>
        )}
      </div>
    </AppShell>
  );
}
