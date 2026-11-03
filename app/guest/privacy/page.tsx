import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";

import { AppShell } from "@/components/app-shell";
import { SectionHeading } from "@/components/section-heading";
import { requireSignedIn } from "@/lib/auth/current-session";
import { listOwnGuestProfileScopes } from "@/lib/guest-profile/postgres.mjs";
import { listOwnGuestPrivacy } from "@/lib/guest-privacy/postgres.mjs";
import { submitPrivacyRequestAction } from "./actions";

import styles from "../../workspaces/management/campgrounds/reservations/reservations.module.css";

export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "My privacy & information requests · iCamp",
  description:
    "Review saved-stay consent history and request a scoped privacy review.",
  robots: { index: false, follow: false },
};

const kinds = [
  ["access", "Access or full data review"],
  ["correction", "Correct a record"],
  ["retention_review", "Review retention"],
  ["erasure_review", "Review possible erasure"],
  ["consent_question", "Ask about consent"],
] as const;

export default async function GuestPrivacyPage({
  searchParams,
}: {
  searchParams: Promise<{
    campground?: string;
    saved?: string;
    error?: string;
  }>;
}) {
  const path = "/guest/privacy";
  const session = await requireSignedIn(path);
  if (session.user.accountType !== "guest") redirect("/auth/not-authorized");
  const params = await searchParams;
  const scopes = await listOwnGuestProfileScopes({ userId: session.user.id });
  const selected =
    scopes.find((s) => s.campgroundId === params.campground) ?? scopes[0];
  const workspace = selected
    ? await listOwnGuestPrivacy({
        userId: session.user.id,
        campgroundId: selected.campgroundId,
      })
    : null;

  return (
    <AppShell>
      <div className="page-stack">
        <nav className="breadcrumbs" aria-label="Breadcrumb">
          <Link href="/auth/account">Account</Link>
          <span>/</span>
          <span>Privacy requests</span>
        </nav>
        <section className="hero-panel">
          <p className="eyebrow">Build 197 · Guest data stewardship</p>
          <h1>My privacy, consent & information</h1>
          <p className="hero-panel__lead">
            Review consent history linked to your campground account, request
            corrections or access, and download a private copy of available
            account-linked stay data. Requests go to a human review queue; they
            never erase a booking or financial record automatically.
          </p>
          <div className="hero-actions">
            <Link className="secondary-link" href="/guest/profile">
              Saved profile & privacy switches
            </Link>
            <Link className="secondary-link" href="/auth/account">
              Account
            </Link>
          </div>
        </section>
        {!selected ? (
          <section className="content-panel">
            <p>
              There is no campground linked to this guest account yet. After a
              booking or saved profile is linked, its privacy desk will appear
              here.
            </p>
          </section>
        ) : (
          <>
            {params.saved ? (
              <p className={styles.notice} role="status">
                Request submitted and added to the campground review queue.
              </p>
            ) : null}
            {params.error ? (
              <p className={styles.notice + " " + styles.error} role="alert">
                The request was not submitted. Check the selection, or review
                whether an identical request was already submitted within 24
                hours.
              </p>
            ) : null}
            <section className="content-panel">
              <SectionHeading
                eyebrow="Your campground"
                title={selected.campgroundName}
                id="privacy-campground"
                helpTopic="guest.privacy"
              />
              <form method="get" className={styles.inlineForm}>
                <label>
                  Campground
                  <select
                    name="campground"
                    defaultValue={selected.campgroundId}
                  >
                    {scopes.map((s) => (
                      <option value={s.campgroundId} key={s.campgroundId}>
                        {s.campgroundName}
                      </option>
                    ))}
                  </select>
                </label>
                <button type="submit" className="secondary-button">
                  Switch
                </button>
              </form>
              <p>
                <strong>Retention:</strong> No automatic deletion is scheduled.
                A staff reviewer must check reservation, financial, safety,
                recordkeeping and other applicable requirements before any
                erasure or disposition. The app does not set a legal retention
                deadline.
              </p>
              <p>
                <a
                  className="secondary-link"
                  href={`/api/guest/privacy/export?campground=${encodeURIComponent(selected.campgroundId)}`}
                >
                  Download my information (JSON)
                </a>
              </p>
              <p className="small-copy">
                Private attachment · never public · includes currently
                accessible saved profile, available account-linked
                reservation/receipt history and consent review evidence. Each
                source is capped at 100 records; check the completeness flag in
                the file. For a full untruncated copy, submit an access request.
              </p>
            </section>
            <section className="content-panel">
              <SectionHeading
                eyebrow="Your choices"
                title="Submit a privacy request"
                id="privacy-request"
                helpTopic="guest.privacy"
              />
              <form
                action={submitPrivacyRequestAction}
                className={styles.formGrid}
              >
                <input
                  type="hidden"
                  name="campgroundId"
                  value={selected.campgroundId}
                />
                <label>
                  What would we like reviewed?
                  <select name="requestKind" required defaultValue="access">
                    {kinds.map(([value, label]) => (
                      <option key={value} value={value}>
                        {label}
                      </option>
                    ))}
                  </select>
                </label>
                <label>
                  Which information?
                  <select name="subjectArea" required defaultValue="all">
                    <option value="all">All related information</option>
                    <option value="profile">Saved profile</option>
                    <option value="stays">Stays and receipts</option>
                    <option value="communications">
                      Communications and consent
                    </option>
                  </select>
                </label>
                <p>
                  Do not paste identification documents, contact details or
                  medical information here. We store only the request category
                  and scope; staff may arrange secure verification separately if
                  needed.
                </p>
                <button className="primary-button" type="submit">
                  Submit for human review
                </button>
              </form>
            </section>
            <section className="content-panel">
              <SectionHeading
                eyebrow="Append-only status"
                title="My request history"
                id="request-history"
                helpTopic="guest.privacy"
              />
              {workspace?.requests.length ? (
                <div className={styles.cards}>
                  {workspace.requests.map((r) => (
                    <article key={r.id} className={styles.card}>
                      <p className={styles.tag}>
                        {r.requestKind.replaceAll("_", " ")} · {r.subjectArea}
                      </p>
                      <h3>{r.status.replaceAll("_", " ")}</h3>
                      <p>
                        Submitted {r.submittedAt?.slice(0, 10)} · Last event{" "}
                        {r.reviewedAt?.slice(0, 10)} ·{" "}
                        {r.outcomeCode.replaceAll("_", " ")}
                      </p>
                      {r.terminal ? (
                        <p>
                          Staff recorded an internal review outcome. This does
                          not certify that data was erased or exported outside
                          the app.
                        </p>
                      ) : null}
                      <small>Request {r.id}</small>
                    </article>
                  ))}
                </div>
              ) : (
                <p>No privacy requests yet.</p>
              )}
            </section>
            <section className="content-panel">
              <SectionHeading
                eyebrow="Linked records only"
                title="Consent & saved-profile preference history"
                id="consent-history"
                helpTopic="guest.privacy"
              />
              <p>
                Source events are kept as recorded. A preference update is not a
                blanket marketing consent; marketing history lists only
                account-linked communication endpoints.
              </p>
              {workspace?.consentHistory.length ? (
                <ul>
                  {workspace.consentHistory.map((item, index) => (
                    <li key={`${item.source}-${item.at}-${index}`}>
                      <strong>
                        {item.at?.slice(0, 16).replace("T", " ")} UTC
                      </strong>{" "}
                      ·{" "}
                      {item.source === "saved_profile"
                        ? `Saved profile: preferences ${item.saveStayPreferences ? "on" : "off"}, staff lookup ${item.allowStaffProfileLookup ? "on" : "off"}`
                        : `${item.kind} ${item.channel}: ${item.consentState}`}{" "}
                      · {item.source}
                    </li>
                  ))}
                </ul>
              ) : (
                <p>
                  No linked consent events found for this campground. Unlinked
                  provider endpoints or historical records may require a manual
                  access review.
                </p>
              )}
              {workspace?.truncated ? (
                <p className={styles.warning}>
                  One or more sources reached the 100-record view limit. Request
                  a complete manual access review.
                </p>
              ) : null}
              <small>
                Retrieved {workspace?.sourceAt ?? "—"} · No automatic retention
                or deletion action occurs.
              </small>
            </section>
          </>
        )}
      </div>
    </AppShell>
  );
}
