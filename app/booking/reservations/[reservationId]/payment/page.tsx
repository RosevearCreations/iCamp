import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";

import { AppShell } from "@/components/app-shell";
import { SectionHeading } from "@/components/section-heading";
import { requireSignedIn } from "@/lib/auth/current-session";
import { getReservationPaymentSummary } from "@/lib/payments/postgres.mjs";
import { getPaymentProviderConfig } from "@/lib/payments/provider.mjs";
import { formatMoney } from "@/lib/pricing/core.mjs";

import { completeSandboxPaymentAction } from "./actions";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Reservation payment · iCamp",
  description:
    "Review deposit, security-deposit and balance obligations for an iCamp reservation.",
  robots: { index: false, follow: false },
};

function stageLabel(value: string) {
  if (value === "with_balance") return "with reservation balance";
  if (value === "on_arrival") return "on arrival";
  return "with booking deposit";
}

export default async function ReservationPaymentPage({
  params,
  searchParams,
}: Readonly<{
  params: Promise<{ reservationId: string }>;
  searchParams: Promise<{ payment?: string }>;
}>) {
  const { reservationId } = await params;
  const query = await searchParams;
  const path = `/booking/reservations/${encodeURIComponent(reservationId)}/payment`;
  const session = await requireSignedIn(path);

  if (session.user.accountType !== "guest") {
    redirect("/auth/not-authorized");
  }

  const summary = await getReservationPaymentSummary({
    userId: session.user.id,
    reservationId,
  });
  if (!summary) notFound();

  const config = getPaymentProviderConfig();
  const { schedule, progress } = summary;
  const pendingHref =
    `/booking/reservations/${encodeURIComponent(reservationId)}/pending`;

  return (
    <AppShell>
      <div className="page-stack">
        <nav className="breadcrumbs" aria-label="Breadcrumb">
          <Link href="/">iCamp</Link>
          <span>/</span>
          <Link href={pendingHref}>Pending reservation</Link>
          <span>/</span>
          <span>Payment</span>
        </nav>

        <section className="hero-panel">
          <p className="eyebrow">Build 042 · Deposits & balances</p>
          <h1>Reservation payment</h1>
          <p className="hero-panel__lead">
            {summary.reservation.accommodationCode} ·{" "}
            {summary.reservation.accommodationName}
          </p>
          <p>
            Provider: <strong>{config.provider}</strong> ·{" "}
            {config.mode === "sandbox" ? "sandbox mode" : "external mode"}
          </p>
        </section>

        {query.payment ? (
          <section className="content-panel">
            <strong>{query.payment}</strong>
          </section>
        ) : null}

        <section className="content-panel">
          <SectionHeading
            eyebrow="Accepted Build 041 quote"
            title="Payment schedule"
            id="payment-schedule"
            helpTopic="shell.overview"
          />
          <p>
            Reservation total:{" "}
            <strong>
              {formatMoney(
                schedule.reservationTotalCents,
                schedule.currencyCode,
              )}
            </strong>
          </p>
          <p>
            Booking deposit:{" "}
            {formatMoney(schedule.bookingDepositCents, schedule.currencyCode)}
          </p>
          <p>
            Remaining reservation balance:{" "}
            {formatMoney(
              schedule.reservationBalanceCents,
              schedule.currencyCode,
            )}{" "}
            · due {schedule.balanceDueDate}
          </p>
          <p>
            Security deposit:{" "}
            {formatMoney(schedule.securityDepositCents, schedule.currencyCode)}{" "}
            · {stageLabel(schedule.securityDepositDueStage)}
          </p>
          <p>
            Total including security deposit:{" "}
            <strong>
              {formatMoney(schedule.totalPayableCents, schedule.currencyCode)}
            </strong>
          </p>
        </section>

        <section className="content-panel">
          <SectionHeading
            eyebrow="Current obligation"
            title="Amount due now"
            id="amount-due"
            helpTopic="shell.overview"
          />
          <p>
            Captured:{" "}
            {formatMoney(progress.capturedCents, schedule.currencyCode)}
          </p>
          <p>
            Due now:{" "}
            <strong>
              {formatMoney(progress.dueNowCents, schedule.currencyCode)}
            </strong>
          </p>
          <p>
            Total outstanding:{" "}
            {formatMoney(progress.outstandingCents, schedule.currencyCode)}
          </p>

          {progress.dueNowCents > 0 && config.mode === "sandbox" ? (
            <form action={completeSandboxPaymentAction}>
              <input type="hidden" name="reservationId" value={reservationId} />
              <button className="primary-button" type="submit">
                Complete sandbox payment
              </button>
            </form>
          ) : progress.dueNowCents === 0 ? (
            <p>
              <strong>Current payment obligation is satisfied.</strong>{" "}
              Remaining balance rules continue to use the immutable schedule.
            </p>
          ) : (
            <p>
              The configured external provider adapter must complete payment
              outside iCamp. Raw card numbers and CVV values are never accepted
              by this page.
            </p>
          )}
        </section>

        <section className="content-panel">
          <h2>Provider safety & channel parity</h2>
          <p>
            <strong>Web/PWA:</strong> the free sandbox adapter exercises the
            same idempotent payment-attempt and verified provider-event path
            used by a future live adapter.
          </p>
          <p>
            <strong>IVR/DTMF:</strong> callers may hear deposit/balance status,
            but iCamp never collects raw card numbers, CVV values or full
            payment credentials through keypad input.
          </p>
          <p>
            <strong>SMS/MMS:</strong> messages may provide concise payment
            status and a secure-link handoff. Raw card data is never requested
            or accepted by SMS/MMS.
          </p>
          <p>
            Build 043 owns confirmation numbers, receipts, invoices and
            reservation documents after this payment boundary.
          </p>
          <Link href={pendingHref}>Return to pending reservation →</Link>
        </section>
      </div>
    </AppShell>
  );
}
