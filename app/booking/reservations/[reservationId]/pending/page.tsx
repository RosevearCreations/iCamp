import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";

import { AppShell } from "@/components/app-shell";
import { SectionHeading } from "@/components/section-heading";
import { requireSignedIn } from "@/lib/auth/current-session";
import { getReservationPaymentSummary } from "@/lib/payments/postgres.mjs";
import { formatMoney } from "@/lib/pricing/core.mjs";
import { getPendingReservationCheckout } from "@/lib/reservation-checkout/postgres.mjs";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Pending reservation · iCamp",
  description:
    "Review the pending iCamp reservation, accepted quote and payment state.",
  robots: { index: false, follow: false },
};

export default async function PendingReservationPage({
  params,
}: Readonly<{
  params: Promise<{ reservationId: string }>;
}>) {
  const { reservationId } = await params;
  const returnPath = `/booking/reservations/${encodeURIComponent(reservationId)}/pending`;
  const session = await requireSignedIn(returnPath);

  if (session.user.accountType !== "guest") {
    redirect("/auth/not-authorized");
  }

  const reservation = await getPendingReservationCheckout({
    userId: session.user.id,
    reservationId,
  });
  const payment = await getReservationPaymentSummary({
    userId: session.user.id,
    reservationId,
  });

  if (!reservation || !payment) notFound();

  const mapHref =
    `/booking/map?campground=${encodeURIComponent(reservation.campground.slug)}` +
    `&arrivalDate=${encodeURIComponent(reservation.dates.arrivalDate)}` +
    `&departureDate=${encodeURIComponent(reservation.dates.departureDate)}`;
  const paymentHref = `/booking/reservations/${encodeURIComponent(reservationId)}/payment`;

  return (
    <AppShell>
      <div className="page-stack">
        <nav className="breadcrumbs" aria-label="Breadcrumb">
          <Link href="/">iCamp</Link>
          <span>/</span>
          <Link href={mapHref}>Booking map</Link>
          <span>/</span>
          <span>Pending reservation</span>
        </nav>

        <section className="hero-panel">
          <p className="eyebrow">Build 041–042 · Reservation & payment</p>
          <h1>Pending reservation</h1>
          <p className="hero-panel__lead">
            {reservation.accommodation.code} ·{" "}
            {reservation.accommodation.displayName}
          </p>
          <p>
            {reservation.dates.arrivalDate} to {reservation.dates.departureDate}
          </p>
        </section>

        <section className="content-panel">
          <SectionHeading
            eyebrow="Reservation status"
            title="Pending payment & confirmation"
            id="pending-status"
            helpTopic="shell.overview"
          />
          <p>
            Reservation <strong>{reservation.id}</strong> was created from a
            revalidated temporary hold.
          </p>
          <p>
            Captured payment:{" "}
            <strong>
              {formatMoney(
                payment.progress.capturedCents,
                payment.schedule.currencyCode,
              )}
            </strong>{" "}
            · due now{" "}
            {formatMoney(
              payment.progress.dueNowCents,
              payment.schedule.currencyCode,
            )}
            .
          </p>
          <p>
            Build 043 owns confirmation numbers, receipts and reservation
            documents after the payment boundary.
          </p>
          <Link className="primary-link primary-link--dark" href={paymentHref}>
            Review deposit, balance & payment →
          </Link>
        </section>

        <section className="content-panel">
          <SectionHeading
            eyebrow="Accepted final quote"
            title="Server-authoritative total"
            id="pending-quote"
            helpTopic="shell.overview"
          />
          <p>
            Accommodation:{" "}
            {formatMoney(
              reservation.quote.staySubtotalCents,
              reservation.quote.currencyCode,
            )}
          </p>
          <p>
            Add-ons, passes & service fees:{" "}
            {formatMoney(
              reservation.quote.chargeTotalCents,
              reservation.quote.currencyCode,
            )}
          </p>
          <p>
            <strong>
              Total:{" "}
              {formatMoney(
                reservation.quote.totalCents,
                reservation.quote.currencyCode,
              )}
            </strong>
          </p>
          <p>No payment has been taken by the Build 041 checkout itself.</p>
          <p>
            The accepted Build 041 quote remains immutable. Build 042 snapshots
            deposit, security-deposit and balance rules separately without
            rewriting this checkout evidence.
          </p>
        </section>

        <section className="content-panel">
          <SectionHeading
            eyebrow="Reservation details"
            title="Guest & party"
            id="pending-party"
            helpTopic="shell.overview"
          />
          <p>
            <strong>Primary contact:</strong> {reservation.contact.name} ·{" "}
            {reservation.contact.email}
          </p>
          <p>
            Occupants {reservation.party.occupants} · Visitors{" "}
            {reservation.party.visitors} · Pets {reservation.party.pets} ·
            Vehicles {reservation.party.vehicles}
          </p>
          <p>
            Booking rules acknowledged{" "}
            {new Date(reservation.rulesAcknowledgedAt).toLocaleString("en-CA")}.
          </p>
        </section>

        <section className="content-panel">
          <h2>Channel contract</h2>
          <p>
            <strong>Web/PWA:</strong> this view reads the same reservation,
            immutable quote and payment schedule used by the payment page.
          </p>
          <p>
            <strong>IVR/DTMF:</strong> concise reservation, deposit and balance
            status may be read from the same authority. Raw card credentials are
            never collected by keypad.
          </p>
          <p>
            <strong>SMS/MMS:</strong> concise status and a secure-link handoff
            may reference this reservation. Raw payment-card data is never
            requested by SMS.
          </p>
          <p>
            <Link href={mapHref}>Return to the live booking map →</Link>
          </p>
        </section>
      </div>
    </AppShell>
  );
}
