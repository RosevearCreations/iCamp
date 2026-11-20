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
import { listLocalSupport265 } from "@/lib/campground-support265/postgres.mjs";
import { readTelemetryEnrollment267 } from "@/lib/campground-support267/postgres.mjs";
import { setTelemetryConsent267Action } from "./actions267";
import { getSafeItSnapshot } from "@/lib/observability/health";
import {
  createCampgroundSupport265Action,
  transitionCampgroundSupport265Action,
} from "./actions";
import styles from "../../../../events/recreation.module.css";

export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "Campground Operations & Local Support · iCamp",
  description:
    "Local campground health, support cases, incidents, changes and authorized configuration links.",
  robots: { index: false, follow: false },
};
const modules = [
  [
    "Site settings and sections",
    "/workspaces/management/campgrounds",
    "Edit your own campground, sections and subareas",
  ],
  [
    "Sites, cottages and facilities",
    "/workspaces/management/campgrounds/accommodations",
    "Edit site/cottage characteristics, galleries and status",
  ],
  [
    "Map and wayfinding",
    "/workspaces/management/campgrounds/maps",
    "Manage your own overhead map and mapped features",
  ],
  [
    "Rental equipment and packages",
    "/workspaces/management/campgrounds/rentals",
    "Add and publish real equipment rental offers",
  ],
  [
    "Rental scheduling",
    "/workspaces/management/campgrounds/rental-sessions263",
    "Plan staff-led activities and calendars",
  ],
  [
    "Rental pickup / custody",
    "/workspaces/management/campgrounds/rental-custody265",
    "Record reviewed guest safety and physical-item custody",
  ],
  [
    "Events and recreation",
    "/workspaces/management/campgrounds/events",
    "Publish your own events, rules and provisional attendance",
  ],
  [
    "Booking and property rules",
    "/workspaces/management/campgrounds/booking-rules",
    "Control stay and reservation restrictions",
  ],
  [
    "Store inventory",
    "/workspaces/management/campgrounds/store",
    "Manage campground items and stock observations",
  ],
  [
    "Local camper complaints",
    "/workspaces/management/campgrounds/assistance",
    "Handle guest service and incident escalations",
  ],
  [
    "Maintenance and repairs",
    "/workspaces/maintenance/work-orders",
    "Issue and review on-site maintenance work",
  ],
  [
    "Local I.T. diagnostics",
    "/workspaces/it-analysis",
    "Check authorized system status, queues and diagnostic tools",
  ],
] as const;

