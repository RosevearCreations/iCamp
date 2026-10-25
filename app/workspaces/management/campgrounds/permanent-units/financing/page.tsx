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
import {
  financingEvidenceTypes,
  financingProgress,
} from "@/lib/permanent-unit-financing/core.mjs";
import { getFinancingDashboard } from "@/lib/permanent-unit-financing/postgres.mjs";
import {
  openFinancingAction,
  recordFinancingEvidenceAction,
  triageFinancingAction,
} from "./actions";
import styles from "../../reservations/reservations.module.css";

export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "Office financing intake · iCamp",
  robots: { index: false, follow: false },
};
export default async function FinancingPage({
  searchParams,
}: Readonly<{
  searchParams: Promise<{
    campground?: string;
    saved?: string;
    error?: string;
  }>;
}>) {
  const path = "/workspaces/management/campgrounds/permanent-units/financing";
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
  const data = await getFinancingDashboard(
    session.user.id,
    selected.campgroundId,
  );
  return (
    <AppShell>
      <div className="page-stack">
        <nav className="breadcrumbs" aria-label="Breadcrumb">
          <Link href="/">iCamp</Link>
          <span>/</span>
          <Link href="/workspaces/management/campgrounds/permanent-units">
            Permanent units
          </Link>
          <span>/</span>
          <span>Office financing</span>
        </nav>
        <section className="hero-panel">
          <p className="eyebrow">Build 093 · Confidential staff intake</p>
          <h1>Office financing application intake</h1>
          <p className="hero-panel__lead">
            Record applicant consent, requested CAD financing, and secure
            document references against a current unit-sale case. Independently
            triage completeness before any external financing review.
          </p>
          <p>
            <strong>No credit decision:</strong> This is not a lender, loan
            agreement, credit check, interest-rate quote, funding approval,
            payment collection, or permission to transfer a unit. Do not enter
            SINs, bank account numbers, income figures, credit reports, or
            sensitive document contents here. Keep them only in separately
            approved secure systems.
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
            id="financing-scope"
            eyebrow="Access restricted"
            title="Financing intake property"
            helpTopic="permanent.financing"
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
            {data.campground.name} · {data.applications.length} private
            applications
          </p>
        </section>
        <section className="content-panel">
          <SectionHeading
            id="financing-open"
            eyebrow="Consent first"
            title="Open financing application"
            helpTopic="permanent.financing"
          />
          <form action={openFinancingAction} className={styles.formGrid}>
            <input
              type="hidden"
              name="campgroundId"
              value={selected.campgroundId}
            />
            <label>
              Related unit-sale case
              <select name="caseId" required>
                {data.cases.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.buyer_display_name} · {c.application_reference}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Requested amount (CAD)
              <input
                name="requestedAmount"
                inputMode="decimal"
                placeholder="15000.00"
                required
              />
            </label>
            <label>
              Approved private CRM contact reference
              <input
                name="contactReference"
                minLength={8}
                maxLength={400}
                required
              />
            </label>
            <label>
              Signed applicant consent source reference
              <input
                name="consentReference"
                minLength={8}
                maxLength={400}
                required
              />
            </label>
            <label className={styles.full}>
              Purpose and contextual note (no private financial details)
              <textarea
                name="purposeNote"
                minLength={12}
                maxLength={800}
                rows={2}
                required
              />
            </label>
            <label className={styles.full}>
              <input type="checkbox" name="consentAttested" required /> I
              verified explicit applicant consent for this intake and recorded
              its restricted source reference.
            </label>
            <button
              className="primary-button"
              type="submit"
              disabled={!data.cases.length}
            >
              Record private application
            </button>
          </form>
        </section>
        <section className="content-panel">
          <SectionHeading
            id="financing-review"
            eyebrow="Independent triage"
            title="Financing application register"
            helpTopic="permanent.financing"
          />
          {!data.applications.length ? (
            <p>No financing applications yet.</p>
          ) : null}
          {data.applications.map((a) => {
            const entries = data.evidence.filter(
                (e) => e.application_id === a.id,
              ),
              decision = data.triage.find((t) => t.application_id === a.id),
              progress = financingProgress(entries, decision);
            const sale = data.cases.find((c) => c.id === a.sale_case_id);
            return (
              <article className="content-panel" key={a.id}>
                <h3>
                  {sale?.buyer_display_name ?? "Sale case"} · CAD $
                  {(Number(a.requested_amount_cents) / 100).toFixed(2)}
                </h3>
                <p>
                  <strong>Consent evidence:</strong> {a.consent_reference} ·{" "}
                  <strong>Private contact:</strong>{" "}
                  {a.applicant_contact_reference}
                </p>
                <p>
                  <strong>Status:</strong> {progress.triage} ·{" "}
                  {progress.complete
                    ? "Four categories received"
                    : "Evidence incomplete"}
                </p>
                <div className={styles.tableWrap}>
                  <table>
                    <thead>
                      <tr>
                        <th>Document category</th>
                        <th>Latest status</th>
                        <th>Secure source reference</th>
                      </tr>
                    </thead>
                    <tbody>
                      {progress.requirements.map((x) => (
                        <tr key={x.key}>
                          <td>{x.label}</td>
                          <td>{x.outcome}</td>
                          <td>{x.source ?? "Missing"}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                {!decision ? (
                  <>
                    <form
                      action={recordFinancingEvidenceAction}
                      className={styles.formGrid}
                    >
                      <input
                        type="hidden"
                        name="campgroundId"
                        value={selected.campgroundId}
                      />
                      <input type="hidden" name="applicationId" value={a.id} />
                      <label>
                        Evidence category
                        <select name="documentType">
                          {financingEvidenceTypes.map((x) => (
                            <option key={x.key} value={x.key}>
                              {x.label}
                            </option>
                          ))}
                        </select>
                      </label>
                      <label>
                        Observed status
                        <select name="outcome">
                          <option value="received">Received securely</option>
                          <option value="defect">Missing/defective</option>
                        </select>
                      </label>
                      <label>
                        Restricted document reference
                        <input
                          name="sourceReference"
                          minLength={8}
                          maxLength={400}
                          required
                        />
                      </label>
                      <label>
                        Factual note (no document contents)
                        <textarea
                          name="note"
                          minLength={12}
                          maxLength={800}
                          required
                        />
                      </label>
                      <button type="submit" className="primary-button">
                        Record evidence
                      </button>
                    </form>
                    <form
                      action={triageFinancingAction}
                      className={styles.formGrid}
                    >
                      <input
                        type="hidden"
                        name="campgroundId"
                        value={selected.campgroundId}
                      />
                      <input type="hidden" name="applicationId" value={a.id} />
                      <label>
                        Independent review outcome
                        <select name="decision">
                          <option value="complete_for_external_review">
                            Complete for external review only
                          </option>
                          <option value="returned_incomplete">
                            Return incomplete
                          </option>
                          <option value="withdrawn">Withdrawn</option>
                        </select>
                      </label>
                      <label>
                        Reviewer note
                        <textarea
                          name="note"
                          minLength={12}
                          maxLength={800}
                          required
                        />
                      </label>
                      <button type="submit" className="primary-button">
                        Record triage
                      </button>
                    </form>
                  </>
                ) : (
                  <p>
                    <strong>Final intake triage:</strong> {decision.decision} —{" "}
                    {decision.note}
                  </p>
                )}
              </article>
            );
          })}
        </section>
      </div>
    </AppShell>
  );
}
