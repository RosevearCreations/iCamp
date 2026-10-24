import { randomUUID } from "node:crypto";
import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";

import { AppShell } from "@/components/app-shell";
import { SectionHeading } from "@/components/section-heading";
import { requireStaff } from "@/lib/auth/current-session";
import { listAssignedCampgrounds } from "@/lib/authz/postgres.mjs";
import {
  getEnforcementDashboard,
  getEnforcementPermissions,
} from "@/lib/safety-enforcement/postgres.mjs";

import { decideEnforcementAction, recordEnforcementAction } from "./actions";
import { EnforcementScopeFields } from "./scope-fields";
import styles from "../reservations/reservations.module.css";

export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "Warnings & suspension review · iCamp",
  robots: { index: false, follow: false },
};
function label(value: string) {
  return value.replaceAll("_", " ").replace(/\b\w/gu, (v) => v.toUpperCase());
}
function scopeLabel(item: {
  scope_type: string;
  facility_name: string | null;
  zone_name: string | null;
  feature_code: string | null;
}) {
  if (item.scope_type === "facility") return item.facility_name ?? "Facility";
  if (item.scope_type === "access_zone") return item.zone_name ?? "Access zone";
  if (item.scope_type === "feature")
    return label(item.feature_code ?? "feature");
  return "Entire campground";
}

