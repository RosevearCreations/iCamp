import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";

import { AppShell } from "@/components/app-shell";
import { requireStaff } from "@/lib/auth/current-session";
import {
  getCampgroundAuthorization,
  listAssignedCampgrounds,
} from "@/lib/authz/postgres.mjs";
import {
  INCIDENT_CATEGORIES,
  INCIDENT_SEVERITIES,
  INCIDENT_SIGNALS,
  independentReviewEligibility,
  canRequestIncidentClosure,
} from "@/lib/security-incidents/core.mjs";
import { listSecurityIncidentCases } from "@/lib/security-incidents/postgres.mjs";
import {
  attachIncidentEvidenceAction,
  createIncidentAction,
  reviewIncidentAction,
  updateIncidentAction,
  updateIncidentSensitiveAction,
} from "./actions";

import styles from "./incidents.module.css";

const PATH = "/workspaces/security/incidents";

export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "Security incident cases · iCamp",
  description:
    "Private campground security case investigation and independent closure review.",
  robots: { index: false, follow: false },
};

function label(value: string) {
  return value
    .replaceAll("_", " ")
    .replace(/\b\w/gu, (letter) => letter.toUpperCase());
}

function when(value: string | null, timeZone: string) {
  if (!value) return "Not recorded";
  return new Intl.DateTimeFormat("en-CA", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone,
  }).format(new Date(value));
}

function hiddenCase(campgroundId: string, caseId: string, rowVersion: number) {
  return (
    <>
      <input type="hidden" name="campgroundId" value={campgroundId} />
      <input type="hidden" name="caseId" value={caseId} />
      <input type="hidden" name="rowVersion" value={rowVersion} />
    </>
  );
}

