import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";

import { AppShell } from "@/components/app-shell";
import { SectionHeading } from "@/components/section-heading";
import { SettlementPreview196 } from "@/components/settlement-preview196";
import { requireStaff } from "@/lib/auth/current-session";
import {
  getCampgroundAuthorization,
  listAssignedCampgrounds,
} from "@/lib/authz/postgres.mjs";
import {
  getCampgroundFinanceCloseSource,
  settlementExpectedRows,
} from "@/lib/finance-close/postgres.mjs";
import { getPaymentProviderConfig } from "@/lib/payments/provider.mjs";
import { decideFinancialAdjustmentAction } from "@/app/workspaces/management/campgrounds/reservations/actions";

import styles from "./finance-close.module.css";

export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "Financial close & exceptions · iCamp",
  description:
    "Source-grounded refund readiness, financial exception review, and a non-posting daily close worksheet.",
};

const money = (cents: number, currency: string) =>
  `${currency} ${(cents / 100).toFixed(2)}`;
const reservationHref = (reservationId: string, campgroundId: string) =>
  `/workspaces/management/campgrounds/reservations/${encodeURIComponent(reservationId)}/financial?campground=${encodeURIComponent(campgroundId)}`;

export default async function FinanceClosePage({
  searchParams,
}: Readonly<{
  searchParams: Promise<{
    campground?: string;
    day?: string;
    saved?: string;
    error?: string;
  }>;
}>) {
  const path = "/workspaces/management/command/finance-close";
  const session = await requireStaff(path);
  const query = await searchParams;
  const assigned = await listAssignedCampgrounds(session.user.id);
  const permitted = (
    await Promise.all(
      assigned.map(async (item) => {
        const auth = await getCampgroundAuthorization(
          session.user.id,
          item.campgroundId,
        );
        return auth?.permissions.some((key) =>
          ["finance.read", "finance.manage"].includes(key),
        ) &&
          auth.permissions.some((key) =>
            ["reservation.read", "reservation.modify"].includes(key),
          )
          ? { item, auth }
          : null;
      }),
    )
  ).filter((value): value is NonNullable<typeof value> => value !== null);
  if (!permitted.length) redirect("/auth/not-authorized");
  const selected =
    permitted.find(({ item }) => item.campgroundId === query.campground) ??
    permitted[0];
  const mayApprove = selected.auth.permissions.includes("finance.manage");
  const snapshot = await getCampgroundFinanceCloseSource({
    userId: session.user.id,
    campgroundId: selected.item.campgroundId,
    localDate: query.day,
  })
    .then((data) => ({ data, error: null }))
    .catch((error: unknown) => ({
      data: null,
      error:
        error instanceof Error
          ? error.message
          : "Financial sources unavailable.",
    }));
  const base = `?campground=${encodeURIComponent(selected.item.campgroundId)}`;
  const provider = getPaymentProviderConfig();

  return (
    <AppShell>
      <div className="page-stack">
        <nav className="breadcrumbs" aria-label="Breadcrumb">
          <Link href="/">iCamp</Link>
          <span>/</span>
          <Link href="/workspaces/management/command">Management Command</Link>
          <span>/</span>
          <span>Financial close</span>
        </nav>
        <section className="hero-panel">
          <p className="eyebrow">Build 196 · Management / Finance</p>
          <h1>Financial exception review & daily close</h1>
          <p className="hero-panel__lead">
            Evidence-linked deposits, receipts, refunds and manual adjustments.
            Review and export only—no automatic settlement, bank reconciliation
            or close posting.
          </p>
          <div className="hero-actions">
            <Link
              href="/workspaces/management/campgrounds/payments"
              className="secondary-link"
            >
              Payment policy
            </Link>
            <Link
              href="/workspaces/management/campgrounds/refunds"
              className="secondary-link"
            >
              Refund safeguards
            </Link>
          </div>
        </section>
        {query.saved ? (
          <p role="status" className={styles.notice}>
            {query.saved}
          </p>
        ) : null}
        {query.error ? (
          <p role="alert" className={styles.warning}>
            {query.error}
          </p>
        ) : null}

        <section className="content-panel">
          <SectionHeading
            eyebrow="Scope & date"
            title="Source-of-truth selection"
            id="finance196-scope"
            helpTopic="shell.overview"
          />
          <form method="get" className={styles.controls}>
            <label>
              Campground
              <select
                name="campground"
                defaultValue={selected.item.campgroundId}
              >
                {permitted.map(({ item }) => (
                  <option key={item.campgroundId} value={item.campgroundId}>
                    {item.campgroundName}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Local campground day
              <input name="day" type="date" defaultValue={query.day} />
            </label>
            <button className="primary-button" type="submit">
              Review financial day
            </button>
          </form>
          <p className={styles.note}>
            Dates use campground local time. Select today or a day within the
            past 31 days. Historic evidence window: 100 days preceding the
            selected day.
          </p>
        </section>
        {snapshot.error ? (
          <section className="content-panel" role="alert">
            <h2>Source unavailable</h2>
            <p>{snapshot.error}</p>
            <p>
              No totals or exception counts are inferred while source retrieval
              fails.
            </p>
          </section>
        ) : null}

        {snapshot.data ? (
          <>
            <section className="content-panel">
              <SectionHeading
                eyebrow="Provenance"
                title="Source freshness & activation boundary"
                id="finance196-source"
                helpTopic="shell.overview"
              />
              <div className={styles.meta}>
                <p>
                  <strong>Campground:</strong> {selected.item.campgroundName}
                </p>
                <p>
                  <strong>Local day:</strong> {snapshot.data.review.localDate} (
                  {snapshot.data.review.timezone})
                </p>
                <p>
                  <strong>Read at:</strong> {snapshot.data.review.generatedAt}
                </p>
                <p>
                  <strong>Provider:</strong> {provider.provider} /{" "}
                  {provider.mode}
                </p>
                <p>
                  <strong>Records:</strong>{" "}
                  {snapshot.data.review.sourceCounts.payments} payments ·{" "}
                  {snapshot.data.review.sourceCounts.refunds} refunds ·{" "}
                  {snapshot.data.review.sourceCounts.adjustments} adjustments
                </p>
              </div>
              {snapshot.data.review.truncated ? (
                <p className={styles.warning} role="alert">
                  Source exceeded a 400-row cap. Figures are incomplete; review
                  and reconcile the uncapped provider ledger before any close.
                </p>
              ) : null}
              <p className={styles.note}>
                Billing and Omnichannel provider activation remain HELD. A READY
                provider refund in this view is not authorization to issue live
                funds.
              </p>
            </section>

            <section className="content-panel">
              <SectionHeading
                eyebrow="Workboard"
                title="Source-linked financial exceptions"
                id="finance196-inbox"
                helpTopic="shell.overview"
              />
              <p>
                {snapshot.data.review.cases.length} review entries found in the
                bounded source window. Counts are evidence indicators, not
                financial balances.
              </p>
              <div className={styles.tableScroll}>
                <table>
                  <caption>Priority-sorted exception inbox</caption>
                  <thead>
                    <tr>
                      <th scope="col">Priority</th>
                      <th scope="col">Category</th>
                      <th scope="col">Evidence</th>
                      <th scope="col">Reason / next action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {snapshot.data.review.cases.map((item, index) => (
                      <tr key={`${item.sourceId}-${item.type}-${index}`}>
                        <td>
                          <span
                            className={
                              item.priority === "critical"
                                ? styles.critical
                                : styles.attention
                            }
                          >
                            {item.priority}
                          </span>
                        </td>
                        <td>{item.type}</td>
                        <td>
                          <Link
                            href={reservationHref(
                              item.reservationId,
                              selected.item.campgroundId,
                            )}
                          >
                            Reservation record
                          </Link>
                          <small>{item.sourceId}</small>
                        </td>
                        <td>{item.summary}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {!snapshot.data.review.cases.length ? (
                  <p>
                    No exceptions found in the returned source window; this is
                    not a statement of zero risk.
                  </p>
                ) : null}
              </div>
            </section>

            <section className="content-panel">
              <SectionHeading
                eyebrow="Day close"
                title="Non-posting close worksheet"
                id="finance196-close"
                helpTopic="shell.overview"
              />
              <p>
                {snapshot.data.review.disclaimer} Amounts derive from event
                timestamps in the selected campground time zone.
              </p>
              <div className={styles.tableScroll}>
                <table>
                  <caption>
                    Recorded source movements by currency; never combines
                    currencies
                  </caption>
                  <thead>
                    <tr>
                      <th scope="col">Currency</th>
                      <th scope="col">Captured</th>
                      <th scope="col">Succeeded refunds</th>
                      <th scope="col">Net recorded</th>
                      <th scope="col">Receipts issued</th>
                      <th scope="col">Adjustment evidence (gross)</th>
                    </tr>
                  </thead>
                  <tbody>
                    {snapshot.data.review.worksheet.map((row) => (
                      <tr key={row.currencyCode}>
                        <th scope="row">{row.currencyCode}</th>
                        <td>{money(row.capturedCents, row.currencyCode)}</td>
                        <td>
                          {money(row.succeededRefundCents, row.currencyCode)}
                        </td>
                        <td>
                          {money(
                            row.netRecordedMovementCents,
                            row.currencyCode,
                          )}
                        </td>
                        <td>
                          {money(row.issuedReceiptCents, row.currencyCode)}
                        </td>
                        <td>
                          {money(row.adjustmentEvidenceCents, row.currencyCode)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {!snapshot.data.review.worksheet.length ? (
                  <p>
                    No dated monetary events in the returned source window. No
                    zero-amount close is asserted.
                  </p>
                ) : null}
              </div>
              <p className={styles.note}>
                Receipt issue date may differ from capture date. Adjustments are
                a separate gross evidence column, not automatic cash movement.
                Resolve priority exceptions with independent oversight before a
                manual close decision.
              </p>
              <div className="hero-actions">
                <Link
                  className="secondary-link"
                  href={`/api/management/finance-close/export${base}&day=${encodeURIComponent(snapshot.data.review.localDate)}`}
                >
                  Download evidenced CSV
                </Link>
              </div>
            </section>

            <section className="content-panel">
              <SectionHeading
                eyebrow="Maker/checker"
                title="Independent adjustment approval queue"
                id="finance196-approvals"
                helpTopic="shell.overview"
              />
              <p>
                Proposals and decisions are zero-effect append-only entries.
                Only a different finance manager can approve. Posting an
                approved proposal is a separate, audited action on the
                reservation.
              </p>
              <div className={styles.proposals}>
                {snapshot.data.review.proposals.map((proposal) => (
                  <article key={proposal.id} className={styles.proposal}>
                    <p>
                      <strong>
                        {proposal.requestedKind} ·{" "}
                        {money(
                          proposal.requestedAmountCents,
                          proposal.currencyCode,
                        )}
                      </strong>{" "}
                      — {proposal.decision ?? "awaiting checker"}
                    </p>
                    <p>{proposal.reason}</p>
                    <p>
                      <Link
                        href={reservationHref(
                          proposal.reservationId,
                          selected.item.campgroundId,
                        )}
                      >
                        Reservation / posting evidence
                      </Link>
                    </p>
                    {mayApprove &&
                    !proposal.decision &&
                    proposal.actorUserId !== session.user.id ? (
                      <form
                        action={decideFinancialAdjustmentAction}
                        className={styles.decision}
                      >
                        <input
                          type="hidden"
                          name="campgroundId"
                          value={selected.item.campgroundId}
                        />
                        <input
                          type="hidden"
                          name="proposalId"
                          value={proposal.id}
                        />
                        <label>
                          Independent review reason
                          <textarea
                            name="reason"
                            minLength={8}
                            maxLength={700}
                            required
                            placeholder="Describe the independently checked evidence"
                          />
                        </label>
                        <button
                          type="submit"
                          name="decision"
                          value="approved"
                          className="primary-button"
                        >
                          Approve (no posting)
                        </button>
                        <button
                          type="submit"
                          name="decision"
                          value="rejected"
                          className="secondary-link"
                        >
                          Reject
                        </button>
                      </form>
                    ) : !proposal.decision ? (
                      <p className={styles.note}>
                        A different finance manager must review this proposal.
                      </p>
                    ) : null}
                  </article>
                ))}
              </div>
              {!snapshot.data.review.proposals.length ? (
                <p>No adjustment proposals in the returned evidence window.</p>
              ) : null}
            </section>

            <section className="content-panel">
              <SectionHeading
                eyebrow="Provider-neutral"
                title="Settlement import preview (local only)"
                id="finance196-settlement"
                helpTopic="shell.overview"
              />
              <SettlementPreview196
                expected={settlementExpectedRows(snapshot.data.source)}
                incomplete={snapshot.data.review.truncated}
              />
            </section>
          </>
        ) : null}
      </div>
    </AppShell>
  );
}
