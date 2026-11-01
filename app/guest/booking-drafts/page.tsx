import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";

import { AppShell } from "@/components/app-shell";
import { SectionHeading } from "@/components/section-heading";
import { requireSignedIn } from "@/lib/auth/current-session";
import { listOwnBookingDrafts } from "@/lib/booking-drafts/postgres.mjs";

import { deleteBookingDraftAction } from "./actions";

export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "My booking drafts · iCamp",
  description:
    "Resume or delete your consented, time-limited campsite and cottage selections.",
  robots: { index: false },
};

export default async function GuestBookingDraftsPage({
  searchParams,
}: Readonly<{
  searchParams: Promise<{ deleted?: string }>;
}>) {
  if (!process.env.DATABASE_URL?.trim()) {
    return (
      <AppShell>
        <section className="content-panel" role="status">
          <h1>Booking draft recovery unavailable</h1>
          <p>
            Live draft storage is not connected. Nothing has been saved or
            recovered. Please contact the campground office for assistance.
          </p>
          <Link href="/booking/map">Browse available stays</Link>
        </section>
      </AppShell>
    );
  }
  const session = await requireSignedIn("/guest/booking-drafts");
  if (session.user.accountType !== "guest") redirect("/auth/not-authorized");
  const params = await searchParams;
  let drafts = [] as Awaited<ReturnType<typeof listOwnBookingDrafts>>;
  let unavailable = false;
  try {
    drafts = await listOwnBookingDrafts({ userId: session.user.id });
  } catch {
    unavailable = true;
  }

  return (
    <AppShell>
      <div className="page-stack">
        <section className="hero-panel">
          <p className="eyebrow">Build 175 · Signed-in cross-device recovery</p>
          <h1>My booking drafts</h1>
          <p className="hero-panel__lead">
            Resume your saved dates and optional extras from any device after
            signing into the same guest account. Drafts expire seven days after
            they are saved or deliberately changed.
          </p>
        </section>
        <section className="content-panel">
          <SectionHeading
            eyebrow="Private · consented · time-limited"
            title="Saved selections"
            id="drafts-heading"
            helpTopic="shell.overview"
          />
          {params.deleted === "1" ? (
            <p role="status">The draft was removed from your account.</p>
          ) : null}
          {params.deleted === "0" ? (
            <p role="alert">
              We could not remove that draft. Please try again.
            </p>
          ) : null}
          {unavailable ? (
            <p role="alert">
              Saved drafts cannot be loaded right now. No reservation or payment
              was created.
            </p>
          ) : drafts.length === 0 ? (
            <p>
              No active booking drafts. Explore a campsite or cottage to save
              one with your consent.
            </p>
          ) : (
            <ul>
              {drafts.map((draft) => (
                <li key={draft.id}>
                  <p>
                    <strong>
                      {draft.accommodationCode} · {draft.accommodationName}
                    </strong>
                    {` · ${draft.campgroundName}`}
                  </p>
                  <p>
                    {draft.arrivalDate} to {draft.departureDate} · expires{" "}
                    {new Date(draft.expiresAt).toLocaleString("en-CA", {
                      dateStyle: "medium",
                      timeStyle: "short",
                      timeZone: "UTC",
                    })}{" "}
                    UTC
                  </p>
                  <p>
                    <Link href={`/guest/booking-drafts/${draft.id}`}>
                      Recheck and resume this draft
                    </Link>
                  </p>
                  <form action={deleteBookingDraftAction}>
                    <input type="hidden" name="draftId" value={draft.id} />
                    <button
                      type="submit"
                      className="secondary-button"
                      aria-label={`Delete draft for ${draft.accommodationCode}`}
                    >
                      Delete this draft
                    </button>
                  </form>
                </li>
              ))}
            </ul>
          )}
          <p>
            A draft is not a reservation, price guarantee, inventory hold,
            payment or outbound message. Reopening always checks current
            campground data before you choose to continue.
          </p>
          <Link href="/booking/map">Find another stay</Link>
        </section>
        <section className="content-panel">
          <h2>Staff-assisted and held channels</h2>
          <p>
            You may ask the office to review a current booking quote. Billing,
            IVR/DTMF and SMS/MMS automation remain HELD / DISCONNECTED; iCamp
            does not send draft links or initiate charges.
          </p>
        </section>
      </div>
    </AppShell>
  );
}
