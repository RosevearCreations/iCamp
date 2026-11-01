import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { AppShell } from "@/components/app-shell";
import { getPublicAccommodationDetail } from "@/lib/public-accommodation-detail/postgres.mjs";
import { parsePublicQuoteSelections } from "@/lib/public-accommodation-detail/quote-preview.mjs";

import { QuotePrintButton } from "../../quote-freshness";
import { QuoteSummary } from "../../quote-summary";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Printable current booking quote · iCamp",
  description:
    "Current server-priced campground stay, fee, deposit and policy summary.",
  robots: { index: false, follow: false },
};

export default async function PublicQuotePrintPage({
  params,
  searchParams,
}: Readonly<{
  params: Promise<{ accommodationId: string }>;
  searchParams: Promise<Record<string, string | undefined>>;
}>) {
  const [{ accommodationId }, query] = await Promise.all([
    params,
    searchParams,
  ]);
  const campgroundSlug = query.campground ?? "";
  const arrivalDate = query.arrivalDate ?? "";
  const departureDate = query.departureDate ?? "";
  let selections: Array<{ code: string; quantity: number }> = [];
  try {
    selections = parsePublicQuoteSelections(query);
  } catch {
    notFound();
  }

  if (!process.env.DATABASE_URL?.trim()) {
    return (
      <AppShell>
        <section className="content-panel" role="status">
          <h1>Live printable quote unavailable</h1>
          <p>
            The database source is not connected. No price, quote or payment was
            created. Ask the campground office for current costs and terms.
          </p>
          <Link href="/booking/map">Return to booking discovery</Link>
        </section>
      </AppShell>
    );
  }

  const detail = await getPublicAccommodationDetail({
    campgroundSlug,
    accommodationId,
    arrivalDate,
    departureDate,
    selections,
  });
  if (!detail) notFound();

  return (
    <AppShell>
      <div className="page-stack">
        <nav className="breadcrumbs" aria-label="Breadcrumb">
          <Link href="/booking/map">Booking discovery</Link>
          <span>/</span>
          <span>Printable quote</span>
        </nav>
        <section className="hero-panel">
          <p className="eyebrow">Build 174 · Public / office / print</p>
          <h1>Current booking price and policy preview</h1>
          <p className="hero-panel__lead">
            {detail.campground.name} · {detail.accommodation.code} ·{" "}
            {detail.accommodation.displayName}
          </p>
          <p>
            Printed copies are snapshots only. This route re-fetches current
            prices, policies and availability on each visit; it does not honor a
            previous expired amount.
          </p>
          <QuotePrintButton />
        </section>
        <section className="content-panel">
          <h2>Live booking status: {detail.availability.label}</h2>
          <p>
            {detail.availability.selectable
              ? "Selectable when this snapshot was generated. Availability can change."
              : "Not selectable for these dates; do not treat this quote as an available booking."}
          </p>
          {detail.selectionError ? (
            <p role="alert">{detail.selectionError}</p>
          ) : null}
          <QuoteSummary quote={detail.quotePreview} printMode />
        </section>
        <section className="content-panel">
          <h2>Other campground rules</h2>
          <dl>
            {detail.rules.map((rule) => (
              <div key={rule.label}>
                <dt>
                  <strong>{rule.label}</strong>
                </dt>
                <dd>{rule.value}</dd>
              </div>
            ))}
          </dl>
        </section>
      </div>
    </AppShell>
  );
}