export default async function EnforcementPage({
  searchParams,
}: Readonly<{
  searchParams: Promise<{ campground?: string; saved?: string }>;
}>) {
  const path = "/workspaces/management/campgrounds/enforcement";
  const session = await requireStaff(path);
  const params = await searchParams;
  const assigned = await listAssignedCampgrounds(session.user.id);
  const authorized = (
    await Promise.all(
      assigned.map(async (campground) => ({
        ...campground,
        permissions: await getEnforcementPermissions(
          session.user.id,
          campground.campgroundId,
        ),
      })),
    )
  ).filter((item) => Object.values(item.permissions).some(Boolean));
  if (!authorized.length) redirect("/auth/not-authorized");
  const selected =
    authorized.find((item) => item.campgroundId === params.campground) ??
    authorized[0];
  const dashboard = await getEnforcementDashboard(
    session.user.id,
    selected.campgroundId,
  );
  const { warning, request, review } = selected.permissions;
  const pending = dashboard.cases.filter(
    (item) => item.case_state === "pending_review",
  ).length;
  const active = dashboard.cases.filter(
    (item) => item.case_state === "active",
  ).length;

  return (
    <AppShell>
      <div className="page-stack">
        <nav className="breadcrumbs" aria-label="Breadcrumb">
          <Link href="/">iCamp</Link>
          <span>/</span>
          <Link href="/workspaces/management/campgrounds">Campgrounds</Link>
          <span>/</span>
          <span>Warnings &amp; suspensions</span>
        </nav>
        <section className="hero-panel">
          <p className="eyebrow">Build 083 · Rules &amp; accountability</p>
          <h1>Warning, suspension &amp; reinstatement register</h1>
          <p className="hero-panel__lead">
            Authorized staff record evidence. Suspension requests need an
            independent campground management decision. Every action has a
            timestamped, immutable audit event.
          </p>
        </section>
        {params.saved ? (
          <p role="status" className={styles.notice}>
            {params.saved}
          </p>
        ) : null}
        <section className="content-panel">
          <SectionHeading
            id="enforcement-scope"
            eyebrow="Property boundary"
            title="Choose campground"
            helpTopic="safety.enforcement"
          />
          <form method="get" className={styles.inlineForm}>
            <label>
              Campground
              <select name="campground" defaultValue={selected.campgroundId}>
                {authorized.map((item) => (
                  <option key={item.campgroundId} value={item.campgroundId}>
                    {item.campgroundName}
                  </option>
                ))}
              </select>
            </label>
            <button type="submit" className="primary-button">
              Open register
            </button>
          </form>
        </section>
        <section className="content-panel">
          <SectionHeading
            id="enforcement-summary"
            eyebrow={dashboard.campground.name}
            title="Review queue &amp; authority"
            helpTopic="safety.enforcement"
          />
          <div className={styles.history}>
            <article>
              <strong>{pending} pending review</strong>
              <p>
                Requests that cannot become active without management approval.
              </p>
            </article>
            <article>
              <strong>{active} active administrative suspensions</strong>
              <p>Recorded restrictions awaiting explicit reinstatement.</p>
            </article>
            <article>
              <strong>Physical access stays separate</strong>
              <p>
                This register does not disable a gate credential, close a
                facility, remove a guest, or contact emergency services. Review
                physical controls and guest communication separately.
              </p>
            </article>
          </div>
        </section>

        {warning || request ? (
          <section className="content-panel">
            <SectionHeading
              id="enforcement-new"
              eyebrow="Staff evidence"
              title="Record a warning or request suspension"
              helpTopic="safety.enforcement"
            />
            {dashboard.reservations.length ? (
              <form
                action={recordEnforcementAction}
                className={styles.formGrid}
              >
                <input
                  type="hidden"
                  name="campgroundId"
                  value={selected.campgroundId}
                />
                <input type="hidden" name="caseId" value={randomUUID()} />
                <label>
                  Record type
                  <select name="kind" required>
                    {warning ? (
                      <option value="warning">Issue warning</option>
                    ) : null}
                    {request ? (
                      <option value="suspension">
                        Request access suspension
                      </option>
                    ) : null}
                  </select>
                </label>
                <label>
                  Confirmed or checked-in guest stay
                  <select name="reservationId" defaultValue="" required>
                    <option value="" disabled>
                      Choose guest reservation
                    </option>
                    {dashboard.reservations.map((reservation) => (
                      <option key={reservation.id} value={reservation.id}>
                        {reservation.accommodation_code} · {reservation.status}{" "}
                        · {reservation.id.slice(0, 8)}
                      </option>
                    ))}
                  </select>
                </label>
                <EnforcementScopeFields
                  facilities={dashboard.facilities}
                  zones={dashboard.zones}
                />
                <label>
                  Published rule version (optional evidence)
                  <select name="ruleVersionId" defaultValue="">
                    <option value="">No specific published rule cited</option>
                    {dashboard.rules.map((rule) => (
                      <option key={rule.id} value={rule.id}>
                        {rule.code} · v{rule.version_number} · {rule.title}
                      </option>
                    ))}
                  </select>
                </label>
                <label>
                  Guest-visible reason (20–2,000 characters)
                  <textarea
                    name="reason"
                    minLength={20}
                    maxLength={2000}
                    required
                    rows={4}
                    placeholder="Describe the observed behavior, date and scope in neutral terms."
                  />
                </label>
                <button className="primary-button" type="submit">
                  Record with audit trail
                </button>
              </form>
            ) : (
              <p>
                No active, account-linked guest reservations are available for
                enforcement. Confirm the reservation and guest account first.
              </p>
            )}
          </section>
        ) : null}

        <section className="content-panel">
          <SectionHeading
            id="enforcement-register"
            eyebrow="Last 100 cases"
            title="Cases &amp; immutable audit events"
            helpTopic="safety.enforcement"
          />
          {!dashboard.cases.length ? (
            <p>No warnings or suspension requests have been recorded.</p>
          ) : null}
          <div className={styles.history}>
            {dashboard.cases.map((item) => {
              const canDecide =
                review &&
                item.case_kind === "suspension" &&
                (item.case_state === "active" ||
                  (item.case_state === "pending_review" &&
                    item.created_by_user_id !== session.user.id));
              return (
                <article key={item.id}>
                  <h3>
                    {label(item.case_kind)} · {label(item.case_state)}
                  </h3>
                  <p>
                    <strong>{scopeLabel(item)}</strong> · Site{" "}
                    {item.accommodation_code}· Reservation{" "}
                    {item.reservation_id.slice(0, 8)}
                  </p>
                  <p style={{ whiteSpace: "pre-wrap" }}>
                    {item.reason_summary}
                  </p>
                  {item.rule_version_number ? (
                    <p>Cited published rule v{item.rule_version_number}</p>
                  ) : null}
                  <p>
                    Opened {new Date(item.created_at).toLocaleString("en-CA")} ·
                    revision {item.row_version}
                  </p>
                  {review &&
                  item.case_state === "pending_review" &&
                  item.created_by_user_id === session.user.id ? (
                    <p>Another authorized manager must review this request.</p>
                  ) : null}
                  {canDecide ? (
                    <form
                      action={decideEnforcementAction}
                      className={styles.formGrid}
                    >
                      <input
                        type="hidden"
                        name="campgroundId"
                        value={selected.campgroundId}
                      />
                      <input type="hidden" name="caseId" value={item.id} />
                      <input
                        type="hidden"
                        name="rowVersion"
                        value={item.row_version}
                      />
                      <label>
                        Management action
                        <select name="decision" required>
                          {item.case_state === "pending_review" ? (
                            <>
                              <option value="approve">
                                Approve suspension
                              </option>
                              <option value="deny">Deny request</option>
                            </>
                          ) : (
                            <option value="reinstate">Reinstate access</option>
                          )}
                        </select>
                      </label>
                      <label>
                        Decision rationale (internal, 12–2,000 characters)
                        <textarea
                          name="note"
                          rows={3}
                          minLength={12}
                          maxLength={2000}
                          required
                        />
                      </label>
                      <button type="submit" className="primary-button">
                        Record management decision
                      </button>
                    </form>
                  ) : null}
                  <details>
                    <summary>
                      Audit history · {item.events.length} events
                    </summary>
                    {item.events.map((event) => (
                      <div key={event.id}>
                        <p>
                          <strong>{label(event.event_kind)}</strong> ·{" "}
                          {new Date(event.occurred_at).toLocaleString("en-CA")}
                        </p>
                        <p style={{ whiteSpace: "pre-wrap" }}>
                          {event.event_note}
                        </p>
                        <small>
                          Recorded by {event.actor_user_id.slice(0, 8)}…
                        </small>
                      </div>
                    ))}
                  </details>
                </article>
              );
            })}
          </div>
        </section>
      </div>
    </AppShell>
  );
}
