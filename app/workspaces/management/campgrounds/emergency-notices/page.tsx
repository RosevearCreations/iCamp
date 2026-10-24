import { randomUUID } from "node:crypto";
import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";

import { AppShell } from "@/components/app-shell";
import { SectionHeading } from "@/components/section-heading";
import { requireStaff } from "@/lib/auth/current-session";
import { listAssignedCampgrounds } from "@/lib/authz/postgres.mjs";
import {
  getEmergencyNoticeDashboard,
  getEmergencyNoticePermissions,
} from "@/lib/emergency-notices/postgres.mjs";

import {
  createEmergencyNoticeAction,
  recordEmergencyDecisionAction,
} from "./actions";
import styles from "../reservations/reservations.module.css";

export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "Emergency communication & safety guardrails · iCamp",
  robots: { index: false, follow: false },
};

const display = (value: string) =>
  value.replaceAll("_", " ").replace(/\b\w/gu, (c) => c.toUpperCase());

export default async function EmergencyNoticesPage({
  searchParams,
}: Readonly<{
  searchParams: Promise<{ campground?: string; saved?: string }>;
}>) {
  const path = "/workspaces/management/campgrounds/emergency-notices";
  const session = await requireStaff(path);
  const params = await searchParams;
  const assigned = await listAssignedCampgrounds(session.user.id);
  const available = (
    await Promise.all(
      assigned.map(async (camp) => ({
        ...camp,
        permissions: await getEmergencyNoticePermissions(
          session.user.id,
          camp.campgroundId,
        ),
      })),
    )
  ).filter((camp) => camp.permissions.read);
  if (!available.length) redirect("/auth/not-authorized");
  const selected =
    available.find((camp) => camp.campgroundId === params.campground) ??
    available[0];
  const { campground, sections, accommodations, plans, events, permissions } =
    await getEmergencyNoticeDashboard(session.user.id, selected.campgroundId);

  return (
    <AppShell>
      <div className="page-stack">
        <nav className="breadcrumbs" aria-label="Breadcrumb">
          <Link href="/">iCamp</Link>
          <span>/</span>
          <Link href="/workspaces/management/campgrounds">Campgrounds</Link>
          <span>/</span>
          <span>Emergency communication</span>
        </nav>
        <section className="hero-panel">
          <p className="eyebrow">Build 086 · Safety communications</p>
          <h1>Emergency notice plans &amp; approval audit</h1>
          <p className="hero-panel__lead">
            Prepare a notice for everyone, a section, one site, or assigned
            staff. Independent management review and any manual handoff are
            recorded separately.
          </p>
          <p>
            <strong>Immediate life-safety action takes priority.</strong>{" "}
            Contact the applicable emergency services directly and carry out the
            current on-site response, evacuation, accessibility, assembly-point
            and physical-warning procedures. iCamp does not call responders,
            send emergency SMS, sound a siren, open gates, verify receipt or
            replace those procedures.
          </p>
        </section>
        {params.saved ? (
          <p role="status" className={styles.notice}>
            {params.saved}
          </p>
        ) : null}

        <section className="content-panel">
          <SectionHeading
            id="emergency-scope"
            eyebrow="Property-specific register"
            title="Campground & emergency status"
            helpTopic="emergency.notices"
          />
          <form method="get" className={styles.inlineForm}>
            <label>
              Campground
              <select name="campground" defaultValue={selected.campgroundId}>
                {available.map((camp) => (
                  <option key={camp.campgroundId} value={camp.campgroundId}>
                    {camp.campgroundName}
                  </option>
                ))}
              </select>
            </label>
            <button type="submit" className="primary-button">
              Open campground
            </button>
          </form>
          <p>
            Selected campground: <strong>{campground.name}</strong> ·{" "}
            {display(campground.lifecycle_state)}
          </p>
          {campground.lifecycle_state !== "active" ? (
            <p>
              <strong>Test or inactive campground:</strong> drafting and
              independent review may be tested; actual manual-distribution
              claims are blocked until the campground is active.
            </p>
          ) : null}
        </section>

        {permissions.draft ? (
          <section className="content-panel">
            <SectionHeading
              id="emergency-draft"
              eyebrow="Proposal · does not send anything"
              title="Draft an audience-specific notice"
              helpTopic="emergency.notices"
            />
            <p>
              Choose exactly one audience. For section/site notices choose the
              matching target and leave the other target empty. Keep directions
              specific to the official local emergency plan.
            </p>
            <form
              action={createEmergencyNoticeAction}
              className={styles.inlineForm}
            >
              <input type="hidden" name="id" value={randomUUID()} />
              <input type="hidden" name="campgroundId" value={campground.id} />
              <label>
                Audience
                <select name="audience" defaultValue="campground" required>
                  <option value="campground">Entire campground</option>
                  <option value="section">One section</option>
                  <option value="site">One site / accommodation</option>
                  <option value="staff">Assigned campground staff</option>
                </select>
              </label>
              <label>
                Section (only if section audience)
                <select name="sectionId" defaultValue="">
                  <option value="">No section</option>
                  {sections.map((section) => (
                    <option key={section.id} value={section.id}>
                      {section.code} · {section.name}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                Site (only if site audience)
                <select name="accommodationId" defaultValue="">
                  <option value="">No site</option>
                  {accommodations.map((site) => (
                    <option key={site.id} value={site.id}>
                      {site.code} · {site.display_name}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                Severity
                <select name="severity" defaultValue="urgent">
                  <option value="advisory">Advisory</option>
                  <option value="urgent">Urgent</option>
                  <option value="evacuation">Evacuation directions</option>
                </select>
              </label>
              <label>
                Notice title
                <input
                  name="title"
                  required
                  minLength={8}
                  maxLength={160}
                  placeholder="e.g. North loop weather advisory"
                />
              </label>
              <label>
                Public-facing directions
                <textarea
                  name="message"
                  required
                  minLength={32}
                  maxLength={3000}
                  rows={3}
                  placeholder="State the area, observation, approved instructions and where to receive updates."
                />
              </label>
              <label>
                On-site staff actions
                <textarea
                  name="onsiteInstructions"
                  required
                  minLength={32}
                  maxLength={2000}
                  rows={3}
                  placeholder="Identify the approved emergency plan, person in charge and physical response steps."
                />
              </label>
              <button type="submit" className="primary-button">
                Save draft for review
              </button>
            </form>
          </section>
        ) : null}

        <section className="content-panel">
          <SectionHeading
            id="emergency-register"
            eyebrow="Immutable approval and handoff trail"
            title="Emergency notice register"
            helpTopic="emergency.notices"
          />
          {plans.length ? (
            plans.map((plan) => {
              const review = events.find(
                (event) =>
                  event.notice_id === plan.id &&
                  ["approve", "reject"].includes(event.kind),
              );
              const cancelled = events.some(
                (event) =>
                  event.notice_id === plan.id && event.kind === "cancel",
              );
              const handoffs = events.filter(
                (event) =>
                  event.notice_id === plan.id &&
                  event.kind === "manual_handoff",
              );
              const state = cancelled
                ? "cancelled"
                : review?.kind === "approve"
                  ? "approved"
                  : review?.kind === "reject"
                    ? "rejected"
                    : "pending approval";
              const ownDraft = plan.created_by_user_id === session.user.id;
              const canReview = permissions.approve && !review && !ownDraft;
              const canCancel =
                permissions.approve && review?.kind === "approve" && !cancelled;
              const canHandoff =
                permissions.record &&
                review?.kind === "approve" &&
                !cancelled &&
                campground.lifecycle_state === "active";
              const target =
                plan.audience === "section"
                  ? (sections.find((section) => section.id === plan.section_id)
                      ?.name ?? "Section")
                  : plan.audience === "site"
                    ? (accommodations.find(
                        (site) => site.id === plan.accommodation_id,
                      )?.display_name ?? "Site")
                    : plan.audience === "staff"
                      ? "Assigned staff"
                      : "Entire campground";
              return (
                <article key={plan.id} className="content-panel">
                  <h3>
                    {plan.title} · {display(state)}
                  </h3>
                  <p>
                    <strong>{display(plan.severity)}</strong> · {target} ·{" "}
                    {new Date(plan.created_at).toLocaleString("en-CA")}
                  </p>
                  <p>
                    <strong>Proposed message:</strong> {plan.message}
                  </p>
                  <p>
                    <strong>On-site actions:</strong> {plan.onsite_instructions}
                  </p>
                  <p>
                    Manual handoffs recorded: <strong>{handoffs.length}</strong>
                    . No automated delivery or receipt is asserted.
                  </p>
                  {handoffs.length ? (
                    <ul>
                      {handoffs.map((event) => (
                        <li key={event.id}>
                          {display(event.method ?? "manual")} ·{" "}
                          {event.evidence_reference} ·{" "}
                          {new Date(event.occurred_at).toLocaleString("en-CA")}
                        </li>
                      ))}
                    </ul>
                  ) : null}
                  {ownDraft && !review ? (
                    <p>
                      The author cannot approve their own notice. Ask another
                      authorized manager.
                    </p>
                  ) : null}
                  {canReview || canCancel || canHandoff ? (
                    <form
                      action={recordEmergencyDecisionAction}
                      className={styles.inlineForm}
                    >
                      <input type="hidden" name="id" value={randomUUID()} />
                      <input
                        type="hidden"
                        name="campgroundId"
                        value={campground.id}
                      />
                      <input type="hidden" name="noticeId" value={plan.id} />
                      <label>
                        Authorized action
                        <select
                          name="kind"
                          defaultValue={
                            canReview
                              ? "approve"
                              : canHandoff
                                ? "manual_handoff"
                                : "cancel"
                          }
                        >
                          {canReview ? (
                            <>
                              <option value="approve">Approve plan</option>
                              <option value="reject">Reject plan</option>
                            </>
                          ) : null}
                          {canCancel ? (
                            <option value="cancel">Cancel approved plan</option>
                          ) : null}
                          {canHandoff ? (
                            <option value="manual_handoff">
                              Record manual handoff
                            </option>
                          ) : null}
                        </select>
                      </label>
                      <label>
                        Handoff method (only for manual handoff)
                        <select name="method" defaultValue="">
                          <option value="">Not applicable</option>
                          <option value="onsite_pa">
                            On-site public address
                          </option>
                          <option value="posted_signs">
                            Posted physical signs
                          </option>
                          <option value="staff_briefing">Staff briefing</option>
                          <option value="door_to_door">
                            Door-to-door in person
                          </option>
                          <option value="other">Other manual method</option>
                        </select>
                      </label>
                      <label>
                        Evidence reference (manual handoff only)
                        <input
                          name="evidenceReference"
                          maxLength={400}
                          placeholder="Local log or inspection reference"
                        />
                      </label>
                      <label>
                        <input
                          type="checkbox"
                          name="boundaryAcknowledged"
                          value="yes"
                        />
                        I understand software approval does not contact
                        emergency services or deliver this notice.
                      </label>
                      <label>
                        <input
                          type="checkbox"
                          name="onsitePlanChecked"
                          value="yes"
                        />
                        I independently checked the actual on-site emergency
                        response plan.
                      </label>
                      <label>
                        Reason, decision or manual-hand-off observation
                        <textarea
                          name="note"
                          required
                          minLength={12}
                          maxLength={2000}
                          rows={2}
                        />
                      </label>
                      <button type="submit" className="primary-button">
                        Record action in audit
                      </button>
                    </form>
                  ) : null}
                  {review ? (
                    <p>
                      Management decision: {display(review.kind)} ·{" "}
                      {review.note}
                    </p>
                  ) : null}
                </article>
              );
            })
          ) : (
            <p>No emergency notices have been drafted for this campground.</p>
          )}
        </section>
      </div>
    </AppShell>
  );
}
