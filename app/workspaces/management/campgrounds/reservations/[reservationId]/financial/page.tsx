import { randomUUID } from "node:crypto";

import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";

import { AppShell } from "@/components/app-shell";
import { SectionHeading } from "@/components/section-heading";
import { requireStaff } from "@/lib/auth/current-session";
import { getCampgroundAuthorization } from "@/lib/authz/postgres.mjs";
import { formatMoney } from "@/lib/pricing/core.mjs";
import { getReservationFinancialSafeguards } from "@/lib/refunds/postgres.mjs";

import {
  approveRefundAction,
  executeRefundAction,
  recordCancellationForfeitAction,
  recordFinancialAdjustmentAction,
  rejectRefundAction,
  requestRefundAction,
} from "../../actions";
import styles from "../../reservations.module.css";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Reservation financial safeguards · iCamp",
  description:
    "Review cancellation policy, refunds, approvals and append-only financial adjustments.",
};

export default async function ReservationFinancialSafeguardsPage({
  params,
  searchParams,
}: Readonly<{
  params: Promise<{ reservationId: string }>;
  searchParams: Promise<{
    campground?: string;
    saved?: string;
    error?: string;
  }>;
}>) {
  const { reservationId } = await params;
  const query = await searchParams;
  const campgroundId = String(query.campground ?? "").trim();
  if (!campgroundId) {
    redirect("/workspaces/management/campgrounds/reservations");
  }

  const path =
    "/workspaces/management/campgrounds/reservations/" +
    encodeURIComponent(reservationId) +
    "/financial?campground=" +
    encodeURIComponent(campgroundId);
  const session = await requireStaff(path);
  const authorization = await getCampgroundAuthorization(
    session.user.id,
    campgroundId,
  );
  if (
    !authorization ||
    !authorization.permissions.some((permission) =>
      ["payment.read", "refund.issue", "finance.read", "finance.manage"].includes(
        permission,
      ),
    )
  ) {
    redirect("/auth/not-authorized");
  }

  const safeguards = await getReservationFinancialSafeguards({
    userId: session.user.id,
    campgroundId,
    reservationId,
  });
  if (!safeguards) notFound();

  const mayRefund = authorization.permissions.includes("refund.issue");
  const mayApprove = authorization.permissions.includes("finance.manage");
  const isCancelled = safeguards.reservation.status === "cancelled";
  const backHref =
    "/workspaces/management/campgrounds/reservations/" +
    encodeURIComponent(reservationId) +
    "?campground=" +
    encodeURIComponent(campgroundId);
  const policyHref =
    "/workspaces/management/campgrounds/refunds?campground=" +
    encodeURIComponent(campgroundId);

  return (
    <AppShell>
      <div className="page-stack">
        <nav className="breadcrumbs" aria-label="Breadcrumb">
          <Link href="/">iCamp</Link>
          <span>/</span>
          <Link href="/workspaces/management">Management</Link>
          <span>/</span>
          <Link href={backHref}>Reservation</Link>
          <span>/</span>
          <span>Financial safeguards</span>
        </nav>

        <section className="hero-panel">
          <p className="eyebrow">Build 045 · Refund safeguards</p>
          <h1>Cancellation, refund & adjustment review</h1>
          <p className="hero-panel__lead">
            Reservation {reservationId} · status{" "}
            <strong>{safeguards.reservation.status}</strong>
          </p>
          <div className="hero-actions">
            <Link className="primary-link" href={policyHref}>
              Cancellation/refund policy
            </Link>
            <Link className="secondary-link" href={backHref}>
              Reservation management
            </Link>
          </div>
        </section>

        {query.saved ? (
          <div className={styles.notice}>{query.saved}</div>
        ) : null}
        {query.error ? (
          <div className={styles.error + " " + styles.notice}>
            {query.error}
          </div>
        ) : null}

        {safeguards.reservation.financialReviewRequired ? (
          <div className={styles.review}>
            <strong>Financial review required.</strong>{" "}
            {safeguards.reservation.financialReviewReason ??
              "A reservation change requires financial reconciliation."}
          </div>
        ) : null}

        <section className="content-panel">
          <SectionHeading
            eyebrow="Policy engine"
            title="Cancellation recommendation"
            id="refund-recommendation"
            helpTopic="campground.structure"
          />
          <p>
            Policy window:{" "}
            <strong>{safeguards.recommendation.policyWindow}</strong> ·{" "}
            {safeguards.recommendation.daysBeforeArrival} days before arrival.
          </p>
          <p>
            Captured and not already reserved/refunded:{" "}
            <strong>
              {formatMoney(
                safeguards.recommendation.capturedRemainingCents,
                safeguards.reservation.currencyCode,
              )}
            </strong>
          </p>
          <p>
            Policy-recommended refund:{" "}
            <strong>
              {formatMoney(
                safeguards.recommendation.recommendedRefundCents,
                safeguards.reservation.currencyCode,
              )}
            </strong>{" "}
            · retained{" "}
            {formatMoney(
              safeguards.recommendation.retainedCents,
              safeguards.reservation.currencyCode,
            )}
            .
          </p>
          <p>
            Approval threshold:{" "}
            {formatMoney(
              safeguards.policy.approvalThresholdCents,
              safeguards.policy.currencyCode,
            )}
            . Refunds above threshold or above the policy recommendation require
            a separate finance approver.
          </p>
        </section>

        <section className="content-panel">
          <SectionHeading
            eyebrow="Original-payment linkage"
            title="Captured payments"
            id="captured-payments"
            helpTopic="shell.overview"
          />
          <div className={styles.history}>
            {safeguards.payments.map((payment: any) => (
              <article key={payment.id}>
                <strong>
                  {payment.paymentPurpose.replaceAll("_", " ")} ·{" "}
                  {formatMoney(payment.amountCents, payment.currencyCode)}
                </strong>
                <p>
                  Refunded/reserved{" "}
                  {formatMoney(
                    payment.reservedRefundCents,
                    payment.currencyCode,
                  )}{" "}
                  · remaining{" "}
                  {formatMoney(
                    payment.remainingRefundableCents,
                    payment.currencyCode,
                  )}{" "}
                  · policy recommendation{" "}
                  {formatMoney(
                    payment.policyRecommendedCents,
                    payment.currencyCode,
                  )}
                </p>

                {mayRefund && payment.remainingRefundableCents > 0 ? (
                  <form action={requestRefundAction} className={styles.formGrid}>
                    <input
                      type="hidden"
                      name="campgroundId"
                      value={campgroundId}
                    />
                    <input
                      type="hidden"
                      name="reservationId"
                      value={reservationId}
                    />
                    <input
                      type="hidden"
                      name="originalPaymentId"
                      value={payment.id}
                    />
                    <input
                      type="hidden"
                      name="idempotencyKey"
                      value={randomUUID()}
                    />
                    <label>
                      Refund amount
                      <input
                        name="refundAmount"
                        inputMode="decimal"
                        defaultValue={(
                          (payment.policyRecommendedCents > 0
                            ? payment.policyRecommendedCents
                            : payment.remainingRefundableCents) / 100
                        ).toFixed(2)}
                        required
                      />
                    </label>
                    <label>
                      Refund kind
                      <select
                        name="refundKind"
                        defaultValue={isCancelled ? "cancellation" : "partial"}
                      >
                        <option value="partial">Partial refund</option>
                        <option value="full">Full original payment refund</option>
                        {isCancelled ? (
                          <option value="cancellation">
                            Cancellation refund
                          </option>
                        ) : null}
                      </select>
                    </label>
                    <label className={styles.full}>
                      Refund reason
                      <textarea
                        name="reason"
                        minLength={3}
                        maxLength={1000}
                        defaultValue={
                          isCancelled
                            ? "Apply cancellation/refund policy."
                            : "Record approved partial/full refund."
                        }
                        required
                      />
                    </label>
                    <button className="primary-button" type="submit">
                      Request refund with safeguards
                    </button>
                  </form>
                ) : null}
              </article>
            ))}
            {safeguards.payments.length === 0 ? (
              <p>No captured Build 042 payments are available to refund.</p>
            ) : null}
          </div>
        </section>

        <section className="content-panel">
          <SectionHeading
            eyebrow="Approval & execution"
            title="Refund requests"
            id="refund-requests"
            helpTopic="shell.overview"
          />
          <div className={styles.history}>
            {safeguards.refunds.map((refund: any) => (
              <article key={refund.id}>
                <strong>
                  {refund.refundKind} ·{" "}
                  {formatMoney(refund.amountCents, refund.currencyCode)}
                </strong>
                <p>
                  Approval <strong>{refund.approvalState}</strong> · provider{" "}
                  <strong>{refund.refundState}</strong> · original payment{" "}
                  {refund.originalPaymentId}
                </p>
                <p>{refund.reason}</p>

                {mayApprove && refund.approvalState === "pending" ? (
                  <div className={styles.actions}>
                    <form action={approveRefundAction}>
                      <input
                        type="hidden"
                        name="campgroundId"
                        value={campgroundId}
                      />
                      <input
                        type="hidden"
                        name="reservationId"
                        value={reservationId}
                      />
                      <input type="hidden" name="refundId" value={refund.id} />
                      <input
                        type="hidden"
                        name="reason"
                        value="Finance approval after policy/threshold review."
                      />
                      <button className="primary-button" type="submit">
                        Approve refund
                      </button>
                    </form>
                    <form action={rejectRefundAction}>
                      <input
                        type="hidden"
                        name="campgroundId"
                        value={campgroundId}
                      />
                      <input
                        type="hidden"
                        name="reservationId"
                        value={reservationId}
                      />
                      <input type="hidden" name="refundId" value={refund.id} />
                      <input
                        type="hidden"
                        name="reason"
                        value="Finance rejected refund after review."
                      />
                      <button className={styles.dangerButton} type="submit">
                        Reject refund
                      </button>
                    </form>
                  </div>
                ) : null}

                {mayRefund && refund.refundState === "approved" ? (
                  <form action={executeRefundAction}>
                    <input
                      type="hidden"
                      name="campgroundId"
                      value={campgroundId}
                    />
                    <input
                      type="hidden"
                      name="reservationId"
                      value={reservationId}
                    />
                    <input type="hidden" name="refundId" value={refund.id} />
                    <button className="primary-button" type="submit">
                      Execute provider refund
                    </button>
                  </form>
                ) : null}
              </article>
            ))}
            {safeguards.refunds.length === 0 ? (
              <p>No refund requests have been recorded.</p>
            ) : null}
          </div>
        </section>

        {mayApprove &&
        isCancelled &&
        safeguards.reservation.financialReviewRequired &&
        safeguards.recommendation.recommendedRefundCents === 0 &&
        safeguards.recommendation.capturedRemainingCents > 0 ? (
          <section className="content-panel">
            <SectionHeading
              eyebrow="Policy forfeit"
              title="Resolve a zero-refund cancellation"
              id="cancellation-forfeit"
              helpTopic="shell.overview"
            />
            <p>
              The current policy recommends no remaining refund. Finance may
              record the retained amount as append-only forfeit evidence and
              close the Build 044 financial-review flag.
            </p>
            <form
              action={recordCancellationForfeitAction}
              className={styles.formGrid}
            >
              <input
                type="hidden"
                name="campgroundId"
                value={campgroundId}
              />
              <input
                type="hidden"
                name="reservationId"
                value={reservationId}
              />
              <input
                type="hidden"
                name="idempotencyKey"
                value={randomUUID()}
              />
              <label className={styles.full}>
                Forfeit/review reason
                <textarea
                  name="reason"
                  minLength={3}
                  maxLength={1000}
                  defaultValue="Apply cancellation policy; no refund remains due."
                  required
                />
              </label>
              <button className={styles.dangerButton} type="submit">
                Record policy forfeit & resolve review
              </button>
            </form>
          </section>
        ) : null}

        {mayApprove ? (
          <section className="content-panel">
            <SectionHeading
              eyebrow="Append-only adjustments"
              title="Record non-refund financial evidence"
              id="financial-adjustment"
              helpTopic="shell.overview"
            />
            <p>
              This records a financial adjustment without editing historical
              quote, payment, receipt or reservation-change evidence.
            </p>
            <form
              action={recordFinancialAdjustmentAction}
              className={styles.formGrid}
            >
              <input
                type="hidden"
                name="campgroundId"
                value={campgroundId}
              />
              <input
                type="hidden"
                name="reservationId"
                value={reservationId}
              />
              <input
                type="hidden"
                name="currencyCode"
                value={safeguards.reservation.currencyCode}
              />
              <input
                type="hidden"
                name="idempotencyKey"
                value={randomUUID()}
              />
              <label>
                Adjustment kind
                <select name="adjustmentKind" defaultValue="credit">
                  <option value="credit">Credit</option>
                  <option value="charge">Charge</option>
                  <option value="forfeit">Forfeit/retained amount</option>
                  <option value="writeoff">Write-off</option>
                </select>
              </label>
              <label>
                Amount
                <input
                  name="adjustmentAmount"
                  inputMode="decimal"
                  defaultValue="0.00"
                  required
                />
              </label>
              <label className={styles.full}>
                Adjustment reason
                <textarea
                  name="reason"
                  minLength={3}
                  maxLength={1000}
                  required
                />
              </label>
              <button className="primary-button" type="submit">
                Record append-only adjustment
              </button>
            </form>
          </section>
        ) : null}

        <section className="content-panel">
          <SectionHeading
            eyebrow="Evidence"
            title="Financial adjustment history"
            id="financial-adjustment-history"
            helpTopic="shell.overview"
          />
          <div className={styles.history}>
            {safeguards.adjustments.map((adjustment: any) => (
              <article key={adjustment.id}>
                <strong>
                  {adjustment.adjustmentKind} ·{" "}
                  {formatMoney(
                    adjustment.amountCents,
                    adjustment.currencyCode,
                  )}
                </strong>
                <p>
                  Effect {adjustment.financialEffect} · {adjustment.reason}
                </p>
                <p className={styles.historyMeta}>
                  {new Date(adjustment.occurredAt).toLocaleString("en-CA")}
                  {adjustment.originalPaymentId
                    ? " · original payment " + adjustment.originalPaymentId
                    : ""}
                </p>
              </article>
            ))}
            {safeguards.adjustments.length === 0 ? (
              <p>No Build 045 financial adjustments have been recorded.</p>
            ) : null}
          </div>
        </section>

        <section className="content-panel">
          <h2>Security & channel contract</h2>
          <p>
            <strong>Web/PWA:</strong> full policy recommendation, partial/full
            refund request, approval, provider execution and adjustment
            evidence.
          </p>
          <p>
            <strong>IVR/DTMF:</strong> verified staff may hear refund status and
            policy outcome; high-risk approval/execution uses staff-assisted or
            secure visual fallback. Raw payment credentials are never accepted.
          </p>
          <p>
            <strong>SMS/MMS:</strong> concise status and secure-link handoff;
            approval and execution cannot be completed by unverified message
            content alone.
          </p>
        </section>
      </div>
    </AppShell>
  );
}
