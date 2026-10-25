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
import { getOfferDashboard } from "@/lib/permanent-unit-offers/postgres.mjs";
import { draftOfferAction, reviewOfferAction } from "./actions";
import styles from "../../../reservations/reservations.module.css";

export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "Financing terms authorization · iCamp",
  robots: { index: false, follow: false },
};
const money = (value: string | number) =>
  (Number(value) / 100).toLocaleString("en-CA", {
    style: "currency",
    currency: "CAD",
  });
export default async function OffersPage({
  searchParams,
}: Readonly<{
  searchParams: Promise<{
    campground?: string;
    saved?: string;
    error?: string;
  }>;
}>) {
  const path =
    "/workspaces/management/campgrounds/permanent-units/financing/offers";
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
  const data = await getOfferDashboard(session.user.id, selected.campgroundId);
  const ready = data.applications.filter((a) =>
    data.triage.some(
      (t) =>
        t.application_id === a.id &&
        t.decision === "complete_for_external_review",
    ),
  );
  const applicationById = new Map(data.applications.map((a) => [a.id, a]));
  return (
    <AppShell>
      <div className="page-stack">
        <nav className="breadcrumbs" aria-label="Breadcrumb">
          <Link href="/">iCamp</Link>
          <span>/</span>
          <Link href="/workspaces/management/campgrounds/permanent-units/financing">
            Office financing
          </Link>
          <span>/</span>
          <span>Terms review</span>
        </nav>
        <section className="hero-panel">
          <p className="eyebrow">Build 094 · Internal terms governance</p>
          <h1>Financing terms &amp; independent offer authorization</h1>
          <p className="hero-panel__lead">
            Draft a versioned, non-binding repayment illustration, then have a
            different authorized officer check its policy and disclosure
            references. Approval permits internal preparation only.
          </p>
          <p>
            <strong>Not a lending offer:</strong> Estimated installments use an
            illustrative nominal annual rate and monthly compounding assumption,
            excluding separate fees, taxes and other charges. No customer
            delivery, legal disclosure validation, credit decision, signature,
            payment, disbursement or unit transfer occurs here. Applicable law
            and actual lender terms must be independently reviewed.
          </p>
          <p>
            <Link
              href={`/workspaces/management/campgrounds/permanent-units/financing/delivery?campground=${encodeURIComponent(selected.campgroundId)}`}
            >
              Open Build 095 · Applicant delivery consent and versioned
              disclosure sign-off
            </Link>
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
            id="offers-campground"
            eyebrow="Private management"
            title="Select campground"
            helpTopic="permanent.offers"
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
            {data.campground.name} · {data.proposals.length} recent private term
            proposals
          </p>
        </section>
        <section className="content-panel">
          <SectionHeading
            id="offers-draft"
            eyebrow="Immutable draft"
            title="Prepare internal terms illustration"
            helpTopic="permanent.offers"
          />
          <form action={draftOfferAction} className={styles.formGrid}>
            <input
              type="hidden"
              name="campgroundId"
              value={selected.campgroundId}
            />
            <label>
              Completed financing intake
              <select name="applicationId" required>
                {ready.map((x) => (
                  <option key={x.id} value={x.id}>
                    {x.buyer_display_name} · requested{" "}
                    {money(x.requested_amount_cents)}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Proposed principal (CAD; at most requested amount)
              <input
                name="principal"
                inputMode="decimal"
                placeholder="15000.00"
                required
              />
            </label>
            <label>
              Annual nominal rate (basis points; 100 = 1%)
              <input
                name="annualRateBps"
                type="number"
                min={0}
                max={6000}
                step={1}
                required
              />
            </label>
            <label>
              Term (months)
              <input
                name="months"
                type="number"
                min={1}
                max={240}
                step={1}
                required
              />
            </label>
            <label>
              Separate upfront fee (CAD, 0 allowed)
              <input name="fee" inputMode="decimal" defaultValue="0" required />
            </label>
            <label>
              Office financing policy source ID
              <input
                name="policyReference"
                minLength={8}
                maxLength={400}
                required
              />
            </label>
            <label>
              Jurisdiction-specific disclosure template source ID
              <input
                name="disclosureReference"
                minLength={8}
                maxLength={400}
                required
              />
            </label>
            <label className={styles.full}>
              Operator note (internal, no private banking data)
              <textarea
                name="note"
                minLength={12}
                maxLength={800}
                required
                rows={2}
              />
            </label>
            <button
              type="submit"
              className="primary-button"
              disabled={!ready.length}
            >
              Record non-binding terms draft
            </button>
          </form>
        </section>
        <section className="content-panel">
          <SectionHeading
            id="offers-review"
            eyebrow="Independent review"
            title="Versioned terms and authorization history"
            helpTopic="permanent.offers"
          />
          {!data.proposals.length ? (
            <p>No term proposals have been drafted.</p>
          ) : null}
          {data.proposals.map((p) => {
            const decision = data.decisions.find((d) => d.proposal_id === p.id),
              app = applicationById.get(p.application_id);
            return (
              <article key={p.id} className="content-panel">
                <h3>
                  {app?.buyer_display_name ?? "Financing application"} ·{" "}
                  {money(p.principal_cents)} principal
                </h3>
                <p>
                  <strong>Illustrative terms:</strong>{" "}
                  {(p.annual_rate_bps / 100).toFixed(2)}% nominal annual ·{" "}
                  {p.term_months} months · about{" "}
                  {money(p.estimated_monthly_cents)} monthly (principal and
                  interest only) · separate fee {money(p.upfront_fee_cents)}
                </p>
                <p>
                  <strong>Sources:</strong> Policy {p.policy_reference} ·
                  Disclosure {p.disclosure_reference}
                </p>
                <p>
                  <strong>Status:</strong>{" "}
                  {decision?.decision ?? "Awaiting independent office review"}
                </p>
                {decision ? (
                  <p>
                    <strong>Review evidence:</strong>{" "}
                    {decision.external_review_reference} · {decision.note}
                  </p>
                ) : (
                  <form action={reviewOfferAction} className={styles.formGrid}>
                    <input
                      type="hidden"
                      name="campgroundId"
                      value={selected.campgroundId}
                    />
                    <input type="hidden" name="proposalId" value={p.id} />
                    <label>
                      Independent authorization decision
                      <select name="decision">
                        <option value="authorized_internal_preparation">
                          Authorize internal preparation only
                        </option>
                        <option value="rejected">Reject terms draft</option>
                      </select>
                    </label>
                    <label>
                      External policy/credit-review evidence ID
                      <input
                        name="externalReviewReference"
                        minLength={8}
                        maxLength={400}
                        required
                      />
                    </label>
                    <label className={styles.full}>
                      Reviewer rationale (no credit results here)
                      <textarea
                        name="note"
                        minLength={12}
                        maxLength={800}
                        rows={2}
                        required
                      />
                    </label>
                    <button type="submit" className="primary-button">
                      Record independent decision
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
