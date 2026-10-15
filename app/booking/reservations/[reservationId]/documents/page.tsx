import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";

import { AppShell } from "@/components/app-shell";
import { SectionHeading } from "@/components/section-heading";
import { requireSignedIn } from "@/lib/auth/current-session";
import { formatMoney } from "@/lib/pricing/core.mjs";
import { getReservationDocumentBundle } from "@/lib/reservation-documents/postgres.mjs";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Reservation documents · iCamp",
  description:
    "View reservation confirmation, invoice, receipts and printable documents.",
  robots: { index: false, follow: false },
};

function emailLabel(state: string) {
  if (state === "delivered") return "Delivered by the configured sandbox/provider.";
  if (state === "queued") return "Queued for the configured email provider.";
  if (state === "failed") return "Delivery failed; the in-app copy remains available.";
  return "Email has not been queued.";
}

export default async function ReservationDocumentsPage({
  params,
  searchParams,
}: Readonly<{
  params: Promise<{ reservationId: string }>;
  searchParams: Promise<{ payment?: string }>;
}>) {
  const { reservationId } = await params;
  const query = await searchParams;
  const path = `/booking/reservations/${encodeURIComponent(reservationId)}/documents`;
  const session = await requireSignedIn(path);

  if (session.user.accountType !== "guest") {
    redirect("/auth/not-authorized");
  }

  const bundle = await getReservationDocumentBundle({
    userId: session.user.id,
    reservationId,
  });
  if (!bundle) notFound();
  if (!bundle.confirmation || !bundle.invoice) {
    redirect(
      `/booking/reservations/${encodeURIComponent(reservationId)}/payment`,
    );
  }

  const printHref = path + "/print";
  const paymentHref =
    `/booking/reservations/${encodeURIComponent(reservationId)}/payment`;

  return (
    <AppShell>
      <div className="page-stack">
        <nav className="breadcrumbs" aria-label="Breadcrumb">
          <Link href="/">iCamp</Link>
          <span>/</span>
          <Link href={paymentHref}>Reservation payment</Link>
          <span>/</span>
          <span>Documents</span>
        </nav>

        <section className="hero-panel">
          <p className="eyebrow">Build 043 · Confirmed reservation</p>
          <h1>Confirmation {bundle.confirmation.number}</h1>
          <p className="hero-panel__lead">
            {bundle.reservation.campgroundName} ·{" "}
            {bundle.reservation.accommodationCode} ·{" "}
            {bundle.reservation.accommodationName}
          </p>
          <p>
            {bundle.reservation.arrivalDate} to{" "}
            {bundle.reservation.departureDate}
          </p>
          <div className="hero-actions">
            <Link className="primary-link" href={printHref}>
              Printable view
            </Link>
            <Link className="secondary-link" href={paymentHref}>
              Payment details
            </Link>
          </div>
        </section>

        {query.payment ? (
          <section className="content-panel">
            <strong>{query.payment}</strong>
          </section>
        ) : null}

        <section className="content-panel">
          <SectionHeading
            eyebrow="In-app confirmation"
            title="Reservation confirmed"
            id="confirmation"
            helpTopic="shell.overview"
          />
          <p>
            Confirmation number: <strong>{bundle.confirmation.number}</strong>
          </p>
          <p>
            Guest: <strong>{bundle.guest.name}</strong> · {bundle.guest.email}
          </p>
          <p>
            Party: {bundle.guest.occupants} occupants · {bundle.guest.visitors}{" "}
            visitors · {bundle.guest.pets} pets · {bundle.guest.vehicles} vehicles.
          </p>
          <p>
            Transactional email: <strong>{bundle.email.state}</strong>.{" "}
            {emailLabel(bundle.email.state)}
          </p>
        </section>

        <section className="content-panel">
          <SectionHeading
            eyebrow="Invoice"
            title={bundle.invoice.number}
            id="invoice"
            helpTopic="shell.overview"
          />
          <p>
            Accepted reservation quote:{" "}
            <strong>
              {formatMoney(
                bundle.invoice.reservationAmountCents,
                bundle.invoice.currencyCode,
              )}
            </strong>
          </p>
          <p>
            Refundable security deposit:{" "}
            {formatMoney(
              bundle.invoice.securityDepositCents,
              bundle.invoice.currencyCode,
            )}
          </p>
          <p>
            Total payable including security deposit:{" "}
            <strong>
              {formatMoney(
                bundle.invoice.totalPayableCents,
                bundle.invoice.currencyCode,
              )}
            </strong>
          </p>
          <p>
            Balance due date: <strong>{bundle.payment.balanceDueDate}</strong>
          </p>
        </section>

        <section className="content-panel">
          <SectionHeading
            eyebrow="Receipts"
            title="Captured payment evidence"
            id="receipts"
            helpTopic="shell.overview"
          />
          {bundle.receipts.length === 0 ? (
            <p>No captured-payment receipt is required yet.</p>
          ) : (
            <div className="document-list">
              {bundle.receipts.map((receipt) => (
                <article className="document-card" key={receipt.id}>
                  <strong>{receipt.number}</strong>
                  <span>{receipt.paymentPurpose.replaceAll("_", " ")}</span>
                  <span>
                    {formatMoney(receipt.amountCents, receipt.currencyCode)}
                  </span>
                </article>
              ))}
            </div>
          )}
        </section>

        <section className="content-panel">
          <h2>Document integrity & channel parity</h2>
          <p>
            The confirmation, invoice and receipts are immutable evidence
            derived from the accepted Build 041 quote and immutable Build 042
            payment schedule. Later balance payments add receipts; they do not
            rewrite prior documents.
          </p>
          <p>
            <strong>IVR/DTMF:</strong> confirmation number, dates and concise
            balance state may be spoken; document review uses secure-link or
            staff-assisted fallback.
          </p>
          <p>
            <strong>SMS/MMS:</strong> confirmation number and secure-link
            handoff may be sent without embedding sensitive document contents.
          </p>
        </section>
      </div>
    </AppShell>
  );
}
