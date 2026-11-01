import { randomUUID } from "node:crypto";

import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";

import { AppShell } from "@/components/app-shell";
import { SectionHeading } from "@/components/section-heading";
import { requireSignedIn } from "@/lib/auth/current-session";
import { guestAssistanceProgress } from "@/lib/assistance-conversations/core.mjs";
import { listOwnAssistanceAttachmentsForStay } from "@/lib/assistance-conversations/postgres.mjs";
import {
  CAMPER_ASSISTANCE_CATEGORIES,
  CAMPER_ASSISTANCE_CONTACT_PREFERENCES,
  CAMPER_ASSISTANCE_SEVERITIES,
} from "@/lib/camper-assistance/core.mjs";
import { listGuestAssistanceUpdates } from "@/lib/camper-assistance-triage/postgres.mjs";
import { listCamperAssistanceRequests } from "@/lib/camper-assistance/postgres.mjs";
import { listMyStays } from "@/lib/my-stay/postgres.mjs";

import {
  addCamperAssistanceMediaAction,
  createCamperAssistanceRequestAction,
  postGuestAssistanceReplyAction,
} from "./actions";
import styles from "../../workspaces/management/campgrounds/reservations/reservations.module.css";
import conversationStyles from "./conversation.module.css";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Camper assistance · iCamp",
  description:
    "Request stay-linked campground assistance with category, priority, contact preference and optional internal media evidence.",
};

function label(value: string) {
  if (value === "wifi") return "Wi-Fi";
  if (value === "in_app") return "In-app";
  return value
    .replaceAll("_", " ")
    .replace(/\b\w/gu, (letter) => letter.toUpperCase());
}