export default async function SecurityIncidentCasesPage({
  searchParams,
}: Readonly<{
  searchParams: Promise<{
    campground?: string;
    case?: string;
    saved?: string;
    error?: string;
  }>;
}>) {
  const session = await requireStaff(PATH);
  if (!process.env.DATABASE_URL?.trim())
    return (
      <AppShell>
        <section className="content-panel" role="status">
          <h1>Security incident cases unavailable</h1>
          <p>
            Database is not configured. No cases have been created or closed.
          </p>
        </section>
      </AppShell>
    );

  const params = await searchParams;
  const assigned = await listAssignedCampgrounds(session.user.id);
  const authorized = (
    await Promise.all(
      assigned.map(async (campground) => {
        const authorization = await getCampgroundAuthorization(
          session.user.id,
          campground.campgroundId,
        );
        const permissions: string[] = authorization?.permissions ?? [];
        const canManage = permissions.includes("security.incident.manage");
        const canReview = permissions.includes("security.incident.review");
        return canManage || canReview
          ? { ...campground, permissions, canManage, canReview }
          : null;
      }),
    )
  ).filter((item): item is NonNullable<typeof item> => item !== null);

  if (!authorized.length) redirect("/auth/not-authorized");
  const campground =
    authorized.find((item) => item.campgroundId === params.campground) ??
    authorized[0];
  const board = await listSecurityIncidentCases({
    actorUserId: session.user.id,
    campgroundId: campground.campgroundId,
    selectedCaseId: params.case ?? null,
  });
  const selected = board.selected;
  const canManage = campground.canManage;
  const canReview = campground.canReview;
  const canReadSensitive = board.canSeeSensitive;
  const independentlyEligible =
    selected && canReview
      ? independentReviewEligibility(selected, session.user.id, board.events)
      : null;
  const canRequestClosure =
    selected && canRequestIncidentClosure(selected, board.attachments);
  const basePath = `${PATH}?campground=${encodeURIComponent(campground.campgroundId)}`;

  return (
    <AppShell>
      <div className="page-stack">
        <nav className="breadcrumbs" aria-label="Breadcrumb">
          <Link href="/">iCamp</Link>
          <span>/</span>
          <Link href="/workspaces/security">Security</Link>
          <span>/</span>
          <span>Incident cases</span>
        </nav>
        <section className="hero-panel">
          <p className="eyebrow">Build 187 · Restricted security workflow</p>
          <h1>Canonical Security Incident Cases</h1>
          <p className="hero-panel__lead">
            Investigate and escalate safety/security reports with a protected
            chronology, private evidence and an independent closure decision.{" "}
            <strong>
              Device faults, access denials and failed overrides remain
              signals—not automatically opened or closed cases.
            </strong>
          </p>
          <p>
            <Link href="/workspaces/security/dashboard">
              View security/access signals
            </Link>
          </p>
        </section>

        {params.saved ? (
          <p className={styles.success} role="status">
            {params.saved}
          </p>
        ) : null}
        {params.error ? (
          <p className={styles.error} role="alert">
            {params.error}
          </p>
        ) : null}

        <section className="content-panel">
          <h2>Campground scope</h2>
          <form method="get" className={styles.rowForm}>
            <label>
              Campground{" "}
              <select name="campground" defaultValue={campground.campgroundId}>
                {authorized.map((item) => (
                  <option key={item.campgroundId} value={item.campgroundId}>
                    {item.campgroundName}
                  </option>
                ))}
              </select>
            </label>
            <button type="submit" className="primary-button">
              Open case board
            </button>
          </form>
          <p className={styles.hint}>
            Private staff-only case history. Reviewers cannot approve cases they
            opened, investigated, owned or submitted for closure. Billing and
            outbound Omnichannel are HELD / DISCONNECTED.
          </p>
        </section>

        {canManage ? (
          <section className="content-panel">
            <h2>Open a canonical incident</h2>
            <form action={createIncidentAction} className={styles.formGrid}>
              <input
                type="hidden"
                name="campgroundId"
                value={campground.campgroundId}
              />
              <label>
                Case title{" "}
                <input
                  name="title"
                  minLength={8}
                  maxLength={160}
                  required
                  placeholder="Short non-identifying description"
                />
              </label>
              <label>
                Category{" "}
                <select name="category">
                  {INCIDENT_CATEGORIES.map((item) => (
                    <option key={item} value={item}>
                      {label(item)}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                Severity{" "}
                <select name="severity">
                  {INCIDENT_SEVERITIES.map((item) => (
                    <option key={item} value={item}>
                      {label(item)}
                    </option>
                  ))}
                </select>
              </label>
              <label className={styles.wide}>
                Operational summary (avoid witness/guest identities){" "}
                <textarea
                  name="summary"
                  required
                  minLength={20}
                  maxLength={1500}
                  rows={3}
                />
              </label>
              <label>
                Optional signal type{" "}
                <select name="signalKind" defaultValue="">
                  <option value="">No linked signal</option>
                  {INCIDENT_SIGNALS.map((item) => (
                    <option key={item} value={item}>
                      {label(item)}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                Optional canonical signal UUID{" "}
                <input
                  name="signalId"
                  placeholder="Link existing signal by ID"
                />
              </label>
              <button className="primary-button" type="submit">
                Create incident case
              </button>
            </form>
          </section>
        ) : null}

        <section className="content-panel">
          <h2>Campground case board</h2>
          <p className={styles.hint}>
            {board.cases.length} recent canonical cases; unresolved cases remain
            open even when their source signal clears.
          </p>
          {board.cases.length ? (
            <div className={styles.tableScroll}>
              <table className={styles.table}>
                <thead>
                  <tr>
                    <th>Case</th>
                    <th>Severity</th>
                    <th>Status</th>
                    <th>Updated</th>
                    <th>Review</th>
                  </tr>
                </thead>
                <tbody>
                  {board.cases.map((item) => (
                    <tr
                      key={item.id}
                      className={
                        item.id === selected?.id ? styles.activeRow : ""
                      }
                    >
                      <td>
                        <Link
                          href={`${basePath}&case=${encodeURIComponent(item.id)}`}
                        >
                          <strong>{item.title}</strong>
                        </Link>
                        <small>
                          {item.id.slice(0, 8)} · {label(item.category)}
                        </small>
                      </td>
                      <td>{label(item.severity)}</td>
                      <td>{label(item.status)}</td>
                      <td>{when(item.updatedAt, "UTC")}</td>
                      <td>
                        {item.status === "closure_pending"
                          ? "Independent review needed"
                          : item.status === "closed"
                            ? "Recorded"
                            : "—"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p role="status">
              No canonical incident cases have been recorded here.
            </p>
          )}
        </section>

        {selected ? (
          <>
            <section className="content-panel">
              <h2>{selected.title}</h2>
              <div className={styles.caseMeta}>
                <span>
                  Case ID: <code>{selected.id}</code>
                </span>
                <span>Severity: {label(selected.severity)}</span>
                <span>Status: {label(selected.status)}</span>
                <span>Version: {selected.rowVersion}</span>
              </div>
              <p>{selected.operationalSummary}</p>
              <p className={styles.hint}>
                Opened {when(selected.openedAt, "UTC")} · Assigned{" "}
                {selected.assigneeUserId
                  ? `to ${selected.assigneeUserId}`
                  : "to nobody"}
                {selected.linkedSignalId
                  ? ` · Linked ${label(selected.linkedSignalKind ?? "signal")}: ${selected.linkedSignalId}`
                  : " · No source signal linked"}
              </p>
              {selected.status === "closed" ? (
                <p className={styles.success}>
                  Independently closed by {selected.closedByUserId} on{" "}
                  {when(selected.closedAt, "UTC")}. Original evidence and
                  previous decisions remain retained.
                </p>
              ) : null}
            </section>

            {canManage && selected.status !== "closure_pending" ? (
              <section className="content-panel">
                <h2>
                  {selected.status === "closed"
                    ? "Reopen incident"
                    : "Investigation, assignment & escalation"}
                </h2>
                <form action={updateIncidentAction} className={styles.formGrid}>
                  {hiddenCase(
                    campground.campgroundId,
                    selected.id,
                    selected.rowVersion,
                  )}
                  <label>
                    Action{" "}
                    <select name="action">
                      {selected.status === "closed" ? (
                        <option value="reopen">Reopen with reason</option>
                      ) : (
                        <>
                          <option value="investigate">
                            Record investigation update
                          </option>
                          <option value="assign">Assign / unassign case</option>
                          <option value="escalate">Escalate</option>
                          {canRequestClosure ? (
                            <option value="request_closure">
                              Submit for independent closure
                            </option>
                          ) : null}
                        </>
                      )}
                    </select>
                  </label>
                  {selected.status !== "closed" ? (
                    <label>
                      Assignee user UUID (for Assign only; blank clears){" "}
                      <input
                        name="assigneeUserId"
                        defaultValue={selected.assigneeUserId ?? ""}
                      />
                    </label>
                  ) : null}
                  <label className={styles.wide}>
                    Reason / investigation record{" "}
                    <textarea
                      name="details"
                      rows={3}
                      minLength={10}
                      maxLength={1500}
                      required
                    />
                  </label>
                  {!canRequestClosure && selected.status !== "closed" ? (
                    <p className={styles.hint}>
                      Closure submission becomes available after an
                      investigation update and at least one validated
                      confidential attachment.
                    </p>
                  ) : null}
                  <button className="primary-button" type="submit">
                    Record case action
                  </button>
                </form>
              </section>
            ) : null}

            {canReadSensitive ? (
              <section className="content-panel">
                <h2>Restricted witness & guest context</h2>
                <p className={styles.hint}>
                  Visible only to permissioned security personnel and reviewers.
                  Do not copy identifying details into the operational summary
                  or external messages.
                </p>
                {canManage && selected.status !== "closed" ? (
                  <form
                    action={updateIncidentSensitiveAction}
                    className={styles.formGrid}
                  >
                    {hiddenCase(
                      campground.campgroundId,
                      selected.id,
                      selected.rowVersion,
                    )}
                    <label className={styles.wide}>
                      Witness context{" "}
                      <textarea
                        name="witnessContext"
                        defaultValue={board.sensitive?.witnessContext ?? ""}
                        maxLength={3000}
                        rows={3}
                      />
                    </label>
                    <label className={styles.wide}>
                      Guest / affected-person context{" "}
                      <textarea
                        name="guestContext"
                        defaultValue={board.sensitive?.guestContext ?? ""}
                        maxLength={3000}
                        rows={3}
                      />
                    </label>
                    <button type="submit" className="primary-button">
                      Save protected context
                    </button>
                  </form>
                ) : (
                  <div>
                    <p>
                      <strong>Witness:</strong>{" "}
                      {board.sensitive?.witnessContext ||
                        "No private witness context recorded"}
                    </p>
                    <p>
                      <strong>Guest:</strong>{" "}
                      {board.sensitive?.guestContext ||
                        "No private guest context recorded"}
                    </p>
                  </div>
                )}
              </section>
            ) : null}

            {canReadSensitive ? (
              <section className="content-panel">
                <h2>Confidential attachment evidence</h2>
                <p className={styles.hint}>
                  Only validated, private images or PDFs are accepted (up to 10
                  per case). Media is stored separately from case events; an
                  immutable checksum and attachment reference remain after
                  closure.
                </p>
                {board.attachments.length ? (
                  <ul className={styles.timeline}>
                    {board.attachments.map((item) => (
                      <li key={item.id}>
                        <strong>{item.caption}</strong> ·{" "}
                        <Link
                          href={`${PATH}/media/${encodeURIComponent(item.id)}`}
                        >
                          {item.filename}
                        </Link>
                        <small>
                          {(item.byteSize / 1024).toFixed(0)} KiB ·{" "}
                          {label(item.lifecycleState)} ·{" "}
                          {when(item.attachedAt, "UTC")}
                        </small>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p>No confidential evidence attached.</p>
                )}
                {canManage &&
                !["closed", "closure_pending"].includes(selected.status) ? (
                  <form
                    action={attachIncidentEvidenceAction}
                    className={styles.formGrid}
                  >
                    {hiddenCase(
                      campground.campgroundId,
                      selected.id,
                      selected.rowVersion,
                    )}
                    <label className={styles.wide}>
                      Evidence file{" "}
                      <input
                        type="file"
                        name="file"
                        accept="image/jpeg,image/png,image/webp,image/gif,application/pdf"
                        required
                      />
                    </label>
                    <label className={styles.wide}>
                      Evidence caption{" "}
                      <input
                        name="caption"
                        required
                        minLength={8}
                        maxLength={500}
                        placeholder="What the attachment establishes"
                      />
                    </label>
                    <button type="submit" className="primary-button">
                      Retain confidential evidence
                    </button>
                  </form>
                ) : null}
              </section>
            ) : null}

            {selected.status === "closure_pending" ? (
              <section className="content-panel">
                <h2>
                  Independent closure review · Round {selected.closureRound}
                </h2>
                <p className={styles.hint}>
                  Source alerts cannot close this case. Approval requires the
                  retained confidential evidence and a reviewer who did not
                  open, investigate, assign, escalate or request closure.
                </p>
                {canReview ? (
                  independentlyEligible?.eligible ? (
                    <form
                      action={reviewIncidentAction}
                      className={styles.formGrid}
                    >
                      {hiddenCase(
                        campground.campgroundId,
                        selected.id,
                        selected.rowVersion,
                      )}
                      <label>
                        Decision{" "}
                        <select name="decision">
                          <option value="returned">
                            Return for further investigation
                          </option>
                          <option value="approved">
                            Approve independent closure
                          </option>
                        </select>
                      </label>
                      <label className={styles.wide}>
                        Independent findings and evidence assessment{" "}
                        <textarea
                          name="rationale"
                          required
                          minLength={20}
                          maxLength={1500}
                          rows={4}
                        />
                      </label>
                      <button className="primary-button" type="submit">
                        Record independent review
                      </button>
                    </form>
                  ) : (
                    <p role="status">
                      You cannot review this case independently:{" "}
                      {independentlyEligible?.reason}
                    </p>
                  )
                ) : (
                  <p role="status">
                    This case awaits a different authorized reviewer.
                  </p>
                )}
              </section>
            ) : null}

            <section className="content-panel">
              <h2>Investigation chronology</h2>
              <ol className={styles.timeline}>
                {board.events.map((event) => (
                  <li key={event.id}>
                    <strong>{label(event.eventKind)}</strong> ·{" "}
                    {when(event.occurredAt, "UTC")}
                    <p>{event.summary}</p>
                    <small>Recorded by {event.actorUserId}</small>
                  </li>
                ))}
              </ol>
              {board.reviews.length ? (
                <>
                  <h3>Immutable independent review receipts</h3>
                  <ol className={styles.timeline}>
                    {board.reviews.map((review) => (
                      <li key={review.id}>
                        <strong>
                          Round {review.closureRound}: {label(review.decision)}
                        </strong>{" "}
                        · {when(review.reviewedAt, "UTC")}
                        <p>{review.rationale}</p>
                        <small>Reviewer {review.reviewerUserId}</small>
                      </li>
                    ))}
                  </ol>
                </>
              ) : null}
            </section>
          </>
        ) : null}
      </div>
    </AppShell>
  );
}
