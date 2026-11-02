import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";

import { AppShell } from "@/components/app-shell";
import { SectionHeading } from "@/components/section-heading";
import { requireSignedIn } from "@/lib/auth/current-session";
import {
  bookingDraftDetailHref,
  compareBookingDraftToLive,
} from "@/lib/booking-drafts/core.mjs";
import { getOwnBookingDraft } from "@/lib/booking-drafts/postgres.mjs";
import { getPublicAccommodationDetail } from "@/lib/public-accommodation-detail/postgres.mjs";

import { QuoteSummary } from "@/app/booking/accommodations/[accommodationId]/quote-summary";
import { deleteBookingDraftAction } from "../actions";

export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "Recheck booking draft · iCamp",
  description:
    "Recover saved selections while checking current inventory, pricing and rules.",
  robots: { index: false },
};

export default async function ResumeBookingDraftPage({
  params,
  searchParams,
}: Readonly<{
  params: Promise<{ draftId: string }>;
  searchParams: Promise<{ saved?: string }>;
}>) {
  if (!process.env.DATABASE_URL?.trim()) {
    return (
      <AppShell>
        <section className="content-panel" role="status">
          <h1>Draft recovery currently unavailable</h1>
          <p>
            Storage and live availability are not connected. No draft or
            reservation was recovered.
          </p>
          <Link href="/guest/booking-drafts">My booking drafts</Link>
        </section>
      </AppShell>
    );
  }
  const { draftId } = await params;
  if (!/^[0-9a-f-]{36}$/iu.test(draftId)) notFound();
  const session = await requireSignedIn(`/guest/booking-drafts/${draftId}`);
  if (session.user.accountType !== "guest") redirect("/auth/not-authorized");
  const draft = await getOwnBookingDraft({ userId: session.user.id, draftId });
  if (!draft) notFound();

  let detail = null;
  try {
    detail = await getPublicAccommodationDetail({
      campgroundSlug: draft.campgroundSlug,
      accommodationId: draft.accommodationId,
      arrivalDate: draft.arrivalDate,
      departureDate: draft.departureDate,
      selections: draft.selections,
    });
  } catch {
    detail = null;
  }
  const freshness = compareBookingDraftToLive(draft, detail);
  const query = await searchParams;

  return (
    <AppShell>
      <div className="page-stack">
        <nav className="breadcrumbs" aria-label="Breadcrumb">
          <Link href="/guest/booking-drafts">My booking drafts</Link>
          <span>/</span>
          <span>Live recheck</span>
        </nav>
        <section className="hero-panel">
          <p className="eyebrow">Build 175 · Account-owned recovery</p>
          <h1>
            {draft.accommodationCode} · {draft.accommodationName}
          </h1>
          <p className="hero-panel__lead">
            {draft.campgroundName} · {draft.arrivalDate} to{" "}
            {draft.departureDate}
          </p>
        </section>
        <section className="content-panel">
          <SectionHeading
            eyebrow="Fresh source readback · no auto-checkout"
            title="Recheck before continuing"
            id="draft-recheck-heading"
            helpTopic="shell.overview"
          />
          {query.saved === "1" ? (
            <p role="status">
              Your selections were saved to your guest account with your
              consent.
            </p>
          ) : null}
          {freshness.status === "current" ? (
            <p role="status">
              The saved estimate and availability revision match the latest
              server recheck. Pricing can still change before checkout.
            </p>
          ) : freshness.status === "changed" ? (
            <p role="status">
              The price or availability revision changed since you saved. Review
              the new estimate and terms before continuing.
            </p>
          ) : (
            <p role="alert">
              The saved stay cannot be confirmed against current availability
              and rates. Do not rely on its earlier estimate; choose new dates
              or ask the office.
            </p>
          )}
          <p>
            Saved at{" "}
            {new Date(draft.consentedAt).toLocaleString("en-CA", {
              dateStyle: "medium",
              timeStyle: "short",
              timeZone: "UTC",
            })}{" "}
            UTC. Expires{" "}
            {new Date(draft.expiresAt).toLocaleString("en-CA", {
              dateStyle: "medium",
              timeStyle: "short",
              timeZone: "UTC",
            })}{" "}
            UTC.
          </p>
          {draft.selections.length > 0 ? (
            <p>
              Saved extras:{" "}
              {draft.selections
                .map(
                  (extra: { code: string; quantity: number }) =>
                    `${extra.code} × ${extra.quantity}`,
                )
                .join(", ")}
              . Current eligibility is rechecked by the server.
            </p>
          ) : (
            <p>No optional extras were saved.</p>
          )}
          {detail?.selectionError ? (
            <p role="alert">
              A saved add-on is no longer eligible. Reprice without it before
              proceeding.
            </p>
          ) : null}
          {detail ? <QuoteSummary quote={detail.quotePreview} /> : null}
          <p>
            <Link href={bookingDraftDetailHref(draft)}>
              {freshness.status === "unavailable"
                ? "Review dates and options"
                : "Review the live quote and choose whether to check out"}
            </Link>
          </p>
          <form action={deleteBookingDraftAction}>
            <input type="hidden" name="draftId" value={draft.id} />
            <button type="submit" className="secondary-button">
              Delete my draft now
            </button>
          </form>
          <p>
            Rechecking a draft never creates a temporary hold, reservation,
            payment or outbound message. Any checkout is a separate explicit
            action that verifies inventory and charges again.
          </p>
        </section>
      </div>
    </AppShell>
  );
}
