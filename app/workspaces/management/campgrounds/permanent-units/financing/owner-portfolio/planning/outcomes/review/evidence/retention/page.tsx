import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { AppShell } from "@/components/app-shell";
import { SectionHeading } from "@/components/section-heading";
import { requireStaff } from "@/lib/auth/current-session";
import { getOwnerFinanceReport } from "@/lib/permanent-unit-owner-report/postgres.mjs";
import {
  latestByReceipt,
  retentionState,
} from "@/lib/permanent-unit-owner-retention/core.mjs";
import { getOwnerExportRetentionLedger } from "@/lib/permanent-unit-owner-retention/postgres.mjs";
import {
  reconcileExportReceiptAction,
  recordExportRetentionAction,
} from "./actions";
import styles from "../../../../../../../../reservations/reservations.module.css";

export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "Owner export receipt reconciliation & retention · iCamp",
  robots: { index: false, follow: false },
};
const path =
  "/workspaces/management/campgrounds/permanent-units/financing/owner-portfolio/planning/outcomes/review/evidence/retention";
const evidencePath =
  "/workspaces/management/campgrounds/permanent-units/financing/owner-portfolio/planning/outcomes/review/evidence";
const date = (value: string | null) =>
  value
    ? new Date(value).toLocaleDateString("en-CA", {
        timeZone: "UTC",
        year: "numeric",
        month: "short",
        day: "numeric",
      })
    : "—";
