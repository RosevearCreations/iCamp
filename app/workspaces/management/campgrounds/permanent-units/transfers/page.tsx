import { randomUUID } from "node:crypto";
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
import { getPermanentUnitMarket } from "@/lib/permanent-unit-market/postgres.mjs";
import {
  closingSteps,
  closingProgress,
} from "@/lib/permanent-unit-transfer/core.mjs";
import { getSaleTransferDashboard } from "@/lib/permanent-unit-transfer/postgres.mjs";
import {
  openTransferAction,
  recordTransferEvidenceAction,
  reviewTransferAction,
  closeTransferAction,
} from "./actions";
import styles from "../../reservations/reservations.module.css";

export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "Permanent-unit sale and transfer review · iCamp",
  robots: { index: false, follow: false },
};
export default async function TransferPage({
  searchParams,
}: Readonly<{
  searchParams: Promise<{
    campground?: string;
    saved?: string;
    error?: string;
  }>;
}>) {
  const path = "/workspaces/management/campgrounds/permanent-units/transfers";
  const session = await requireStaff(path);
  const params = await searchParams;
  const available = (
    await Promise.all(
      (await listAssignedCampgrounds(session.user.id)).map(async (x) => ({
        ...x,
        manage: await hasCampgroundPermission(
          session.user.id,
          x.campgroundId,
          "permanent_unit.manage",
        ),
        transfer: await hasCampgroundPermission(
          session.user.id,
          x.campgroundId,
          "permanent_unit.transfer",
        ),
      })),
    )
  ).filter((x) => x.manage);
  if (!available.length) redirect("/auth/not-authorized");
  const selected =
    available.find((x) => x.campgroundId === params.campground) ?? available[0];
  const [market, data] = await Promise.all([
    getPermanentUnitMarket(session.user.id, selected.campgroundId),
    getSaleTransferDashboard(session.user.id, selected.campgroundId),
  ]);
  const listingById = new Map(market.listings.map((x) => [x.id, x]));
  const unitById = new Map(market.units.map((x) => [x.id, x]));
  return (
    <AppShell>
      <div className="page-stack">
        <nav className="breadcrumbs" aria-label="Breadcrumb">
          <Link href="/">iCamp</Link>
          <span>/</span>
          <Link href="/workspaces/management/campgrounds">Campgrounds</Link>
          <span>/</span>
          <Link href="/workspaces/management/campgrounds/permanent-units">
            Permanent units
          </Link>
          <span>/</span>
          <span>Sale transfers</span>
        </nav>
        <section className="hero-panel">
          <p className="eyebrow">
            Build 092 · Human-reviewed ownership closing
          </p>
          <h1>Permanent-unit sale &amp; transfer workflow</h1>
          <p className="hero-panel__lead">
            Open a buyer case, collect immutable inspection and closing
            evidence, obtain independent approval, then separately record a
            documented change in unit ownership.
          </p>
          <p>
            <strong>Legal and operational boundary:</strong> This desk records a
            unit-ownership handoff based on staff-provided sources. It cannot
            prove legal title, settle funds, release holds, transfer site
            ownership or automatically replace an active seasonal/annual
            occupancy assignment. Campground staff must review local agreements,
            law and signatures independently.
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
            id="transfer-scope"
            eyebrow="Authorized campground"
            title="Choose property"
            helpTopic="permanent.transfer"
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
            <button className="primary-button" type="submit">
              Open campground
            </button>
          </form>
          <p>
            {data.campground.name} · {data.campground.lifecycle_state} ·{" "}
            {data.cases.length} recent sale case(s)
          </p>
        </section>
        <section className="content-panel">
          <SectionHeading
            id="transfer-open"
            eyebrow="Buyer application"
            title="Open a source-linked sale case"
            helpTopic="permanent.transfer"
          />
          <p>
            Only a buyer inquiry against an approved listing may become a sale
            case. The database pins the seller’s current ownership evidence and
            prevents duplicate cases for one inquiry.
          </p>
          <form action={openTransferAction} className={styles.formGrid}>
            <input
              type="hidden"
              name="campgroundId"
              value={selected.campgroundId}
            />
            <input type="hidden" name="id" value={randomUUID()} />
            <label>
              Approved listing
              <select name="listingId" required>
                {market.listings
                  .filter((l) => l.listing_status === "approved")
                  .map((l) => (
                    <option key={l.id} value={l.id}>
                      {unitById.get(l.accommodation_id)?.code} · {l.headline}
                    </option>
                  ))}
              </select>
            </label>
            <label>
              Buyer inquiry (must match listing)
              <select name="inquiryId" required>
                {market.inquiries.map((i) => (
                  <option key={i.id} value={i.id}>
                    {i.buyer_display_name} ·{" "}
                    {listingById.get(i.listing_id)?.headline ?? "Historical"}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Application source reference
              <input
                name="applicationReference"
                minLength={8}
                maxLength={400}
                required
              />
            </label>
            <label className={styles.full}>
              Application verification/consent note
              <textarea
                name="applicationNote"
                minLength={12}
                maxLength={1200}
                rows={2}
                required
              />
            </label>
            <button
              type="submit"
              className="primary-button"
              disabled={!market.inquiries.length}
            >
              Open private sale case
            </button>
          </form>
        </section>
        <section className="content-panel">
          <SectionHeading
            id="transfer-cases"
            eyebrow="Immutable closeout evidence"
            title="Sale case review register"
            helpTopic="permanent.transfer"
          />
          {!data.cases.length ? (
            <p>No sale cases have been opened for this campground.</p>
          ) : null}
          {data.cases.map((c) => {
            const evidence = data.evidence.filter((e) => e.case_id === c.id);
            const decision = data.decisions.find((d) => d.case_id === c.id);
            const handoff = data.handoffs.find((h) => h.case_id === c.id);
            const progress = closingProgress(evidence, decision, handoff);
            const listing = listingById.get(c.listing_id);
            return (
              <article key={c.id} className="content-panel">
                <h3>
                  {unitById.get(c.accommodation_id)?.code ?? "Unit"} ·{" "}
                  {c.buyer_display_name} ·{" "}
                  {handoff
                    ? "Handoff recorded"
                    : (decision?.decision ?? "Under review")}
                </h3>
                <p>
                  <strong>Application:</strong> {c.application_reference} ·{" "}
                  {listing?.headline ?? "Historical listing"}
                </p>
                <div className={styles.tableWrap}>
                  <table>
                    <thead>
                      <tr>
                        <th>Required closing step</th>
                        <th>Latest status</th>
                        <th>Evidence reference</th>
                      </tr>
                    </thead>
                    <tbody>
                      {progress.steps.map((step) => (
                        <tr key={step.key}>
                          <td>{step.label}</td>
                          <td>{step.outcome}</td>
                          <td>{step.source ?? "Awaiting evidence"}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                {decision ? (
                  <p>
                    <strong>Independent decision:</strong> {decision.decision} —{" "}
                    {decision.note}
                  </p>
                ) : null}
                {handoff ? (
                  <p>
                    <strong>Closing evidence:</strong>{" "}
                    {handoff.closing_reference} · Agreement{" "}
                    {handoff.agreement_reference}. Unit owner ledger updated.
                    Separately verify any occupancy agreement changes.
                  </p>
                ) : null}
                {!decision ? (
                  <>
                    <h4>Append inspection, fee or closing evidence</h4>
                    <form
                      action={recordTransferEvidenceAction}
                      className={styles.formGrid}
                    >
                      <input
                        type="hidden"
                        name="campgroundId"
                        value={selected.campgroundId}
                      />
                      <input type="hidden" name="id" value={randomUUID()} />
                      <input type="hidden" name="caseId" value={c.id} />
                      <label>
                        Checklist step
                        <select name="stepKey">
                          {closingSteps.map((step) => (
                            <option key={step.key} value={step.key}>
                              {step.label}
                            </option>
                          ))}
                        </select>
                      </label>
                      <label>
                        Result
                        <select name="outcome">
                          <option value="pass">Pass with evidence</option>
                          <option value="defect">Defect / unresolved</option>
                        </select>
                      </label>
                      <label>
                        External fee amount (CAD, only for fee receipt)
                        <input
                          name="feeAmount"
                          inputMode="decimal"
                          placeholder="0.00"
                        />
                      </label>
                      <label>
                        Source reference
                        <input
                          name="sourceReference"
                          minLength={8}
                          maxLength={400}
                          required
                        />
                      </label>
                      <label className={styles.full}>
                        Observed evidence and verification note
                        <textarea
                          name="note"
                          minLength={12}
                          maxLength={1200}
                          rows={2}
                          required
                        />
                      </label>
                      <button className="primary-button" type="submit">
                        Record immutable evidence
                      </button>
                    </form>
                    {selected.transfer ? (
                      <>
                        <h4>Independent management decision</h4>
                        <p>
                          All six latest steps must pass. The reviewer cannot
                          have opened the case or authored any evidence.
                        </p>
                        <form
                          action={reviewTransferAction}
                          className={styles.formGrid}
                        >
                          <input
                            type="hidden"
                            name="campgroundId"
                            value={selected.campgroundId}
                          />
                          <input type="hidden" name="id" value={randomUUID()} />
                          <input type="hidden" name="caseId" value={c.id} />
                          <label>
                            Decision
                            <select name="decision">
                              <option value="approved">
                                Approve after verification
                              </option>
                              <option value="rejected">Reject and close</option>
                            </select>
                          </label>
                          <label className={styles.full}>
                            Decision basis
                            <textarea
                              name="note"
                              minLength={12}
                              maxLength={1200}
                              rows={2}
                              required
                            />
                          </label>
                          <button type="submit">
                            Record independent decision
                          </button>
                        </form>
                      </>
                    ) : null}
                  </>
                ) : null}
                {decision?.decision === "approved" &&
                !handoff &&
                selected.transfer ? (
                  <>
                    <h4>Separate final ownership handoff</h4>
                    <p>
                      Requires a third authorized operator and independently
                      verified closing/occupancy documents. This updates unit
                      ownership history only; the existing site assignment is
                      not automatically transferred.
                    </p>
                    <form
                      action={closeTransferAction}
                      className={styles.formGrid}
                    >
                      <input
                        type="hidden"
                        name="campgroundId"
                        value={selected.campgroundId}
                      />
                      <input type="hidden" name="id" value={randomUUID()} />
                      <input type="hidden" name="caseId" value={c.id} />
                      <label>
                        Replacement agreement source
                        <input
                          name="agreementReference"
                          minLength={8}
                          maxLength={400}
                          required
                        />
                      </label>
                      <label>
                        Signed closing/title evidence
                        <input
                          name="closingReference"
                          minLength={8}
                          maxLength={400}
                          required
                        />
                      </label>
                      <label className={styles.full}>
                        Final manual verification note
                        <textarea
                          name="note"
                          minLength={12}
                          maxLength={1200}
                          rows={2}
                          required
                        />
                      </label>
                      <button type="submit" className="primary-button">
                        Record approved unit owner handoff
                      </button>
                    </form>
                  </>
                ) : null}
              </article>
            );
          })}
          <p>
            Web/PWA supports the authenticated evidence and approval controls.
            IVR/DTMF/SMS may navigate or request staffed assistance but cannot
            approve a sale, accept legal documents or record final ownership
            handoff.
          </p>
        </section>
      </div>
    </AppShell>
  );
}
