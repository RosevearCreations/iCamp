import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";

import { AppShell } from "@/components/app-shell";
import { SectionHeading } from "@/components/section-heading";
import { requireSignedIn } from "@/lib/auth/current-session";
import { formatMoney } from "@/lib/pricing/core.mjs";
import { getPendingReservationCheckout } from "@/lib/reservation-checkout/postgres.mjs";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Pending reservation · iCamp",
  description:
    "Review the pending iCamp reservation and accepted server-authoritative quote.",
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

  if (!reservation) notFound();

  const mapHref =
    `/booking/map?campground=${encodeURIComponent(reservation.campground.slug)}` +
    `&arrivalDate=${encodeURIComponent(reservation.dates.arrivalDate)}` +
    `&departureDate=${encodeURIComponent(reservation.dates.departureDate)}`;

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
          <p className="eyebrow">Build 041 · Reservation checkout accepted</p>
          <h1>Pending reservation created</h1>
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
            title="Pending payment"
            id="pending-status"
            helpTopic="shell.overview"
          />
          <p>
            The temporary hold was revalidated and converted into reservation{" "}
            <strong>{reservation.id}</strong>.
          </p>
          <p>
            <strong>No payment has been taken.</strong> Build 042 owns deposits,
            balances, payment-provider processing and verified payment events.
          </p>
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
          <p>
            This quote is the immutable checkout snapshot accepted when the
            pending reservation was created. Build 042 will use this reservation
            as its payment/deposit boundary.
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
            <strong>Web/PWA:</strong> this pending-reservation view shows the
            same accepted quote and reservation state saved by checkout.
          </p>
          <p>
            <strong>IVR/DTMF:</strong> concise reservation status and total can
            be read from the same canonical reservation; payment remains a later
            provider-safe flow.
          </p>
          <p>
            <strong>SMS/MMS:</strong> concise pending status and a secure-link
            handoff can reference this same reservation. Raw payment-card data
            is never requested by SMS.
          </p>
          <p>
            <Link href={mapHref}>Return to the live booking map →</Link>
          </p>
        </section>
      </div>
    </AppShell>
  );
}
