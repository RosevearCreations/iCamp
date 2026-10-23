import { randomUUID } from "node:crypto";

import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";

import { AppShell } from "@/components/app-shell";
import { SectionHeading } from "@/components/section-heading";
import { requireSignedIn } from "@/lib/auth/current-session";
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
} from "./actions";
import styles from "../../workspaces/management/campgrounds/reservations/reservations.module.css";

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
    activeStays.find((stay) => stay.id === params.reservation) ??
    activeStays[0] ??
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
            <h1>Camper Assistance</h1>
            <p className="hero-panel__lead">
              Assistance requests are linked to an active checked-in stay so the
              campground can identify the correct property and accommodation.
            </p>
          </section>
          <section className="content-panel">
            <SectionHeading
              eyebrow="Stay required"
              title="No checked-in stay is available"
              id="assistance-no-stay"
              helpTopic="camper.assistance.request"
            />
            <p>
              Open My Stay to review your reservation. The assistance form
              becomes available after the campground has checked you in.
            </p>
            <Link className="primary-link" href="/guest/stay">
              Open My Stay
            </Link>
          </section>
        </div>
      </AppShell>
    );
  }

  const [requests, operationalUpdates] = await Promise.all([
    listCamperAssistanceRequests({
      userId: session.user.id,
      reservationId: selected.id,
    }),
    listGuestAssistanceUpdates({
      userId: session.user.id,
      reservationId: selected.id,
    }),
  ]);
  const updateByRequest = new Map(
    operationalUpdates.map((item) => [item.requestId, item]),
  );

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
          <p className="eyebrow">Build 077 · Stay-linked intake</p>
          <h1>Camper Assistance</h1>
          <p className="hero-panel__lead">
            Tell the campground what you need at {selected.accommodationCode} ·{" "}
            {selected.accommodationName}. Your request remains linked to this
            checked-in stay.
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
            <input type="hidden" name="clientRequestId" value={randomUUID()} />
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
                Validated internal evidence only. Images up to 12 MiB; PDF up to
                25 MiB.
              </span>
            </label>
            <div className={styles.full}>
              <button className="primary-button" type="submit">
                Submit assistance request
              </button>
            </div>
          </form>
        </section>

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
                                <strong>{label(operational.caseState)}</strong> ·{" "}
                                {label(operational.category)} ·{" "}
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
                                <p>
                                  Outcome: {operational.outcomeSummary}
                                </p>
                              ) : null}
                            </>
                          );
                        })()}
                      </td>
                      <td>{label(request.contactPreference)}</td>
                      <td>
                        <p>{request.mediaCount} / 5 attached</p>
                        {request.mediaCount < 5 &&
                        updateByRequest.get(request.id)?.caseState !== "closed" ? (
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
                          <span>Attachment limit reached.</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
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
