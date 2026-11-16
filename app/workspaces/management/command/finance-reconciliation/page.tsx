import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";

import { AppShell } from "@/components/app-shell";
import { AccountingReconciliation259 } from "@/components/accounting-reconciliation259";
import { SectionHeading } from "@/components/section-heading";
import { SettlementPreview196 } from "@/components/settlement-preview196";
import { requireStaff } from "@/lib/auth/current-session";
import {
  getCampgroundAuthorization,
  listAssignedCampgrounds,
} from "@/lib/authz/postgres.mjs";
import { getCampgroundReconciliation259 } from "@/lib/finance-reconciliation259/postgres.mjs";

import styles from "../finance-close/finance-close.module.css";

export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "Build 259 financial reconciliation · iCamp",
  description: "Property-scoped payment, deposit, invoice, refund, settlement and accounting review.",
};

const money = (cents: number | null) =>
  cents === null ? "unknown" : (cents / 100).toFixed(2);

export default async function FinanceReconciliation259Page({
  searchParams,
}: Readonly<{
  searchParams: Promise<{ campground?: string; day?: string }>;
}>) {
  const path = "/workspaces/management/command/finance-reconciliation";
  const session = await requireStaff(path);
  const query = await searchParams;
  const assigned = await listAssignedCampgrounds(session.user.id);
  const permitted = (
    await Promise.all(
      assigned.map(async (campground) => {
        const auth = await getCampgroundAuthorization(session.user.id, campground.campgroundId);
        return auth?.permissions.some((item) =>
          ["finance.read", "finance.manage"].includes(item),
        ) && auth.permissions.some((item) =>
          ["reservation.read", "reservation.modify"].includes(item),
        )
          ? campground
          : null;
      }),
    )
  ).filter((value): value is NonNullable<typeof value> => value !== null);
  if (!permitted.length) redirect("/auth/not-authorized");
  const selected = permitted.find((item) =>
    item.campgroundId === query.campground) ?? permitted[0];
  const snapshot = await getCampgroundReconciliation259({
    userId: session.user.id,
    campgroundId: selected.campgroundId,
    localDate: query.day,
  }).then((value) => ({ value, error: null })).catch(() => ({
    value: null,
    error: "Authoritative financial evidence unavailable or close date invalid.",
  }));

  return (
    <AppShell>
      <div className="page-stack">
        <nav className="breadcrumbs" aria-label="Breadcrumb">
          <Link href="/">iCamp</Link>
          <span>/</span>
          <Link href="/workspaces/management/command">Management Command</Link>
          <span>/</span>
          <span>Financial reconciliation</span>
        </nav>
        <section className="hero-panel">
          <p className="eyebrow">Build 259 · non-posting financial controls</p>
          <h1>Payments, deposits, invoices, refunds & accounting</h1>
          <p className="hero-panel__lead">
            Review original campground records alongside independent statement
            exports. Nothing here initiates a charge, refund, bank settlement or
            accounting posting.
          </p>
          <div className="hero-actions">
            <Link className="secondary-link" href="/workspaces/management/command/finance-close">
              Daily finance close
            </Link>
            <Link className="secondary-link" href="/workspaces/management/campgrounds/payments">
              Deposit policy
            </Link>
            <Link className="secondary-link" href="/workspaces/management/campgrounds/refunds">
              Refund policy
            </Link>
          </div>
        </section>
        <section className="content-panel">
          <SectionHeading id="finance259-scope" eyebrow="Tenant boundary" title="Select property and local day" helpTopic="shell.overview" />
          <form method="get" className={styles.controls}>
            <label>
              Campground
              <select name="campground" defaultValue={selected.campgroundId}>
                {permitted.map((campground) => (
                  <option key={campground.campgroundId} value={campground.campgroundId}>
                    {campground.campgroundName}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Local financial day
              <input name="day" type="date" defaultValue={query.day} />
            </label>
            <button className="primary-button" type="submit">Review day</button>
          </form>
          <p className={styles.note}>Date range follows the existing 31-day finance-close policy. Historic evidence is windowed and never treated as an all-time account balance.</p>
        </section>
        {snapshot.error ? (
          <section className="content-panel" role="alert">
            <h2>Financial evidence on hold</h2>
            <p>{snapshot.error}</p>
            <p>No invented balances or assumed successful settlements are shown.</p>
          </section>
        ) : null}
        {snapshot.value ? (
          <>
            <section className="content-panel">
              <SectionHeading id="finance259-gates" eyebrow="Source and approval gates" title="Financial control status" helpTopic="shell.overview" />
              <p><strong>Internal source:</strong> {snapshot.value.reconciliation.internalReviewStatus}</p>
              <p><strong>Provider reconciliation:</strong> {snapshot.value.reconciliation.providerSettlementStatus}</p>
              <p><strong>Accounting close:</strong> {snapshot.value.reconciliation.accountingCloseStatus}</p>
              <p><strong>Local date:</strong> {snapshot.value.reconciliation.localDate} ({snapshot.value.reconciliation.timezone})</p>
              <p><strong>Source at:</strong> {snapshot.value.reconciliation.generatedAt}</p>
              <p><strong>Source rows:</strong> {snapshot.value.reconciliation.sourceCounts.payments} payments, {snapshot.value.reconciliation.sourceCounts.refunds} refunds, {snapshot.value.reconciliation.sourceCounts.invoices} invoices, {snapshot.value.reconciliation.sourceCounts.schedules} schedules.</p>
              {snapshot.value.reconciliation.incomplete ? (
                <p className={styles.warning} role="alert">Source rows were capped. Full reconciliation is blocked.</p>
              ) : null}
              <p className={styles.note}>{snapshot.value.reconciliation.disclaimer}</p>
            </section>
            <section className="content-panel">
              <SectionHeading id="finance259-deposits" eyebrow="Original payment obligations" title="Deposit coverage review" helpTopic="shell.overview" />
              <p className={styles.note}>Captured amounts cover all payment purposes in the evidence window. They are not proof of deposit allocation or collection outside that window.</p>
              <div className={styles.tableScroll}>
                <table>
                  <thead><tr><th scope="col">Reservation</th><th scope="col">Scheduled booking deposit</th><th scope="col">Captured in window</th><th scope="col">Review state</th></tr></thead>
                  <tbody>
                    {snapshot.value.reconciliation.deposits.map((item) => (
                      <tr key={item.reservationId}>
                        <td><Link href={`/workspaces/management/campgrounds/reservations/${encodeURIComponent(item.reservationId)}/financial?campground=${encodeURIComponent(selected.campgroundId)}`}>{item.reservationId.slice(0, 8)}</Link></td>
                        <td>{money(item.depositDueCents)}</td>
                        <td>{money(item.capturedInWindowCents)}</td>
                        <td>{item.state}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {snapshot.value.reconciliation.deposits.length === 0 ? (
                <p>No in-window payment or refund activity for deposit review.</p>
              ) : null}
            </section>
            <section className="content-panel">
              <SectionHeading id="finance259-exceptions" eyebrow="Invoice, receipt, refund and provider checks" title="Exceptions requiring review" helpTopic="shell.overview" />
              {snapshot.value.reconciliation.findings.length === 0 ? (
                <p>No local source exceptions were detected in this bounded window.</p>
              ) : (
                <div className={styles.tableScroll}>
                  <table>
                    <thead><tr><th scope="col">Priority</th><th scope="col">Category</th><th scope="col">Reservation</th><th scope="col">Evidence</th></tr></thead>
                    <tbody>
                      {snapshot.value.reconciliation.findings.slice(0, 150).map((item, index) => (
                        <tr key={`${item.kind}-${item.sourceId}-${index}`}>
                          <td>{item.priority}</td><td>{item.kind}</td>
                          <td>{item.reservationId.slice(0, 8)}</td><td>{item.detail}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
              {snapshot.value.reconciliation.findings.length > 150 ? (
                <p className={styles.warning}>Only the first 150 findings are displayed. Full exception review is on hold.</p>
              ) : null}
            </section>
            <section className="content-panel">
              <SectionHeading id="finance259-settlements" eyebrow="Provider verification" title="Compare independent settlement evidence" helpTopic="shell.overview" />
              <SettlementPreview196
                expected={snapshot.value.settlementExpected}
                incomplete={snapshot.value.reconciliation.incomplete}
              />
            </section>
            <section className="content-panel">
              <SectionHeading id="finance259-accounting" eyebrow="External accounting proof" title="Compare exported ledger amounts" helpTopic="shell.overview" />
              <AccountingReconciliation259
                expected={snapshot.value.reconciliation.accountingExpected}
                incomplete={snapshot.value.reconciliation.incomplete}
              />
            </section>
          </>
        ) : null}
      </div>
    </AppShell>
  );
}
