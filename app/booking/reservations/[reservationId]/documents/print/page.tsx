import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";

import { PrintButton } from "@/components/print-button";
import { requireSignedIn } from "@/lib/auth/current-session";
import { formatMoney } from "@/lib/pricing/core.mjs";
import { getReservationDocumentBundle } from "@/lib/reservation-documents/postgres.mjs";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Print reservation · iCamp",
  robots: { index: false, follow: false },
};

export default async function PrintableReservationPage({
  params,
}: Readonly<{
  params: Promise<{ reservationId: string }>;
}>) {
  const { reservationId } = await params;
  const path = `/booking/reservations/${encodeURIComponent(reservationId)}/documents/print`;
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

  return (
    <main className="print-document">
      <div className="print-document__controls">
        <PrintButton />
      </div>

      <header>
        <p>iCamp reservation confirmation</p>
        <h1>{bundle.confirmation.number}</h1>
        <p>{bundle.reservation.campgroundName}</p>
      </header>

      <section>
        <h2>Stay</h2>
        <p>
          {bundle.reservation.accommodationCode} ·{" "}
          {bundle.reservation.accommodationName}
        </p>
        <p>
          {bundle.reservation.arrivalDate} to {bundle.reservation.departureDate}
        </p>
        <p>
          Guest: {bundle.guest.name} · {bundle.guest.email}
        </p>
      </section>

      <section>
        <h2>Invoice {bundle.invoice.number}</h2>
        <p>
          Reservation:{" "}
          {formatMoney(
            bundle.invoice.reservationAmountCents,
            bundle.invoice.currencyCode,
          )}
        </p>
        <p>
          Refundable security deposit:{" "}
          {formatMoney(
            bundle.invoice.securityDepositCents,
            bundle.invoice.currencyCode,
          )}
        </p>
        <p>
          Total payable:{" "}
          {formatMoney(
            bundle.invoice.totalPayableCents,
            bundle.invoice.currencyCode,
          )}
        </p>
        <p>Balance due date: {bundle.payment.balanceDueDate}</p>
      </section>

      <section>
        <h2>Receipts</h2>
        {bundle.receipts.length === 0 ? (
          <p>No captured-payment receipt is required yet.</p>
        ) : (
          <ul>
            {bundle.receipts.map((receipt) => (
              <li key={receipt.id}>
                {receipt.number} ·{" "}
                {formatMoney(receipt.amountCents, receipt.currencyCode)} ·{" "}
                {receipt.paymentPurpose.replaceAll("_", " ")}
              </li>
            ))}
          </ul>
        )}
      </section>

      <footer>
        <p>
          This printable view reflects immutable Build 041 quote evidence, Build
          042 payment schedule evidence and Build 043 document records.
        </p>
      </footer>
    </main>
  );
}