export default async function CamperAssistancePage({
  searchParams,
}: Readonly<{
  searchParams: Promise<{
    reservation?: string;
    saved?: string;
    error?: string;
  }>;
}>) {
  const path = "/guest/assistance";
  const session = await requireSignedIn(path);
  if (session.user.accountType !== "guest") {
    redirect("/auth/not-authorized");
  }

  const params = await searchParams;
  const stays = await listMyStays({ userId: session.user.id });
  const activeStays = stays.filter((stay) => stay.status === "checked_in");
  const selected =
    stays.find((stay) => stay.id === params.reservation) ??
    activeStays[0] ??
    stays.find((stay) => stay.status === "completed") ??
    stays[0] ??
    null;

  if (!selected) {
    return (
      <AppShell>
        <div className="page-stack">
          <nav className="breadcrumbs" aria-label="Breadcrumb">
            <Link href="/">iCamp</Link>
            <span>/</span>
            <Link href="/guest/stay">My Stay</Link>
            <span>/</span>
            <span>Assistance</span>
          </nav>
          <section className="hero-panel">
            <p className="eyebrow">Build 077 · Camper assistance</p>
            <h1>No reservation available</h1>
            <p className="hero-panel__lead">
              New requests require an active checked-in stay. Existing cases
              remain available for authorized follow-up after departure.
            </p>
          </section>
          <section className="content-panel">
            <SectionHeading
              eyebrow="Stay required"
              title="No stay on this account"
              id="assistance-no-stay"
              helpTopic="camper.assistance.request"
            />
            <p>
              Open My Stay to review reservations linked to your guest account.
            </p>
            <Link className="primary-link" href="/guest/stay">
              Open My Stay
            </Link>
          </section>
        </div>
      </AppShell>
    );
  }

  const [requests, operationalUpdates, attachments] = await Promise.all([
    listCamperAssistanceRequests({
      userId: session.user.id,
      reservationId: selected.id,
    }),
    listGuestAssistanceUpdates({
      userId: session.user.id,
      reservationId: selected.id,
    }),
    listOwnAssistanceAttachmentsForStay({
      userId: session.user.id,
      reservationId: selected.id,
    }),
  ]);
  const updateByRequest = new Map(
    operationalUpdates.map((item) => [item.requestId, item]),
  );
  const attachmentsByRequest = new Map<string, typeof attachments>();
  for (const attachment of attachments) {
    const list = attachmentsByRequest.get(attachment.requestId) ?? [];
    list.push(attachment);
    attachmentsByRequest.set(attachment.requestId, list);
  }

  return (
    <AppShell>
      <div className="page-stack">
        <nav className="breadcrumbs" aria-label="Breadcrumb">
          <Link href="/">iCamp</Link>
          <span>/</span>
          <Link
            href={"/guest/stay?reservation=" + encodeURIComponent(selected.id)}
          >
            My Stay
          </Link>
          <span>/</span>
          <span>Assistance</span>
        </nav>

        <section className="hero-panel">
          <p className="eyebrow">Build 179 · Case conversation</p>
          <h1>Camper Assistance &amp; case progress</h1>
          <p className="hero-panel__lead">
            Follow the campground&apos;s responses and reply securely for{" "}
            {selected.accommodationCode} · {selected.accommodationName}.
            Messages are in-app records only; no email, SMS or dispatch occurs.
          </p>
        </section>

        {params.saved ? (
          <div className={styles.notice} role="status">
            {params.saved}
          </div>
        ) : null}
        {params.error ? (
          <div className={styles.notice + " " + styles.error} role="alert">
            {params.error}
          </div>
        ) : null}

        <section className="content-panel">
          <SectionHeading
            eyebrow="Safety"
            title="For campground assistance, not emergency dispatch"
            id="assistance-emergency-boundary"
            helpTopic="camper.assistance.request"
          />
          <p>
            Choose <strong>Urgent</strong> when campground staff should respond
            quickly. For immediate threats to life, fire, serious injury or
            other emergencies, use the appropriate emergency service and the
            campground&apos;s emergency procedure instead of relying on this
            form.
          </p>
        </section>

        {selected.status === "checked_in" ? (
          <section className="content-panel">
            <SectionHeading
              eyebrow="New request"
              title="What do you need help with?"
              id="assistance-request-form"
              helpTopic="camper.assistance.request"
              trailing={<span className="build-chip">Build 077</span>}
            />
            <form
              action={createCamperAssistanceRequestAction}
              className={styles.formGrid}
            >
              <input type="hidden" name="reservationId" value={selected.id} />
              <input
                type="hidden"
                name="clientRequestId"
                value={randomUUID()}
              />
              <label>
                Category
                <select name="category" defaultValue="maintenance" required>
                  {CAMPER_ASSISTANCE_CATEGORIES.map((category) => (
                    <option key={category} value={category}>
                      {label(category)}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                Priority
                <select name="severity" defaultValue="routine" required>
                  {CAMPER_ASSISTANCE_SEVERITIES.map((severity) => (
                    <option key={severity} value={severity}>
                      {label(severity)}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                Contact preference
                <select name="contactPreference" defaultValue="in_app" required>
                  {CAMPER_ASSISTANCE_CONTACT_PREFERENCES.map((channel) => (
                    <option key={channel} value={channel}>
                      {label(channel)}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                Short summary
                <input
                  name="summary"
                  minLength={3}
                  maxLength={160}
                  required
                  placeholder="Example: No power at the site pedestal"
                />
              </label>
              <label className={styles.full}>
                Details
                <textarea
                  name="details"
                  maxLength={4000}
                  rows={5}
                  placeholder="Describe what is happening, where it is, and anything staff should know."
                />
              </label>
              <label className={styles.full}>
                Optional image or PDF
                <input
                  name="file"
                  type="file"
                  accept="image/jpeg,image/png,image/webp,image/gif,application/pdf"
                />
                <span>
                  Validated internal evidence only. Images up to 12 MiB; PDF up
                  to 25 MiB.
                </span>
              </label>
              <div className={styles.full}>
                <button className="primary-button" type="submit">
                  Submit assistance request
                </button>
              </div>
            </form>
          </section>
        ) : (
          <p className="content-panel" role="status">
            This stay is not currently checked in. You can read and reply to
            existing open cases, but new assistance intake is available only
            during a checked-in stay.
          </p>
        )}

        <section className="content-panel">
          <SectionHeading
            eyebrow="This stay"
            title="Submitted requests"
            id="assistance-request-history"
            helpTopic="camper.assistance.request"
          />
          {requests.length === 0 ? (
            <p>No assistance requests have been submitted for this stay.</p>
          ) : (
            <div className={styles.tableWrap}>
              <table>
                <thead>
                  <tr>
                    <th>Submitted</th>
                    <th>Category</th>
                    <th>Priority</th>
                    <th>Request</th>
                    <th>Status / updates</th>
                    <th>Contact</th>
                    <th>Media</th>
                  </tr>
                </thead>
                <tbody>
                  {requests.map((request) => (
                    <tr key={request.id}>
                      <td>{request.submittedAt ?? "—"}</td>
                      <td>{label(request.category)}</td>
                      <td>{label(request.severity)}</td>
                      <td>
                        <strong>{request.summary}</strong>
                        {request.details ? <p>{request.details}</p> : null}
                      </td>
                      <td>
                        {(() => {
                          const operational = updateByRequest.get(request.id);
                          if (!operational) return <span>Submitted</span>;
                          return (
                            <>
                              <p>
                                <strong>{label(operational.caseState)}</strong>{" "}
                                · {label(operational.category)} ·{" "}
                                {label(operational.severity)}
                              </p>
                              {operational.updates.map((update) => (
                                <p key={update.id}>
                                  {update.summary}
                                  {update.channel
                                    ? " · " + label(update.channel)
                                    : ""}
                                </p>
                              ))}
                              {operational.outcomeSummary ? (
                                <p>Outcome: {operational.outcomeSummary}</p>
                              ) : null}
                            </>
                          );
                        })()}
                      </td>
                      <td>{label(request.contactPreference)}</td>
                      <td>
                        <p>{request.mediaCount} / 5 attached</p>
                        {request.mediaCount < 5 &&
                        updateByRequest.get(request.id) &&
                        updateByRequest.get(request.id)?.caseState !==
                          "closed" ? (
                          <form action={addCamperAssistanceMediaAction}>
                            <input
                              type="hidden"
                              name="reservationId"
                              value={selected.id}
                            />
                            <input
                              type="hidden"
                              name="requestId"
                              value={request.id}
                            />
                            <input
                              name="file"
                              type="file"
                              accept="image/jpeg,image/png,image/webp,image/gif,application/pdf"
                              required
                            />
                            <button className="secondary-button" type="submit">
                              Add media
                            </button>
                          </form>
                        ) : (
                          <span>No further attachments available.</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>

        <section
          className="content-panel"
          aria-labelledby="assistance-conversation-heading"
        >
          <SectionHeading
            eyebrow="Build 179 · Private in-app conversation"
            title="Your case conversations"
            id="assistance-conversation-heading"
            helpTopic="camper.assistance.request"
          />
          <p>
            Replies and operational updates stay within iCamp. Only
            guest-visible case records appear here; staff-only notes are never
            shared. Refresh this page to read new activity. An urgent label does
            not guarantee a response time or dispatch.
          </p>
          {requests.length === 0 ? (
            <p role="status">
              No assistance case conversations yet for this stay.
            </p>
          ) : (
            <div className={conversationStyles.caseList}>
              {requests.map((request) => {
                const progress = guestAssistanceProgress({
                  request,
                  update: updateByRequest.get(request.id) ?? null,
                });
                const files = attachmentsByRequest.get(request.id) ?? [];
                return (
                  <article
                    className={conversationStyles.caseCard}
                    key={request.id}
                  >
                    <div className={conversationStyles.caseHeading}>
                      <div>
                        <p className={conversationStyles.eyebrow}>
                          {label(request.category)} ·{" "}
                          {request.submittedAt ?? "Submitted"}
                        </p>
                        <h3>{request.summary}</h3>
                      </div>
                      <span className={conversationStyles.status}>
                        {label(progress.caseState)}
                      </span>
                    </div>
                    <div className={conversationStyles.caseFacts}>
                      <span>{progress.assignment}</span>
                      {progress.urgent ? (
                        <strong className={conversationStyles.urgent}>
                          Urgent · office attention
                        </strong>
                      ) : null}
                      {progress.escalation !== "none" ? (
                        <strong className={conversationStyles.escalation}>
                          Management escalation · {label(progress.escalation)}
                        </strong>
                      ) : null}
                    </div>
                    <h4>Activity &amp; replies</h4>
                    <ol className={conversationStyles.timeline}>
                      {progress.events.map((event) => (
                        <li key={event.id}>
                          <div className={conversationStyles.eventHeader}>
                            <strong>
                              {event.actor} · {label(event.eventKind)}
                            </strong>
                            <time dateTime={event.occurredAt ?? undefined}>
                              {event.occurredAt ?? "Time not recorded"}
                            </time>
                          </div>
                          <p>{event.summary}</p>
                          {event.eventKind === "guest_message" ? (
                            <small>
                              Staff communication record; external delivery is
                              not verified.
                            </small>
                          ) : null}
                        </li>
                      ))}
                    </ol>
                    {progress.closed ? (
                      <p role="status" className={conversationStyles.closed}>
                        Case closed.{" "}
                        {updateByRequest.get(request.id)?.outcomeSummary ??
                          "The campground recorded its final outcome."}{" "}
                        New issues require a new request during a checked-in
                        stay.
                      </p>
                    ) : progress.canReply ? (
                      <form
                        action={postGuestAssistanceReplyAction}
                        className={conversationStyles.replyForm}
                      >
                        <input
                          type="hidden"
                          name="reservationId"
                          value={selected.id}
                        />
                        <input
                          type="hidden"
                          name="requestId"
                          value={request.id}
                        />
                        <input
                          type="hidden"
                          name="clientMessageId"
                          value={randomUUID()}
                        />
                        <label htmlFor={`assistance-reply-${request.id}`}>
                          Reply in app
                        </label>
                        <textarea
                          id={`assistance-reply-${request.id}`}
                          name="message"
                          rows={3}
                          minLength={3}
                          maxLength={2000}
                          required
                          placeholder="Add a helpful update for campground staff."
                        />
                        <button className="primary-button" type="submit">
                          Post private reply
                        </button>
                      </form>
                    ) : (
                      <p>
                        Case intake is being prepared. Contact the campground
                        office for immediate follow-up.
                      </p>
                    )}
                    <div className={conversationStyles.mediaPanel}>
                      <h4>
                        Validated case evidence ({files.length} available)
                      </h4>
                      {files.length ? (
                        <ul>
                          {files.map((file) => (
                            <li key={file.id}>
                              <Link
                                href={`/guest/assistance/media/${encodeURIComponent(file.id)}`}
                                target="_blank"
                                rel="noopener noreferrer"
                              >
                                Open {file.filename} ·{" "}
                                {Math.ceil(file.byteSize / 1024)} KB
                              </Link>
                            </li>
                          ))}
                        </ul>
                      ) : (
                        <p>No accessible case media is attached yet.</p>
                      )}
                      {!progress.closed &&
                      progress.canReply &&
                      request.mediaCount < 5 ? (
                        <form
                          action={addCamperAssistanceMediaAction}
                          className={conversationStyles.attachForm}
                        >
                          <input
                            type="hidden"
                            name="reservationId"
                            value={selected.id}
                          />
                          <input
                            type="hidden"
                            name="requestId"
                            value={request.id}
                          />
                          <label htmlFor={`case-media-${request.id}`}>
                            Attach image or PDF (maximum five per case)
                          </label>
                          <input
                            id={`case-media-${request.id}`}
                            type="file"
                            name="file"
                            accept="image/jpeg,image/png,image/webp,image/gif,application/pdf"
                            required
                          />
                          <button type="submit" className="secondary-button">
                            Add validated case evidence
                          </button>
                        </form>
                      ) : null}
                    </div>
                  </article>
                );
              })}
            </div>
          )}
        </section>

        <section className="content-panel">
          <SectionHeading
            eyebrow="Channel contract"
            title="One canonical request"
            id="assistance-channel-contract"
            helpTopic="shell.channels"
          />
          <p>
            <strong>Web/PWA:</strong> full request intake with validated media.
            <strong> IVR/DTMF:</strong> guided category/priority intake after
            identity verification. <strong>SMS/MMS:</strong> guided intake using
            the same canonical command; media is validated before attachment.
            Visual review can use secure-link or staff-assisted handoff.
          </p>
          <p>
            Build 077 preserves your original report. Build 078 tracks
            operational classification, assignment, management escalation,
            guest-visible updates and the final outcome without rewriting that
            original intake.
          </p>
        </section>
      </div>
    </AppShell>
  );
}
