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
  listLongTermAssignmentOptions,
  listLongTermAssignments,
} from "@/lib/long-term-assignment/postgres.mjs";

import {
  createLongTermAssignmentAction,
  transitionLongTermAssignmentAction,
} from "./actions";
import styles from "../reservations/reservations.module.css";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Seasonal & yearly assignments · iCamp",
  description:
    "Manage long-term seasonal and yearly campsite or permanent-unit assignments.",
};

function money(cents: number | null, currencyCode: string) {
  if (cents == null) return "—";
  return new Intl.NumberFormat("en-CA", {
    style: "currency",
    currency: currencyCode,
  }).format(cents / 100);
}

function today() {
  return new Date().toISOString().slice(0, 10);
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

  const [options, assignments] = await Promise.all([
    listLongTermAssignmentOptions({
      userId: session.user.id,
      campgroundId: selected.campgroundId,
    }),
    listLongTermAssignments({
      userId: session.user.id,
      campgroundId: selected.campgroundId,
    }),
  ]);

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
            Assign active seasonal/yearly campsites and permanent units while
            keeping Build 035 availability authoritative. Package charges are
            derived from Build 039 on the server and protected as immutable
            assignment evidence.
          </p>
          <p>
            Required winter closures now depend on separate shutdown evidence
            and foreman approval.{" "}
            <Link
              href={`/workspaces/management/campgrounds/winterization?campground=${encodeURIComponent(selected.campgroundId)}`}
            >
              Open the Build 087 winterization checklist
            </Link>
            .
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
            id="long-term-scope"
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
            eyebrow="New assignment"
            title="Assign a seasonal or yearly site"
            id="long-term-create"
            helpTopic="campground.structure"
          />
          <p>
            Staff choose the site, term and rate plan; the server validates the
            site profile, rate scope, dates and canonical package amount before
            the assignment can be committed.
          </p>
          <form
            action={createLongTermAssignmentAction}
            className={styles.formGrid}
          >
            <input
              type="hidden"
              name="campgroundId"
              value={selected.campgroundId}
            />
            <label>
              Accommodation
              <select name="accommodationId" required>
                {options.accommodations.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.code} · {item.displayName} ·{" "}
                    {item.accommodationKind === "permanent_unit"
                      ? "permanent unit"
                      : item.stayProfile}
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
              Occupant display name
              <input name="occupantDisplayName" maxLength={160} required />
            </label>
            <label>
              Contact email
              <input name="contactEmail" type="email" maxLength={254} />
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
              Charge due on
              <input name="chargeDueOn" type="date" required />
            </label>
            <label>
              Office reference
              <input name="reference" maxLength={160} />
            </label>
            <label className={styles.full}>
              Rate plan
              <select name="ratePlanId" required>
                {options.ratePlans.map((plan) => (
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
              <input type="checkbox" name="winterizationRequired" /> This
              assignment requires completed winter shutdown evidence and
              maintenance/foreman approval before winter-closing the site.
            </label>
            <label className={styles.full}>
              Staff note / reason
              <textarea
                name="notes"
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
                options.accommodations.length === 0 ||
                options.ratePlans.length === 0
              }
            >
              Create long-term assignment
            </button>
          </form>
          {options.accommodations.length === 0 ? (
            <p>
              No active seasonal/yearly campsite or permanent-unit inventory is
              available.
            </p>
          ) : null}
          {options.ratePlans.length === 0 ? (
            <p>No active rate plan has a seasonal or yearly package price.</p>
          ) : null}
        </section>

        <section className="content-panel">
          <SectionHeading
            eyebrow="Assignment ledger"
            title="Current & historical long-term assignments"
            id="long-term-ledger"
            helpTopic="campground.structure"
          />
          <div className={styles.tableWrap}>
            <table>
              <thead>
                <tr>
                  <th>Accommodation</th>
                  <th>Occupant</th>
                  <th>Term</th>
                  <th>Status</th>
                  <th>Charge snapshot</th>
                  <th>Winterization</th>
                  <th>Lifecycle</th>
                </tr>
              </thead>
              <tbody>
                {assignments.map((item) => (
                  <tr key={item.id}>
                    <td>
                      {item.accommodationCode} · {item.accommodationName}
                      <br />
                      <small>{item.accommodationKind}</small>
                    </td>
                    <td>
                      {item.occupantDisplayName}
                      {item.contactEmail ? (
                        <>
                          <br />
                          <small>{item.contactEmail}</small>
                        </>
                      ) : null}
                    </td>
                    <td>
                      {item.assignmentKind} · {item.startsOn} to {item.endsOn}
                    </td>
                    <td>
                      {item.assignmentState} · {item.occupancyState}
                    </td>
                    <td>
                      {item.chargeAmountCents == null
                        ? "Legacy assignment"
                        : money(item.chargeAmountCents, item.currencyCode)}
                      {item.chargeDueOn ? (
                        <>
                          <br />
                          <small>Due {item.chargeDueOn}</small>
                        </>
                      ) : null}
                    </td>
                    <td>
                      {item.winterizationRequired ? "Required" : "Not flagged"}
                    </td>
                    <td>
                      {item.assignmentState === "active" ? (
                        <>
                          {item.occupancyState === "winter_closed" ? (
                            <form
                              action={transitionLongTermAssignmentAction}
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
                                name="eventKind"
                                value="reopened"
                              />
                              <input
                                type="hidden"
                                name="effectiveOn"
                                value={today()}
                              />
                              <input
                                type="hidden"
                                name="note"
                                value="Reopen long-term assignment."
                              />
                              <button
                                className="secondary-button"
                                type="submit"
                              >
                                Reopen
                              </button>
                            </form>
                          ) : (
                            <form
                              action={transitionLongTermAssignmentAction}
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
                                name="eventKind"
                                value="winter_closed"
                              />
                              <input
                                type="hidden"
                                name="effectiveOn"
                                value={today()}
                              />
                              <input
                                type="hidden"
                                name="note"
                                value="Mark long-term assignment winter closed."
                              />
                              <button
                                className="secondary-button"
                                type="submit"
                              >
                                Winter close
                              </button>
                            </form>
                          )}

                          <form
                            action={transitionLongTermAssignmentAction}
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
                              name="eventKind"
                              value="ended"
                            />
                            <input
                              type="hidden"
                              name="effectiveOn"
                              value={today()}
                            />
                            <input
                              type="hidden"
                              name="note"
                              value="End long-term assignment."
                            />
                            <button className="secondary-button" type="submit">
                              End
                            </button>
                          </form>

                          <form
                            action={transitionLongTermAssignmentAction}
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
                              name="eventKind"
                              value="cancelled"
                            />
                            <input
                              type="hidden"
                              name="effectiveOn"
                              value={today()}
                            />
                            <input
                              type="hidden"
                              name="note"
                              value="Cancel long-term assignment."
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
          {assignments.length === 0 ? (
            <p>No long-term assignments are recorded yet.</p>
          ) : null}
        </section>

        <section className="content-panel">
          <SectionHeading
            eyebrow="Channel parity"
            title="One long-term domain across interfaces"
            id="long-term-channels"
            helpTopic="campground.structure"
          />
          <p>
            Web/PWA provides the full management experience. IVR/DTMF supports
            verified-staff status and guided lifecycle actions; SMS/MMS uses
            concise verified-staff commands or secure-link handoff for complex
            review. Every channel invokes the same seasonal domain and
            <code> seasonal.manage </code> authorization.
          </p>
          <p>
            Raw payment-card details are never accepted through the custom voice
            or SMS flow. Build 047 records the canonical package charge only;
            later finance builds own collection and settlement.
          </p>
        </section>
      </div>
    </AppShell>
  );
}
