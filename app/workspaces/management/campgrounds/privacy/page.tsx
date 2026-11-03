import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";

import { AppShell } from "@/components/app-shell";
import { SectionHeading } from "@/components/section-heading";
import { requireAnyCampgroundPermission } from "@/lib/authz/current-user";
import {
  getCampgroundAuthorization,
  listAssignedCampgrounds,
} from "@/lib/authz/postgres.mjs";
import { listManagedPrivacyRequests } from "@/lib/guest-privacy/postgres.mjs";
import { recordPrivacyReviewAction } from "./actions";
import styles from "../reservations/reservations.module.css";

export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "Guest privacy review · iCamp",
  robots: { index: false, follow: false },
};

export default async function ManagementPrivacyPage({
  searchParams,
}: {
  searchParams: Promise<{
    campground?: string;
    saved?: string;
    error?: string;
  }>;
}) {
  const path = "/workspaces/management/campgrounds/privacy";
  const session = await requireAnyCampgroundPermission("guest.manage", path);
  const params = await searchParams;
  const assigned = await listAssignedCampgrounds(session.user.id);
  const authorized = (
    await Promise.all(
      assigned.map(async (cg) => {
        const access = await getCampgroundAuthorization(
          session.user.id,
          cg.campgroundId,
        );
        return access?.permissions.includes("guest.manage") ? cg : null;
      }),
    )
  ).filter((cg): cg is NonNullable<typeof cg> => cg !== null);
  if (!authorized.length) redirect("/auth/not-authorized");
  const selected =
    authorized.find((cg) => cg.campgroundId === params.campground) ??
    authorized[0];
  const workspace = await listManagedPrivacyRequests({
    userId: session.user.id,
    campgroundId: selected.campgroundId,
  });
  const pending = workspace.requests.filter((r) => !r.terminal);
  return (
    <AppShell>
      <div className="page-stack">
        <nav className="breadcrumbs" aria-label="Breadcrumb">
          <Link href="/workspaces/management/campgrounds">Campgrounds</Link>
          <span>/</span>
          <span>Privacy review</span>
        </nav>
        <section className="hero-panel">
          <p className="eyebrow">Build 197 · Authorized privacy desk</p>
          <h1>Guest privacy & retention review</h1>
          <p className="hero-panel__lead">
            Act on guest-supplied privacy request categories with an append-only
            review trail. Review actual source records and policy/hold
            requirements before arranging corrections, exports or erasure
            through an authorized external process. No record is deleted here.
          </p>
          <Link
            className="secondary-link"
            href="/workspaces/management/campgrounds/guests"
          >
            Guest profiles
          </Link>
        </section>
        {params.saved ? (
          <p className={styles.notice} role="status">
            Review milestone recorded and audited.
          </p>
        ) : null}
        {params.error ? (
          <p className={styles.notice + " " + styles.error} role="alert">
            No review milestone was recorded. Check authorization, current
            request status and source reference; refresh before retrying.
          </p>
        ) : null}
        <section className="content-panel">
          <SectionHeading
            title="Scope & review workload"
            eyebrow="Permission: guest.manage"
            id="privacy-scope"
            helpTopic="guest.privacy"
          />
          <form method="get" className={styles.inlineForm}>
            <label>
              Campground
              <select name="campground" defaultValue={selected.campgroundId}>
                {authorized.map((cg) => (
                  <option value={cg.campgroundId} key={cg.campgroundId}>
                    {cg.campgroundName}
                  </option>
                ))}
              </select>
            </label>
            <button type="submit" className="secondary-button">
              Open queue
            </button>
          </form>
          <p>
            <strong>{pending.length}</strong> requests pending a manual review ·{" "}
            <strong>{workspace.requests.length}</strong> source requests shown
            (latest 100).
          </p>
          {workspace.truncated ? (
            <p className={styles.warning}>
              The latest 100 requests are shown. Narrow review or consult the
              authoritative database for older records.
            </p>
          ) : null}
          <p>
            Retention status: no automatic purge. &ldquo;Retention hold
            review&rdquo; is an attention marker, not a legal hold mechanism or
            a change to other storage systems.
          </p>
        </section>
        <section className="content-panel">
          <SectionHeading
            title="Source-linked requests"
            eyebrow="Human decisions only"
            id="privacy-requests"
            helpTopic="guest.privacy"
          />
          {!workspace.requests.length ? (
            <p>No submitted privacy requests for this campground.</p>
          ) : (
            <div className={styles.cards}>
              {workspace.requests.map((r) => (
                <article className={styles.card} key={r.id}>
                  <p className={styles.tag}>
                    {r.requestKind.replaceAll("_", " ")} · {r.subjectArea}
                  </p>
                  <h3>{r.status.replaceAll("_", " ")}</h3>
                  <p>
                    Request {r.id}
                    <br />
                    Guest account {r.guestUserId}
                    <br />
                    Submitted {r.submittedAt
                      ?.slice(0, 16)
                      .replace("T", " ")}{" "}
                    UTC
                  </p>
                  <p>
                    Latest: {r.outcomeCode.replaceAll("_", " ")}{" "}
                    {r.reviewedAt
                      ? `· ${r.reviewedAt.slice(0, 16).replace("T", " ")} UTC`
                      : ""}
                  </p>
                  {r.sourceReference ? (
                    <p>
                      Source ticket: <code>{r.sourceReference}</code>
                    </p>
                  ) : null}
                  {!r.terminal ? (
                    <form
                      action={recordPrivacyReviewAction}
                      className={styles.formGrid}
                    >
                      <input
                        type="hidden"
                        name="campgroundId"
                        value={selected.campgroundId}
                      />
                      <input type="hidden" name="requestId" value={r.id} />
                      <label>
                        Next internal review stage
                        <select name="eventKind" defaultValue="in_review">
                          <option value="in_review">
                            Policy review underway
                          </option>
                          <option value="information_needed">
                            Identity / more information needed
                          </option>
                          <option value="retention_hold_review">
                            Retention or legal-hold review
                          </option>
                          <option value="manual_action_required">
                            Manual action or external fulfillment required
                          </option>
                          <option value="fulfilled_external">
                            External fulfillment attested (with source ticket)
                          </option>
                          <option value="closed_no_action">
                            Close: no applicable action
                          </option>
                        </select>
                      </label>
                      <label>
                        External source ticket (8–120 safe characters; required
                        to close)
                        <input
                          name="sourceReference"
                          maxLength={120}
                          pattern="[A-Za-z0-9][A-Za-z0-9._:/-]{7,119}"
                          placeholder="CASE-12345"
                        />
                      </label>
                      <button className="primary-button" type="submit">
                        Record review milestone
                      </button>
                    </form>
                  ) : (
                    <p>
                      Internally closed · immutable. External fulfillment and
                      erasure are not certified by this status.
                    </p>
                  )}
                </article>
              ))}
            </div>
          )}
        </section>
      </div>
    </AppShell>
  );
}
