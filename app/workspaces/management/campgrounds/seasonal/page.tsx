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
import { listSeasonalAssignmentConsole } from "@/lib/seasonal-assignments/postgres.mjs";

import {
  createSeasonalAssignmentAction,
  transitionSeasonalAssignmentAction,
} from "./actions";
import styles from "../reservations/reservations.module.css";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Seasonal & yearly assignments · iCamp",
  description:
    "Manage long-term campsite and permanent-unit assignments with authoritative availability and package pricing.",
};

function money(cents: number | null, currencyCode: string) {
  if (cents == null) return "—";
  return new Intl.NumberFormat("en-CA", {
    style: "currency",
    currency: currencyCode,
  }).format(cents / 100);
}

export default async function SeasonalAssignmentsPage({
  searchParams,
}: Readonly<{
  searchParams: Promise<{
    campground?: string;
    saved?: string;
    error?: string;
  }>;
}>) {
  const path = "/workspaces/management/campgrounds/seasonal";
  const session = await requireStaff(path);
  const params = await searchParams;
  const assigned = await listAssignedCampgrounds(session.user.id);

  const authorized = (
    await Promise.all(
      assigned.map(async (campground) => {
        const authorization = await getCampgroundAuthorization(
          session.user.id,
          campground.campgroundId,
        );
        return authorization?.permissions.includes("seasonal.manage")
          ? { ...campground, authorization }
          : null;
      }),
    )
  ).filter((item): item is NonNullable<typeof item> => item !== null);

  if (authorized.length === 0) redirect("/auth/not-authorized");

  const selected =
    authorized.find((item) => item.campgroundId === params.campground) ??
    authorized[0];

  const consoleData = await listSeasonalAssignmentConsole({
    userId: session.user.id,
    campgroundId: selected.campgroundId,
  });

  return (
    <AppShell>
      <div className="page-stack">
        <nav className="breadcrumbs" aria-label="Breadcrumb">
          <Link href="/">iCamp</Link>
          <span>/</span>
          <Link href="/workspaces/management">Management</Link>
          <span>/</span>
          <Link href="/workspaces/management/campgrounds">Campgrounds</Link>
          <span>/</span>
          <span>Seasonal & yearly</span>
        </nav>

        <section className="hero-panel">
          <p className="eyebrow">Build 047 · Long-term site lifecycle</p>
          <h1>Seasonal & yearly assignment foundation</h1>
          <p className="hero-panel__lead">
            Long-term sites stay on the same canonical accommodation identity
            and Build 035 availability engine. The selected Build 039 seasonal
            or yearly package price is captured once as immutable charge
            evidence, while assignment lifecycle changes remain audited and
            non-nightly.
          </p>
        </section>

        {params.saved ? (
          <div className={styles.notice}>{params.saved}</div>
        ) : null}
        {params.error ? (
          <div className={styles.notice + " " + styles.error}>
            {params.error}
          </div>
        ) : null}

        <section className="content-panel">
          <SectionHeading
            eyebrow="Campground scope"
            title="Long-term assignment desk"
            id="seasonal-scope"
            helpTopic="campground.structure"
          />
          <form method="get" className={styles.formGrid}>
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
            <button className="secondary-button" type="submit">
              Switch campground
            </button>
          </form>
        </section>

        <section className="content-panel">
          <SectionHeading
            eyebrow="New long-term assignment"
            title="Assign a seasonal or yearly site"
            id="create-seasonal-assignment"
            helpTopic="campground.structure"
          />
          <p>
            Creation is atomic: the server validates site scope, selected rate
            plan coverage and live availability before recording the assignment,
            immutable price snapshot, lifecycle event and audit evidence.
          </p>
          <form action={createSeasonalAssignmentAction} className={styles.formGrid}>
            <input
              type="hidden"
              name="campgroundId"
              value={selected.campgroundId}
            />
            <label>
              Accommodation
              <select name="accommodationId" required>
                {consoleData.accommodations.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.code} · {item.displayName} · {item.accommodationKind}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Assignment kind
              <select name="assignmentKind" defaultValue="seasonal">
                <option value="seasonal">Seasonal</option>
                <option value="yearly">Yearly</option>
              </select>
            </label>
            <label>
              Starts on
              <input name="startsOn" type="date" required />
            </label>
            <label>
              Ends on
              <input name="endsOn" type="date" required />
            </label>
            <label>
              Occupant display name
              <input name="occupantDisplayName" maxLength={160} required />
            </label>
            <label>
              Reference
              <input
                name="reference"
                maxLength={160}
                placeholder="Agreement or office reference"
              />
            </label>
            <label className={styles.full}>
              Rate plan
              <select name="ratePlanId" required>
                {consoleData.ratePlans.map((plan) => (
                  <option key={plan.id} value={plan.id}>
                    {plan.code} · {plan.displayName} · seasonal{" "}
                    {money(plan.seasonalCents, plan.currencyCode)} · yearly{" "}
                    {money(plan.yearlyCents, plan.currencyCode)} ·{" "}
                    {plan.startsOn} to {plan.endsOn}
                  </option>
                ))}
              </select>
            </label>
            <label className={styles.full}>
              <input type="checkbox" name="winterizationRequired" />{" "}
              Winterization/readiness workflow will be required for this
              long-term assignment
            </label>
            <label className={styles.full}>
              Reason
              <textarea
                name="reason"
                minLength={3}
                maxLength={1000}
                defaultValue="Create seasonal/yearly assignment."
                required
              />
            </label>
            <button
              className="primary-button"
              type="submit"
              disabled={
                consoleData.accommodations.length === 0 ||
                consoleData.ratePlans.length === 0
              }
            >
              Create long-term assignment
            </button>
          </form>
          {consoleData.accommodations.length === 0 ? (
            <p>No active campsite or permanent-unit inventory is available.</p>
          ) : null}
          {consoleData.ratePlans.length === 0 ? (
            <p>
              No active Build 039 rate plan has a seasonal or yearly package
              price yet.
            </p>
          ) : null}
        </section>

        <section className="content-panel">
          <SectionHeading
            eyebrow="Assignment ledger"
            title="Current and historical long-term assignments"
            id="seasonal-assignment-ledger"
            helpTopic="campground.structure"
          />
          <div className={styles.tableWrap}>
            <table>
              <thead>
                <tr>
                  <th>Site</th>
                  <th>Occupant</th>
                  <th>Term</th>
                  <th>State</th>
                  <th>Charge</th>
                  <th>Winterization</th>
                  <th>Lifecycle action</th>
                </tr>
              </thead>
              <tbody>
                {consoleData.assignments.map((item) => (
                  <tr key={item.id}>
                    <td>
                      {item.accommodationCode} · {item.accommodationName}
                      <br />
                      <small>{item.accommodationKind}</small>
                    </td>
                    <td>
                      {item.occupantDisplayName ?? "—"}
                      {item.reference ? (
                        <>
                          <br />
                          <small>{item.reference}</small>
                        </>
                      ) : null}
                    </td>
                    <td>
                      {item.assignmentKind} · {item.startsOn} to {item.endsOn}
                    </td>
                    <td>{item.assignmentState}</td>
                    <td>
                      {item.charge
                        ? money(
                            item.charge.amountCents,
                            item.charge.currencyCode,
                          ) +
                          " · " +
                          item.charge.ratePlanCode
                        : "Legacy assignment · no Build 047 snapshot"}
                    </td>
                    <td>
                      {item.winterizationRequired
                        ? "Required"
                        : "Not flagged"}
                    </td>
                    <td>
                      {item.assignmentState === "active" ? (
                        <>
                          <form
                            action={transitionSeasonalAssignmentAction}
                            className={styles.inlineForm}
                          >
                            <input
                              type="hidden"
                              name="campgroundId"
                              value={selected.campgroundId}
                            />
                            <input
                              type="hidden"
                              name="assignmentId"
                              value={item.id}
                            />
                            <input
                              type="hidden"
                              name="expectedRowVersion"
                              value={item.rowVersion}
                            />
                            <input type="hidden" name="action" value="end" />
                            <input
                              name="reason"
                              defaultValue="End long-term assignment."
                              minLength={3}
                              maxLength={1000}
                              required
                            />
                            <button className="secondary-button" type="submit">
                              End
                            </button>
                          </form>
                          <form
                            action={transitionSeasonalAssignmentAction}
                            className={styles.inlineForm}
                          >
                            <input
                              type="hidden"
                              name="campgroundId"
                              value={selected.campgroundId}
                            />
                            <input
                              type="hidden"
                              name="assignmentId"
                              value={item.id}
                            />
                            <input
                              type="hidden"
                              name="expectedRowVersion"
                              value={item.rowVersion}
                            />
                            <input
                              type="hidden"
                              name="action"
                              value="cancel"
                            />
                            <input
                              name="reason"
                              defaultValue="Cancel long-term assignment."
                              minLength={3}
                              maxLength={1000}
                              required
                            />
                            <button className="secondary-button" type="submit">
                              Cancel
                            </button>
                          </form>
                        </>
                      ) : (
                        "Closed"
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {consoleData.assignments.length === 0 ? (
            <p>No seasonal/yearly assignments are recorded yet.</p>
          ) : null}
        </section>

        <section className="content-panel">
          <SectionHeading
            eyebrow="Lifecycle evidence"
            title="Recent assignment events"
            id="seasonal-assignment-events"
            helpTopic="campground.structure"
          />
          <div className={styles.tableWrap}>
            <table>
              <thead>
                <tr>
                  <th>When</th>
                  <th>Event</th>
                  <th>State</th>
                  <th>Channel</th>
                  <th>Reason</th>
                </tr>
              </thead>
              <tbody>
                {consoleData.events.map((event) => (
                  <tr key={event.id}>
                    <td>{new Date(event.occurredAt).toLocaleString("en-CA")}</td>
                    <td>{event.eventKind}</td>
                    <td>
                      {event.fromState ?? "—"} → {event.toState}
                    </td>
                    <td>{event.sourceChannel}</td>
                    <td>{event.reason}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        <section className="content-panel">
          <SectionHeading
            eyebrow="Omnichannel contract"
            title="One seasonal domain across channels"
            id="seasonal-channel-contract"
            helpTopic="campground.structure"
          />
          <p>
            Web/PWA has the full management surface. IVR/DTMF uses verified
            staff-guided site, term and action choices; SMS/MMS uses concise
            verified staff commands or a secure-link handoff for long forms.
            All channels call the same seasonal assignment service and
            <code> seasonal.manage </code> authorization boundary.
          </p>
          <p>
            Payment-card details are never collected by the custom voice or SMS
            flow. Build 047 records the long-term charge source only; later
            finance workflows own collection and settlement.
          </p>
        </section>
      </div>
    </AppShell>
  );
}