export default async function CampgroundOperations265Page({
  searchParams,
}: Readonly<{
  searchParams: Promise<{
    campground?: string;
    saved?: string;
    error?: string;
  }>;
}>) {
  const path = "/workspaces/management/campgrounds/operations-centre265";
  const session = await requireAnyCampgroundPermission(
    "campground.operations.manage",
    path,
  );
  const params = await searchParams;
  const assigned = await listAssignedCampgrounds(session.user.id);
  const visible = (
    await Promise.all(
      assigned.map(async (cg) => {
        const grant = await getCampgroundAuthorization(
          session.user.id,
          cg.campgroundId,
        );
        return grant?.permissions.includes("campground.operations.manage")
          ? cg
          : null;
      }),
    )
  ).filter((x): x is NonNullable<typeof x> => x !== null);
  if (!visible.length) redirect("/auth/not-authorized");
  const current =
    visible.find((x) => x.campgroundId === params.campground) ?? visible[0];
  const [support, snapshot, enrollment] = await Promise.all([
    listLocalSupport265({
      userId: session.user.id,
      campgroundId: current.campgroundId,
    }),
    Promise.resolve(getSafeItSnapshot()),
    readTelemetryEnrollment267({ userId: session.user.id, campgroundId: current.campgroundId }),
  ]);
  const suffix = "?campground=" + encodeURIComponent(current.campgroundId);
  return (
    <AppShell>
      <div className="page-stack">
        <nav className="breadcrumbs" aria-label="Breadcrumbs">
          <Link href="/workspaces/management/campgrounds">Campgrounds</Link>
          <span>/</span>
          <span>Local operations</span>
        </nav>
        <section className="hero-panel">
          <p className="eyebrow">Build 265 · campground owner control plane</p>
          <h1>Operate and customize your own campground</h1>
          <p className="hero-panel__lead">
            Site owners manage their own events, rental offers, maintenance,
            maps, guest complaints and property rules. These tools are scoped to
            the campground granted to the signed-in employee. Platform Sysop
            does not automatically receive access to guest or reservation
            records.
          </p>
        </section>
        {params.saved ? (
          <p role="status" className={styles.notice}>
            Local support record saved and audited.
          </p>
        ) : null}
        {params.error ? (
          <p role="alert" className={styles.warning}>
            Support change was not saved. Verify permission, original database
            migration, case status and current version.
          </p>
        ) : null}
        <section className="content-panel">
          <h2>Build 267 · explicitly authorize local request telemetry</h2>
          <p>Source enrollment: {enrollment.status}.
            Current: {enrollment.enrollment?.state ?? "NOT ENROLLED"}.
            Only this campground's authorized management can opt in or revoke.
          </p>
          <form action={setTelemetryConsent267Action} className={styles.form}>
            <input type="hidden" name="campgroundId" value={current.campgroundId} />
            <label>Source identifier
              <input name="sourceId" minLength={8} maxLength={64} required
                pattern="[a-z0-9_-]+" defaultValue={enrollment.enrollment?.sourceId ?? ""}
                placeholder="campground_web_01" />
            </label>
            <button type="submit" name="enabled" value="yes">Authorize signed telemetry</button>
            <button type="submit" name="enabled" value="no">Revoke source telemetry</button>
          </form>
          <p>Enrollment does not create a credential or invent metrics. An independently
            configured provider must sign fresh requests; consent can be revoked locally.
            No private guest or booking records are accepted.</p>
        </section>
        <section className="content-panel">
          <SectionHeading
            id="owner265-property"
            title="Select campground"
            eyebrow="Tenant-local authority"
            helpTopic="campground.structure"
          />
          <form method="get" className={styles.filters}>
            <label>
              Campground
              <select name="campground" defaultValue={current.campgroundId}>
                {visible.map((cg) => (
                  <option key={cg.campgroundId} value={cg.campgroundId}>
                    {cg.campgroundName}
                  </option>
                ))}
              </select>
            </label>
            <button className="primary-button" type="submit">
              Open local operations
            </button>
          </form>
        </section>
        <section className="content-panel">
          <SectionHeading
            id="owner265-diagnostics"
            title="Local health and service cases"
            eyebrow="Real sources · no invented traffic"
            helpTopic="it.analysis"
          />
          <div className={styles.cards}>
            <article className={styles.card}>
              <h3>Application configuration</h3>
              <p>{snapshot.readiness.configuration}</p>
              <p>Build: {snapshot.buildSha}</p>
            </article>
            <article className={styles.card}>
              <h3>Local cases</h3>
              <p>
                {support.metrics.open} open · {support.metrics.triaged} triaged
                · {support.metrics.criticalOpen} critical
              </p>
            </article>
            <article className={styles.card}>
              <h3>Locked-up reports</h3>
              <p>{support.metrics.lockedOpen} unresolved local reports</p>
            </article>
            <article className={styles.card}>
              <h3>Performance reports</h3>
              <p>{support.metrics.performanceOpen} unresolved local reports</p>
            </article>
          </div>
          <p>
            <strong>Support evidence:</strong> {support.status}
          </p>
          <p>
            Requests per minute, actual page load p95, geographic traffic and
            uptime of external devices:
            <strong>
              {" "}
              UNKNOWN until original tenant-scoped monitoring sources are
              enrolled.
            </strong>
            Incident reports below are not machine-generated diagnostics or
            confirmed outages.
          </p>
        </section>
        <section className="content-panel">
          <SectionHeading
            id="owner265-change-tools"
            title="Property changes we control locally"
            eyebrow="Permission-gated existing features"
            helpTopic="campground.structure"
          />
          <div className={styles.cards}>
            {modules.map(([label, href, details]) => (
              <article className={styles.card} key={href}>
                <h3>
                  <Link
                    href={
                      href +
                      (href.startsWith("/workspaces/management/campgrounds/") &&
                      !href.includes("assistance")
                        ? suffix
                        : "")
                    }
                  >
                    {label}
                  </Link>
                </h3>
                <p>{details}</p>
                <p>
                  Requires the destination module’s own campground permissions.
                </p>
              </article>
            ))}
          </div>
        </section>
        <section className="content-panel">
          <SectionHeading
            id="owner265-new-ticket"
            title="Report an iCamp service problem or change request"
            eyebrow="Local-to-platform support intake"
            helpTopic="it.analysis"
          />
          <form
            action={createCampgroundSupport265Action}
            className={styles.form}
          >
            <input
              type="hidden"
              name="campgroundId"
              value={current.campgroundId}
            />
            <label>
              Issue category
              <select name="category">
                <option value="software_locked">
                  Software locked / unavailable
                </option>
                <option value="performance">Performance / slowness</option>
                <option value="traffic">Traffic / usage analysis</option>
                <option value="guest_complaint">
                  Guest complaint requiring application support
                </option>
                <option value="rental_change">
                  Rental addition / customization
                </option>
                <option value="event_change">Event / recreation change</option>
                <option value="site_change">
                  Site / map / configuration change
                </option>
                <option value="feature_request">Feature request</option>
                <option value="billing_question">
                  Billing question (no payment information)
                </option>
                <option value="other">Other platform support</option>
              </select>
            </label>
            <label>
              Severity
              <select name="severity">
                <option value="routine">Routine</option>
                <option value="priority">Priority</option>
                <option value="critical">Critical</option>
              </select>
            </label>
            <label>
              Subject
              <input name="title" minLength={8} maxLength={140} required />
            </label>
            <label>
              Details (no passwords, payment information, guest names or private
              media)
              <textarea
                name="description"
                minLength={20}
                maxLength={1400}
                required
              />
            </label>
            <button type="submit" className="primary-button">
              Open scoped support case
            </button>
          </form>
          <p>
            The support queue stores original tenant-scoped cases. It does not
            auto-send emails, unlock gates, restart machines or guarantee
            outside support has accepted the case.
          </p>
        </section>
        <section className="content-panel">
          <SectionHeading
            id="owner265-queue"
            title={`Local support cases (${support.cases.length})`}
            eyebrow="Owner-visible ticket queue"
            helpTopic="it.analysis"
          />
          {!support.cases.length ? (
            <p>No original cases observed for this campground.</p>
          ) : (
            <div className={styles.cards}>
              {support.cases.map((issue) => (
                <article className={styles.card} key={issue.id}>
                  <h3>{issue.title}</h3>
                  <p>
                    {issue.category.replaceAll("_", " ")} · {issue.severity} ·{" "}
                    <strong>{issue.status}</strong>
                  </p>
                  <p>{issue.description}</p>
                  <p>
                    Opened: {issue.createdAt} · Version {issue.version}
                  </p>
                  {issue.status !== "resolved" ? (
                    <form
                      action={transitionCampgroundSupport265Action}
                      className={styles.controls}
                    >
                      <input
                        type="hidden"
                        name="campgroundId"
                        value={current.campgroundId}
                      />
                      <input type="hidden" name="caseId" value={issue.id} />
                      <input
                        type="hidden"
                        name="version"
                        value={issue.version}
                      />
                      <select
                        aria-label="Support status transition"
                        name="status"
                        defaultValue={
                          issue.status === "open" ? "triaged" : "resolved"
                        }
                      >
                        {issue.status === "open" ? (
                          <option value="triaged">Mark triaged</option>
                        ) : null}
                        <option value="resolved">
                          Resolve with local follow-up
                        </option>
                      </select>
                      <button type="submit" className="secondary-button">
                        Save review
                      </button>
                    </form>
                  ) : null}
                </article>
              ))}
            </div>
          )}
          {support.metrics.coverageCapped ? (
            <p>More than 100 records may exist; this view is incomplete.</p>
          ) : null}
        </section>
      </div>
    </AppShell>
  );
}