const statusLabels: Record<string, string> = {
  requires_reconciliation: "Awaiting independently verified file hash/count",
  no_retention_plan: "Matched; retention decision required",
  retained: "Copy retention attested with an active deadline",
  retention_overdue: "Copy retention deadline overdue",
  copy_disposed: "Copy disposal attested; audit preserved",
};
const actionFields = (id: string, source: string, target: string) => (
  <>
    <input type="hidden" name="exportAcceptanceId" value={id} />
    <input type="hidden" name="sourceCampgroundId" value={source} />
    <input type="hidden" name="targetCampgroundId" value={target} />
  </>
);
export default async function OwnerExportRetentionPage({
  searchParams,
}: Readonly<{
  searchParams: Promise<{
    source?: string;
    target?: string;
    saved?: string;
    error?: string;
  }>;
}>) {
  const session = await requireStaff(path),
    params = await searchParams;
  const portfolio = await getOwnerFinanceReport(session.user.id, 30);
  const camps = portfolio.campgrounds,
    ids = camps.map((c) => c.campgroundId);
  const source = params.source ?? camps[0]?.campgroundId ?? "";
  const target =
    params.target ??
    camps.find((c) => c.campgroundId !== source)?.campgroundId ??
    "";
  if ((source && !ids.includes(source)) || (target && !ids.includes(target)))
    redirect("/auth/not-authorized");
  const validPair = Boolean(source && target && source !== target);
  const ledger = await getOwnerExportRetentionLedger(
    session.user.id,
    validPair ? source : null,
    validPair ? target : null,
  );
  const latestRecs = latestByReceipt(ledger.reconciliations, "reconciledAt");
  const latestEvents = latestByReceipt(ledger.events, "recordedAt");
  return (
    <AppShell>
      <div className="page-stack">
        <nav className="breadcrumbs" aria-label="Breadcrumb">
          <Link href="/">iCamp</Link>
          <span>/</span>
          <Link href={evidencePath}>Owner evidence exports</Link>
          <span>/</span>
          <span>Receipt reconciliation &amp; retention</span>
        </nav>
        <section className="hero-panel">
          <p className="eyebrow">Build 106 · Independent receipt assurance</p>
          <h1>Export reconciliation &amp; copy retention</h1>
          <p className="hero-panel__lead">
            An independent authorized owner checks the downloaded CSV
            file&apos;s SHA-256 digest and data-row count against the original
            export receipt. After a match, owners can attest to controlled
            storage, a bounded retention extension, or manual disposal of a
            copy.
          </p>
          <p>
            No file is uploaded, automatically deleted, archived or transmitted
            here. An attestation is a recorded human statement—not proof that a
            local file was erased. Immutable export receipts and the audit
            history remain intact.
          </p>
        </section>
        {params.saved ? (
          <p className="content-panel" role="status">
            {params.saved}
          </p>
        ) : null}
        {params.error ? (
          <p className="content-panel" role="alert">
            {params.error}
          </p>
        ) : null}
        <section className="content-panel">
          <SectionHeading
            id="owner-export-pair"
            eyebrow="Dual-property owner scope"
            title="Choose export campground pair"
            helpTopic="permanent.owner-retention"
          />
          <form method="get" className={styles.inlineForm}>
            <label>
              Source campground
              <select name="source" defaultValue={source}>
                {camps.map((c) => (
                  <option key={c.campgroundId} value={c.campgroundId}>
                    {c.name}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Target campground
              <select name="target" defaultValue={target}>
                {camps.map((c) => (
                  <option key={c.campgroundId} value={c.campgroundId}>
                    {c.name}
                  </option>
                ))}
              </select>
            </label>
            <button type="submit" className="primary-button">
              View export receipts
            </button>
          </form>
          {!validPair ? (
            <p role="alert">
              Choose two different authorized campgrounds to review
              cross-property export receipts.
            </p>
          ) : null}
          {portfolio.limited ||
          ledger.receiptsLimited ||
          ledger.historyLimited ? (
            <p role="alert">
              The owner portfolio or receipt history is limited. Missing older
              records must not be interpreted as evidence of no export or no
              retention action.
            </p>
          ) : null}
          <p>
            For Windows, use PowerShell{" "}
            <code>
              Get-FileHash -Algorithm SHA256 &lt;path-to-downloaded-csv&gt;
            </code>{" "}
            to calculate the file digest locally. Count data rows without
            including the CSV header. Never upload the CSV to this application
            for reconciliation.
          </p>
        </section>
        <section className="content-panel">
          <SectionHeading
            id="owner-export-receipts"
            eyebrow="Append-only audit lifecycle"
            title="Reconcile and document retention"
            helpTopic="permanent.owner-retention"
          />
          {!ledger.receipts.length ? (
            <p>No export receipts are visible for this campground pair.</p>
          ) : null}
          {ledger.receipts.map((receipt) => {
            const rec = latestRecs.get(receipt.id),
              event = latestEvents.get(receipt.id),
              state = retentionState(rec, event);
            const acceptedByMe = receipt.acceptedByUserId === session.user.id;
            const reconciled = rec?.result === "matched";
            return (
              <article className="content-panel" key={receipt.id}>
                <h3>
                  Export receipt {receipt.id.slice(0, 8)} ·{" "}
                  {date(receipt.acceptedAt)}
                </h3>
                <p>
                  <strong>{statusLabels[state]}</strong> ·{" "}
                  {receipt.exportRowCount} data rows · Filter:{" "}
                  {receipt.searchStatus} · Source: {receipt.evidenceReference}
                </p>
                <p>
                  <strong>Original SHA-256:</strong>{" "}
                  <code>{receipt.exportSha256}</code>
                </p>
                {rec ? (
                  <p>
                    Latest independent reconciliation: {rec.result} ·{" "}
                    {date(rec.reconciledAt)} · {rec.reconciliationNote}
                  </p>
                ) : null}
                {event ? (
                  <p>
                    Latest copy event: {event.eventKind} ·{" "}
                    {date(event.recordedAt)} · Retention due{" "}
                    {date(event.retentionDueAt)} · {event.retentionNote}
                  </p>
                ) : null}
                {state === "retention_overdue" ? (
                  <p role="alert">
                    Retention deadline has passed. Record a new owner decision;
                    the system does not erase the copy automatically.
                  </p>
                ) : null}
                {!reconciled && !acceptedByMe ? (
                  <form
                    action={reconcileExportReceiptAction}
                    className={styles.formGrid}
                  >
                    {actionFields(receipt.id, source, target)}
                    <label>
                      Locally observed CSV SHA-256
                      <input
                        name="observedSha256"
                        required
                        minLength={64}
                        maxLength={64}
                        pattern="[A-Fa-f0-9]{64}"
                        placeholder="64-character file hash"
                      />
                    </label>
                    <label>
                      Locally counted data rows
                      <input
                        name="observedCount"
                        type="number"
                        required
                        min={1}
                        max={50}
                      />
                    </label>
                    <label>
                      Evidence reference
                      <input
                        name="evidenceReference"
                        required
                        minLength={8}
                        maxLength={400}
                        placeholder="Owner local-file verification record"
                      />
                    </label>
                    <label>
                      Reconciliation note
                      <textarea
                        name="reconciliationNote"
                        required
                        minLength={12}
                        maxLength={800}
                        placeholder="Describe the manual file verification; no personal information"
                      />
                    </label>
                    <button type="submit" className="primary-button">
                      Record independent file reconciliation
                    </button>
                  </form>
                ) : null}
                {!reconciled && acceptedByMe ? (
                  <p>
                    A separate authorized owner must independently reconcile the
                    file; the export-accepting owner cannot verify their own
                    receipt.
                  </p>
                ) : null}
                {reconciled && state !== "copy_disposed" ? (
                  <form
                    action={recordExportRetentionAction}
                    className={styles.formGrid}
                  >
                    {actionFields(receipt.id, source, target)}
                    <label>
                      Manual retention action
                      <select
                        name="eventKind"
                        defaultValue={event ? "extended" : "retained"}
                      >
                        {!event ? (
                          <option value="retained">
                            Attest to controlled storage
                          </option>
                        ) : (
                          <option value="extended">
                            Extend manual retention deadline
                          </option>
                        )}
                        {event ? (
                          <option value="copy_disposed">
                            Attest that downloaded copy was disposed of
                          </option>
                        ) : null}
                      </select>
                    </label>
                    <label>
                      Retention due date UTC (leave blank for disposal only)
                      <input name="retentionDueAt" type="date" />
                    </label>
                    <label>
                      Local storage/disposal evidence reference
                      <input
                        name="evidenceReference"
                        required
                        minLength={8}
                        maxLength={400}
                      />
                    </label>
                    <label>
                      Owner attestation
                      <textarea
                        name="retentionNote"
                        required
                        minLength={12}
                        maxLength={800}
                        placeholder="Where the file is controlled, or how local disposal was verified"
                      />
                    </label>
                    <label>
                      <input name="confirmed" type="checkbox" value="yes" /> I
                      confirm any disposal attestation refers only to a locally
                      held copy, not removal of immutable iCamp evidence.
                    </label>
                    <button type="submit" className="primary-button">
                      Record retention/disposal attestation
                    </button>
                  </form>
                ) : null}
                <p>
                  Reconciliation history:{" "}
                  {
                    ledger.reconciliations.filter(
                      (r) => r.exportAcceptanceId === receipt.id,
                    ).length
                  }{" "}
                  · Copy events:{" "}
                  {
                    ledger.events.filter(
                      (e) => e.exportAcceptanceId === receipt.id,
                    ).length
                  }
                  . Receipts cannot be edited or deleted.
                </p>
              </article>
            );
          })}
        </section>
      </div>
    </AppShell>
  );
}
