import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { AppShell } from "@/components/app-shell";
import { SectionHeading } from "@/components/section-heading";
import { requireStaff } from "@/lib/auth/current-session";
import {
  listAssignedCampgrounds,
  hasCampgroundPermission,
} from "@/lib/authz/postgres.mjs";
import { getDeliveryDashboard } from "@/lib/permanent-unit-delivery/postgres.mjs";
import {
  registerDisclosureAction,
  reviewDisclosureAction,
  consentDeliveryAction,
  signoffDeliveryAction,
} from "./actions";
import styles from "../../../reservations/reservations.module.css";

export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "Applicant offer delivery boundary · iCamp",
  robots: { index: false, follow: false },
};
export default async function DeliveryPage({
  searchParams,
}: Readonly<{
  searchParams: Promise<{
    campground?: string;
    saved?: string;
    error?: string;
  }>;
}>) {
  const path =
    "/workspaces/management/campgrounds/permanent-units/financing/delivery";
  const session = await requireStaff(path),
    params = await searchParams;
  const available = (
    await Promise.all(
      (await listAssignedCampgrounds(session.user.id)).map(async (x) => ({
        ...x,
        allowed: await hasCampgroundPermission(
          session.user.id,
          x.campgroundId,
          "permanent_unit.transfer",
        ),
      })),
    )
  ).filter((x) => x.allowed);
  if (!available.length) redirect("/auth/not-authorized");
  const selected =
    available.find((x) => x.campgroundId === params.campground) ?? available[0];
  const data = await getDeliveryDashboard(
    session.user.id,
    selected.campgroundId,
  );
  const approvedVersions = data.versions.filter((v) =>
    data.reviews.some(
      (r) => r.version_id === v.id && r.outcome === "approved_internal_use",
    ),
  );
  const approvedProposals = data.proposals.filter((p) =>
    data.authorizations.some(
      (a) =>
        a.proposal_id === p.id &&
        a.decision === "authorized_internal_preparation",
    ),
  );
  const proposalById = new Map(data.proposals.map((p) => [p.id, p]));
  const versionById = new Map(data.versions.map((v) => [v.id, v]));
  const hidden = (
    <input type="hidden" name="campgroundId" value={selected.campgroundId} />
  );
  return (
    <AppShell>
      <div className="page-stack">
        <nav className="breadcrumbs" aria-label="Breadcrumb">
          <Link href="/">iCamp</Link>
          <span>/</span>
          <Link href="/workspaces/management/campgrounds/permanent-units/financing/offers">
            Financing terms
          </Link>
          <span>/</span>
          <span>Consent and disclosures</span>
        </nav>
        <section className="hero-panel">
          <p className="eyebrow">Build 095 · Manual-delivery boundary</p>
          <h1>Offer delivery consent &amp; versioned disclosures</h1>
          <p className="hero-panel__lead">
            Pin the exact disclosure document version and its SHA-256 digest,
            independently review it, record applicant-specific permission for a
            manual delivery channel, and obtain a separate office sign-off.
          </p>
          <p>
            <strong>Nothing is sent or signed here.</strong> A ready-for-handoff
            result is an internal work instruction only. It is not proof the
            applicant received, understood, accepted or signed a binding credit
            agreement. Local finance/legal personnel must validate the actual
            disclosure contents and independently complete any lawful delivery,
            acknowledgement or contract workflow.
          </p>
        </section>
        {params.saved ? (
          <p role="status" className={styles.notice}>
            {params.saved}
          </p>
        ) : null}
        {params.error ? (
          <p role="alert" className={`${styles.notice} ${styles.error}`}>
            {params.error}
          </p>
        ) : null}
        <section className="content-panel">
          <SectionHeading
            id="delivery-property"
            eyebrow="Private campground"
            title="Select property"
            helpTopic="permanent.delivery"
          />
          <form method="get" className={styles.inlineForm}>
            <label>
              Campground
              <select name="campground" defaultValue={selected.campgroundId}>
                {available.map((x) => (
                  <option key={x.campgroundId} value={x.campgroundId}>
                    {x.campgroundName}
                  </option>
                ))}
              </select>
            </label>
            <button type="submit" className="primary-button">
              Open
            </button>
          </form>
          <p>
            {data.campground.name} · {data.versions.length} disclosure
            version(s) · {data.consents.length} consent(s)
          </p>
        </section>
        <section className="content-panel">
          <SectionHeading
            id="disclosure-register"
            eyebrow="Version integrity"
            title="Register restricted disclosure version"
            helpTopic="permanent.delivery"
          />
          <form action={registerDisclosureAction} className={styles.formGrid}>
            {hidden}
            <label>
              Applicable jurisdiction
              <input
                name="jurisdiction"
                placeholder="Ontario, Canada"
                minLength={2}
                maxLength={80}
                required
              />
            </label>
            <label>
              Document version code
              <input
                name="versionCode"
                placeholder="ON-2026-01"
                minLength={3}
                maxLength={80}
                required
              />
            </label>
            <label>
              Approved private document source ID
              <input
                name="documentReference"
                minLength={8}
                maxLength={400}
                required
              />
            </label>
            <label>
              Exact document SHA-256 (64 hex characters)
              <input
                name="sha256"
                minLength={64}
                maxLength={64}
                pattern="[A-Fa-f0-9]{64}"
                required
              />
            </label>
            <label>
              Independent external legal review source
              <input
                name="legalReviewReference"
                minLength={8}
                maxLength={400}
                required
              />
            </label>
            <label>
              Version note
              <textarea
                name="note"
                minLength={12}
                maxLength={800}
                rows={2}
                required
              />
            </label>
            <button className="primary-button" type="submit">
              Register immutable version
            </button>
          </form>
          {!data.versions.length ? (
            <p>No disclosure version registered yet.</p>
          ) : null}
          {data.versions.map((v) => {
            const review = data.reviews.find((r) => r.version_id === v.id);
            return (
              <article key={v.id} className="content-panel">
                <h3>
                  {v.jurisdiction} · {v.version_code}
                </h3>
                <p>
                  <strong>Document:</strong> {v.document_reference} ·{" "}
                  <strong>SHA-256:</strong> <code>{v.content_sha256}</code>
                </p>
                <p>
                  <strong>Legal review source:</strong>{" "}
                  {v.legal_review_reference} · <strong>Status:</strong>{" "}
                  {review?.outcome ?? "Not independently reviewed"}
                </p>
                {!review ? (
                  <form
                    action={reviewDisclosureAction}
                    className={styles.formGrid}
                  >
                    {hidden}
                    <input type="hidden" name="versionId" value={v.id} />
                    <label>
                      Independent document assessment
                      <select name="outcome">
                        <option value="approved_internal_use">
                          Approve internal use
                        </option>
                        <option value="rejected">Reject version</option>
                      </select>
                    </label>
                    <label>
                      Review note
                      <textarea
                        name="note"
                        minLength={12}
                        maxLength={800}
                        required
                      />
                    </label>
                    <button className="primary-button" type="submit">
                      Record independent document review
                    </button>
                  </form>
                ) : (
                  <p>
                    <strong>Reviewer finding:</strong> {review.note}
                  </p>
                )}
              </article>
            );
          })}
        </section>
        <section className="content-panel">
          <SectionHeading
            id="consent-register"
            eyebrow="Recipient-specific"
            title="Record manual channel delivery consent"
            helpTopic="permanent.delivery"
          />
          <p>
            Use only terms already authorized for internal preparation and an
            independently approved disclosure version. Consent must be attested
            from an existing private source; this form does not contact the
            applicant.
          </p>
          <form action={consentDeliveryAction} className={styles.formGrid}>
            {hidden}
            <label>
              Internally authorized terms
              <select name="proposalId" required>
                {approvedProposals.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.buyer_display_name} · {p.id.slice(0, 8)}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Exact disclosure version
              <select name="versionId" required>
                {approvedVersions.map((v) => (
                  <option key={v.id} value={v.id}>
                    {v.jurisdiction} · {v.version_code}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Consented manual delivery channel
              <select name="channel">
                <option value="in_person">In-person staff coordination</option>
                <option value="secure_portal">
                  Verified secure portal handoff
                </option>
              </select>
            </label>
            <label>
              Applicant-specific consent record ID
              <input
                name="consentReference"
                minLength={8}
                maxLength={400}
                required
              />
            </label>
            <label>
              Verified private recipient reference
              <input
                name="recipientReference"
                minLength={8}
                maxLength={400}
                required
              />
            </label>
            <label>
              Consent scope, timestamp &amp; verification note
              <textarea
                name="note"
                minLength={12}
                maxLength={800}
                rows={2}
                required
              />
            </label>
            <button
              className="primary-button"
              type="submit"
              disabled={!approvedVersions.length || !approvedProposals.length}
            >
              Pin consent to exact document
            </button>
          </form>
        </section>
        <section className="content-panel">
          <SectionHeading
            id="handoff-register"
            eyebrow="Separate sign-off"
            title="Manual delivery readiness ledger"
            helpTopic="permanent.delivery"
          />
          {!data.consents.length ? (
            <p>No applicant consent records yet.</p>
          ) : null}
          {data.consents.map((c) => {
            const decision = data.signoffs.find((s) => s.consent_id === c.id),
              p = proposalById.get(c.proposal_id),
              v = versionById.get(c.version_id);
            return (
              <article key={c.id} className="content-panel">
                <h3>
                  {p?.buyer_display_name ?? "Applicant"} · {c.consent_channel}
                </h3>
                <p>
                  <strong>Document version:</strong>{" "}
                  {v?.version_code ?? c.version_id} · <strong>Consent:</strong>{" "}
                  {c.consent_reference} · <strong>Recipient:</strong>{" "}
                  {c.recipient_reference}
                </p>
                <p>
                  <strong>State:</strong>{" "}
                  {decision?.decision ?? "Awaiting independent manual review"}
                </p>
                {decision ? (
                  <p>
                    <strong>Decision evidence:</strong>{" "}
                    {decision.review_reference} · {decision.note}
                  </p>
                ) : (
                  <form
                    action={signoffDeliveryAction}
                    className={styles.formGrid}
                  >
                    {hidden}
                    <input type="hidden" name="consentId" value={c.id} />
                    <label>
                      Independent manual coordination decision
                      <select name="decision">
                        <option value="ready_for_manual_handoff">
                          Ready for separate manual handoff
                        </option>
                        <option value="held">Hold delivery preparation</option>
                      </select>
                    </label>
                    <label>
                      Reviewer evidence reference
                      <input
                        name="reviewReference"
                        minLength={8}
                        maxLength={400}
                        required
                      />
                    </label>
                    <label className={styles.full}>
                      Reviewer note, including external approval boundaries
                      <textarea
                        name="note"
                        minLength={12}
                        maxLength={800}
                        rows={2}
                        required
                      />
                    </label>
                    <button className="primary-button" type="submit">
                      Record independent sign-off
                    </button>
                  </form>
                )}
              </article>
            );
          })}
        </section>
      </div>
    </AppShell>
  );
}
