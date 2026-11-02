import { randomUUID } from "node:crypto";
import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { AppShell } from "@/components/app-shell";
import { SectionHeading } from "@/components/section-heading";
import { requireStaff } from "@/lib/auth/current-session";
import { listAssignedCampgrounds } from "@/lib/authz/postgres.mjs";
import { vendorCategories, vendorEventKinds } from "@/lib/vendors/core.mjs";
import {
  getVendorDashboard,
  getVendorPermissions,
} from "@/lib/vendors/postgres.mjs";
import {
  createVendorAction,
  createVendorContractAction,
  createVendorRecurringAction,
  createVendorRequestAction,
  recordVendorEventAction,
} from "./actions";
import styles from "./vendors.module.css";

export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "Vendor service requests & contracts · iCamp",
  robots: { index: false, follow: false },
};
const pretty = (name: string) =>
  name.replaceAll("_", " ").replace(/\b\w/gu, (s) => s.toUpperCase());
const localTime = (value: string, timezone: string) => {
  try {
    return new Intl.DateTimeFormat("en-CA", {
      timeZone: timezone,
      dateStyle: "medium",
      timeStyle: "short",
    }).format(new Date(value));
  } catch {
    return new Date(value).toISOString().slice(0, 16) + " UTC";
  }
};
function Scope({ campgroundId }: Readonly<{ campgroundId: string }>) {
  return <input name="campgroundId" type="hidden" value={campgroundId} />;
}
function Id() {
  return <input name="id" type="hidden" value={randomUUID()} />;
}
function OptionalChoice({
  items,
  label,
}: Readonly<{ items: Array<{ id: string; label: string }>; label: string }>) {
  return (
    <>
      <option value="">{label}</option>
      {items.map((item) => (
        <option key={item.id} value={item.id}>
          {item.label}
        </option>
      ))}
    </>
  );
}

export default async function VendorWorkboard({
  searchParams,
}: Readonly<{
  searchParams: Promise<{
    campground?: string;
    saved?: string;
    vendor?: string;
    view?: string;
  }>;
}>) {
  const path = "/workspaces/management/campgrounds/vendors";
  const session = await requireStaff(path);
  const params = await searchParams;
  const assigned = await listAssignedCampgrounds(session.user.id);
  const allowed = (
    await Promise.all(
      assigned.map(async (camp) => ({
        ...camp,
        permissions: await getVendorPermissions(
          session.user.id,
          camp.campgroundId,
        ),
      })),
    )
  ).filter((camp) => Object.values(camp.permissions).some(Boolean));
  if (!allowed.length) redirect("/auth/not-authorized");
  const selected =
    allowed.find((camp) => camp.campgroundId === params.campground) ??
    allowed[0];
  const data = await getVendorDashboard(session.user.id, selected.campgroundId);
  const {
    campground,
    permissions,
    vendors,
    contracts,
    recurringPlans,
    requests,
    events,
    documents,
    workOrders,
  } = data;
  const vendorLabel = (id: string) =>
    vendors.find((v) => v.id === id)?.displayName ?? "Restricted vendor";
  const activeContracts = contracts.filter(
    (c) => !c.readiness.superseded && c.readiness.flag !== "expired",
  );
  const activePlans = recurringPlans.filter((p) => !p.readiness.superseded);
  const awaitingInvoice = events.filter(
    (e) =>
      e.kind === "invoice_intake" &&
      !events.some(
        (r) => r.kind === "invoice_reviewed" && r.reviewsEventId === e.id,
      ),
  );
  const contractFlags = contracts.filter(
    (c) =>
      !c.readiness.superseded &&
      ["expired", "expires_soon"].includes(c.readiness.flag),
  );
  const planFlags = recurringPlans.filter(
    (p) =>
      !p.readiness.superseded &&
      ["due_overdue", "due_soon"].includes(p.readiness.flag),
  );
  const requestFlags = requests.filter((r) =>
    r.readiness.flags.some((f) =>
      ["response_overdue", "completion_overdue"].includes(f),
    ),
  );
  const filterVendor = vendors.some((v) => v.id === params.vendor)
    ? params.vendor
    : "all";
  const filterView = ["all", "attention", "open"].includes(params.view ?? "")
    ? params.view
    : "all";
  const visibleRequests = requests.filter(
    (r) =>
      (filterVendor === "all" || r.vendorId === filterVendor) &&
      (filterView !== "attention" || r.readiness.flags.length > 0) &&
      (filterView !== "open" || !r.readiness.closed),
  );
  return (
    <AppShell>
      <div className="page-stack">
        <nav className="breadcrumbs" aria-label="Breadcrumb">
          <Link href="/">iCamp</Link>
          <span aria-hidden="true">/</span>
          <Link href="/workspaces/management/campgrounds">Campgrounds</Link>
          <span aria-hidden="true">/</span>
          <span>Vendor services</span>
        </nav>
        <section className="hero-panel">
          <p className="eyebrow">Build 191 · Private supplier operations</p>
          <h1>Vendor service requests, contracts &amp; SLA follow-up</h1>
          <p className="hero-panel__lead">
            Track external waste, septic, repair, grounds and infrastructure
            services against real contracts and owner-set follow-up targets.
          </p>
          <p>
            <strong>Authorization boundary:</strong> Every entry is internal
            evidence or a draft request. Nothing contacts a vendor, creates a
            purchase order, authorizes an invoice, processes a payment or
            dispatches a provider. Billing and Omnichannel remain HELD.
          </p>
        </section>
        {params.saved ? (
          <p
            className={
              params.saved.startsWith("Not saved")
                ? styles.error
                : styles.notice
            }
            role="status"
          >
            {params.saved}
          </p>
        ) : null}
        <section className="content-panel">
          <SectionHeading
            id="vendor-property"
            title="Private campground vendor scope"
            eyebrow="Staff permissions and audited records"
            helpTopic="shell.overview"
          />
          <form method="get" className={styles.inline}>
            <label>
              Campground
              <select name="campground" defaultValue={selected.campgroundId}>
                {allowed.map((c) => (
                  <option key={c.campgroundId} value={c.campgroundId}>
                    {c.campgroundName}
                  </option>
                ))}
              </select>
            </label>
            <button className="primary-button" type="submit">
              Open vendor workboard
            </button>
          </form>
          <div className={styles.metrics}>
            <div>
              <strong>{vendors.length}</strong>
              <span>Restricted vendor profiles</span>
            </div>
            <div>
              <strong>{contractFlags.length}</strong>
              <span>Expiring / expired contracts</span>
            </div>
            <div>
              <strong>{planFlags.length}</strong>
              <span>Upcoming / overdue reminders</span>
            </div>
            <div>
              <strong>{requestFlags.length + awaitingInvoice.length}</strong>
              <span>SLA and invoice-review attention</span>
            </div>
          </div>
        </section>

        {permissions.manage ? (
          <section className="content-panel">
            <SectionHeading
              id="vendor-register"
              title="Register a restricted supplier profile"
              eyebrow="Manager · no contact sent"
              helpTopic="shell.overview"
            />
            <form action={createVendorAction} className={styles.form}>
              <Scope campgroundId={campground.id} />
              <Id />
              <label>
                Vendor name
                <input
                  name="displayName"
                  minLength={3}
                  maxLength={160}
                  required
                  placeholder="Local septic service provider"
                />
              </label>
              <label>
                Service category
                <select name="serviceCategory">
                  {vendorCategories.map((c) => (
                    <option key={c} value={c}>
                      {pretty(c)}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                Contact name (private)
                <input name="contactName" maxLength={160} autoComplete="off" />
              </label>
              <label>
                Contact email (private)
                <input
                  name="contactEmail"
                  type="email"
                  maxLength={254}
                  autoComplete="off"
                />
              </label>
              <label>
                Contact phone (private)
                <input
                  name="contactPhone"
                  type="tel"
                  maxLength={40}
                  autoComplete="off"
                />
              </label>
              <label className={styles.wide}>
                Internal sourcing note
                <textarea
                  name="privateNote"
                  minLength={12}
                  maxLength={1000}
                  required
                  placeholder="How this supplier was identified and what must be verified before engagement"
                />
              </label>
              <button className="primary-button" type="submit">
                Save restricted profile
              </button>
            </form>
          </section>
        ) : null}

        {permissions.manage ? (
          <section className="content-panel">
            <SectionHeading
              id="vendor-contract"
              title="Record contract and response targets"
              eyebrow="Manager · documented SLA"
              helpTopic="shell.overview"
            />
            <p>
              Attach an existing active, validated confidential PDF if
              available. Renewing creates a new immutable contract snapshot
              linked to the prior one. No vendor signature or legal acceptance
              is inferred.
            </p>
            <form action={createVendorContractAction} className={styles.form}>
              <Scope campgroundId={campground.id} />
              <Id />
              <label>
                Supplier
                <select name="vendorId" required defaultValue="">
                  <option value="" disabled>
                    Choose registered vendor
                  </option>
                  {vendors.map((v) => (
                    <option key={v.id} value={v.id}>
                      {v.displayName}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                Supersedes contract (renewal)
                <select name="supersedesContractId">
                  <OptionalChoice
                    label="New contract"
                    items={activeContracts.map((c) => ({
                      id: c.id,
                      label:
                        vendorLabel(c.vendorId) + " · " + c.contractReference,
                    }))}
                  />
                </select>
              </label>
              <label>
                Contract/source reference
                <input
                  name="contractReference"
                  required
                  minLength={8}
                  maxLength={120}
                  placeholder="Vendor-agreement reference"
                />
              </label>
              <label>
                Contract title
                <input name="title" required minLength={8} maxLength={200} />
              </label>
              <label>
                Effective date
                <input name="validFrom" type="date" required />
              </label>
              <label>
                Expiry date
                <input name="expiresOn" type="date" required />
              </label>
              <label>
                Target response (hours)
                <input
                  name="responseTargetHours"
                  type="number"
                  min="1"
                  max="168"
                  defaultValue="24"
                  required
                />
              </label>
              <label>
                Target completion (days)
                <input
                  name="completionTargetDays"
                  type="number"
                  min="1"
                  max="180"
                  defaultValue="7"
                  required
                />
              </label>
              <label className={styles.wide}>
                Validated confidential contract document
                <select name="documentMediaId">
                  <OptionalChoice
                    label="No document selected — source reference retained"
                    items={documents}
                  />
                </select>
              </label>
              <label className={styles.wide}>
                Contract source and review note
                <textarea
                  name="privateNote"
                  required
                  minLength={12}
                  maxLength={1500}
                  placeholder="Summarize the source reviewed, scope, obligations and any outstanding legal verification"
                />
              </label>
              <button
                className="primary-button"
                type="submit"
                disabled={!vendors.length}
              >
                Record immutable contract
              </button>
            </form>
          </section>
        ) : null}

        {permissions.manage ? (
          <section className="content-panel">
            <SectionHeading
              id="vendor-recurring"
              title="Recurring service planning"
              eyebrow="Internal reminders only"
              helpTopic="shell.overview"
            />
            <p>
              The next due date and cadence are tracked for follow-up. The
              system never sends a recurring order or automatically claims a
              service visit occurred. Replace an old plan to revise its schedule
              without erasing history.
            </p>
            <form action={createVendorRecurringAction} className={styles.form}>
              <Scope campgroundId={campground.id} />
              <Id />
              <label>
                Supplier
                <select name="vendorId" required defaultValue="">
                  <option value="" disabled>
                    Choose vendor
                  </option>
                  {vendors.map((v) => (
                    <option key={v.id} value={v.id}>
                      {v.displayName}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                Associated contract
                <select name="contractId">
                  <OptionalChoice
                    label="No contract association"
                    items={activeContracts.map((c) => ({
                      id: c.id,
                      label:
                        vendorLabel(c.vendorId) + " · " + c.contractReference,
                    }))}
                  />
                </select>
              </label>
              <label>
                Replace recurring plan
                <select name="supersedesPlanId">
                  <OptionalChoice
                    label="New recurring reminder"
                    items={activePlans.map((p) => ({
                      id: p.id,
                      label: vendorLabel(p.vendorId) + " · " + p.serviceLabel,
                    }))}
                  />
                </select>
              </label>
              <label>
                Service label
                <input
                  name="serviceLabel"
                  required
                  minLength={8}
                  maxLength={160}
                  placeholder="Monthly waste pickup review"
                />
              </label>
              <label>
                Repeat every (days)
                <input
                  name="cadenceDays"
                  type="number"
                  min="1"
                  max="365"
                  defaultValue="30"
                  required
                />
              </label>
              <label>
                Next service due
                <input name="nextDueOn" type="date" required />
              </label>
              <label className={styles.wide}>
                Planning note
                <textarea
                  name="privateNote"
                  minLength={12}
                  maxLength={1000}
                  required
                  placeholder="Seasonality, on-site access constraints and who must verify completion"
                />
              </label>
              <button
                className="primary-button"
                type="submit"
                disabled={!vendors.length}
              >
                Save recurring reminder
              </button>
            </form>
          </section>
        ) : null}

        {permissions.manage ? (
          <section className="content-panel">
            <SectionHeading
              id="vendor-request"
              title="Log an internal vendor service request"
              eyebrow="Owner-set SLA · source work-order link"
              helpTopic="shell.overview"
            />
            <p>
              When a current contract is chosen, its recorded SLA targets
              override these input targets. Without a contract, the manager
              defines both targets. Work-order links remain in the original
              campground; no external order is sent.
            </p>
            <form action={createVendorRequestAction} className={styles.form}>
              <Scope campgroundId={campground.id} />
              <Id />
              <label>
                Supplier
                <select name="vendorId" required defaultValue="">
                  <option value="" disabled>
                    Choose vendor
                  </option>
                  {vendors.map((v) => (
                    <option key={v.id} value={v.id}>
                      {v.displayName}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                Current contract
                <select name="contractId">
                  <OptionalChoice
                    label="Ad hoc request — manager-set targets"
                    items={activeContracts.map((c) => ({
                      id: c.id,
                      label:
                        vendorLabel(c.vendorId) + " · " + c.contractReference,
                    }))}
                  />
                </select>
              </label>
              <label>
                Recurring plan
                <select name="recurringPlanId">
                  <OptionalChoice
                    label="No recurring plan link"
                    items={activePlans.map((p) => ({
                      id: p.id,
                      label: vendorLabel(p.vendorId) + " · " + p.serviceLabel,
                    }))}
                  />
                </select>
              </label>
              <label>
                Maintenance work order
                <select name="workOrderId">
                  <OptionalChoice
                    label="No work order link"
                    items={workOrders}
                  />
                </select>
              </label>
              <label>
                Response target (hours)
                <input
                  name="responseTargetHours"
                  type="number"
                  min="1"
                  max="168"
                  defaultValue="24"
                  required
                />
              </label>
              <label>
                Completion target (days)
                <input
                  name="completionTargetDays"
                  type="number"
                  min="1"
                  max="180"
                  defaultValue="7"
                  required
                />
              </label>
              <label className={styles.wide}>
                Request title
                <input name="title" required minLength={8} maxLength={180} />
              </label>
              <label className={styles.wide}>
                Service details and owner approval context
                <textarea
                  name="requestDescription"
                  required
                  minLength={20}
                  maxLength={2000}
                  placeholder="Scope, reason, location and what must happen before any supplier contact or purchase"
                />
              </label>
              <button
                className="primary-button"
                type="submit"
                disabled={!vendors.length}
              >
                Create internal request (no dispatch)
              </button>
            </form>
          </section>
        ) : null}

        <section className="content-panel">
          <SectionHeading
            id="vendor-profiles"
            title="Restricted vendor directory"
            eyebrow="Property-only contact and sourcing records"
            helpTopic="shell.overview"
          />
          <div className={styles.cards}>
            {vendors.length ? (
              vendors.map((v) => (
                <article className={styles.card} key={v.id}>
                  <p className={styles.kicker}>{pretty(v.serviceCategory)}</p>
                  <h3>{v.displayName}</h3>
                  <p>
                    {v.contactName ?? "Contact not recorded"}
                    {v.contactEmail ? " · " + v.contactEmail : ""}
                    {v.contactPhone ? " · " + v.contactPhone : ""}
                  </p>
                  <p>{v.privateNote}</p>
                </article>
              ))
            ) : (
              <p>No supplier profiles registered for this campground.</p>
            )}
          </div>
        </section>

        <section className="content-panel">
          <SectionHeading
            id="vendor-contracts"
            title="Contract expiry &amp; SLA ledger"
            eyebrow="No inferred agreement acceptance"
            helpTopic="shell.overview"
          />
          <div className={styles.cards}>
            {contracts.length ? (
              contracts.map((c) => (
                <article className={styles.card} key={c.id}>
                  <div className={styles.cardHead}>
                    <h3>{c.title}</h3>
                    <span
                      className={
                        c.readiness.flag === "current"
                          ? styles.good
                          : styles.warn
                      }
                    >
                      {pretty(c.readiness.flag)}
                    </span>
                  </div>
                  <p>
                    <strong>{vendorLabel(c.vendorId)}</strong> · Reference{" "}
                    {c.contractReference}
                  </p>
                  <p>
                    Effective {c.validFrom} · Expires {c.expiresOn} · Target:{" "}
                    {c.responseTargetHours}h response / {c.completionTargetDays}
                    d completion
                  </p>
                  <p>{c.privateNote}</p>
                  {c.documentMediaId ? (
                    <p>
                      Confidential PDF:{" "}
                      <Link
                        href={`/api/media/${c.documentMediaId}/access`}
                        prefetch={false}
                      >
                        Request authenticated signed document access
                      </Link>
                    </p>
                  ) : (
                    <p>No protected PDF linked; source reference preserved.</p>
                  )}
                </article>
              ))
            ) : (
              <p>No contract source snapshots recorded.</p>
            )}
          </div>
        </section>

        <section className="content-panel">
          <SectionHeading
            id="vendor-plans"
            title="Recurring service reminders"
            eyebrow="Due / overdue awareness, no automated order"
            helpTopic="shell.overview"
          />
          <div className={styles.cards}>
            {recurringPlans.length ? (
              recurringPlans.map((p) => (
                <article className={styles.card} key={p.id}>
                  <div className={styles.cardHead}>
                    <h3>{p.serviceLabel}</h3>
                    <span
                      className={
                        p.readiness.flag === "planned"
                          ? styles.good
                          : styles.warn
                      }
                    >
                      {pretty(p.readiness.flag)}
                    </span>
                  </div>
                  <p>
                    <strong>{vendorLabel(p.vendorId)}</strong> · Every{" "}
                    {p.cadenceDays} days · Next due {p.nextDueOn}
                  </p>
                  <p>{p.privateNote}</p>
                </article>
              ))
            ) : (
              <p>No recurring internal reminders yet.</p>
            )}
          </div>
        </section>

        <section className="content-panel">
          <SectionHeading
            id="vendor-requests"
            title="SLA requests &amp; follow-up evidence"
            eyebrow="No outgoing purchase orders or dispatch"
            helpTopic="shell.overview"
          />
          <form method="get" className={styles.inline}>
            <input type="hidden" name="campground" value={campground.id} />
            <label>
              Supplier
              <select name="vendor" defaultValue={filterVendor}>
                <option value="all">All suppliers</option>
                {vendors.map((v) => (
                  <option key={v.id} value={v.id}>
                    {v.displayName}
                  </option>
                ))}
              </select>
            </label>
            <label>
              View
              <select name="view" defaultValue={filterView}>
                <option value="all">All recorded requests</option>
                <option value="attention">Attention / exceptions</option>
                <option value="open">Open requests</option>
              </select>
            </label>
            <button className="primary-button" type="submit">
              Apply filters
            </button>
          </form>
          <div className={styles.cards}>
            {visibleRequests.length ? (
              visibleRequests.map((r) => (
                <article className={styles.card} key={r.id}>
                  <div className={styles.cardHead}>
                    <div>
                      <p className={styles.kicker}>{vendorLabel(r.vendorId)}</p>
                      <h3>{r.title}</h3>
                    </div>
                    <span
                      className={
                        r.readiness.flags.some((f) => f.includes("overdue"))
                          ? styles.warn
                          : styles.good
                      }
                    >
                      {pretty(r.readiness.status)}
                    </span>
                  </div>
                  <p>{r.requestDescription}</p>
                  <p>
                    Logged {localTime(r.requestedAt, campground.timezone)} ·
                    Response due{" "}
                    {localTime(r.responseDueAt, campground.timezone)} ·
                    Completion due{" "}
                    {localTime(r.completionDueAt, campground.timezone)}
                  </p>
                  <p>
                    Source links:{" "}
                    {r.contractId
                      ? "Contract " +
                        (contracts.find((c) => c.id === r.contractId)
                          ?.contractReference ?? "restricted")
                      : "No contract"}{" "}
                    ·{" "}
                    {r.workOrderId
                      ? "Work order " + r.workOrderId
                      : "No work order"}{" "}
                    · {r.recurringPlanId ? "Recurring plan linked" : "Ad hoc"}
                  </p>
                  {r.readiness.flags.length ? (
                    <ul className={styles.flags}>
                      {r.readiness.flags.map((flag) => (
                        <li key={flag}>{pretty(flag)}</li>
                      ))}
                    </ul>
                  ) : (
                    <p className={styles.goodText}>
                      No current SLA or invoice intake flags.
                    </p>
                  )}
                  <h4>Recorded follow-up timeline</h4>
                  <ol className={styles.timeline}>
                    {events
                      .filter((e) => e.requestId === r.id)
                      .reverse()
                      .map((e) => (
                        <li key={e.id}>
                          <strong>{pretty(e.kind)}</strong> ·{" "}
                          {localTime(e.recordedAt, campground.timezone)}
                          <p>{e.note}</p>
                          {e.sourceReference ? (
                            <p>Source reference: {e.sourceReference}</p>
                          ) : null}
                          {e.evidenceMediaId ? (
                            <p>
                              Confidential attachment:{" "}
                              <Link
                                href={`/api/media/${e.evidenceMediaId}/access`}
                                prefetch={false}
                              >
                                Authenticated access descriptor
                              </Link>
                            </p>
                          ) : null}
                        </li>
                      ))}
                  </ol>
                </article>
              ))
            ) : (
              <p>No service requests match this private filter.</p>
            )}
          </div>
        </section>

        {permissions.manage ? (
          <section className="content-panel">
            <SectionHeading
              id="vendor-event"
              title="Record a source-backed service update"
              eyebrow="Manager · immutable evidence"
              helpTopic="shell.overview"
            />
            <p>
              Vendor responses, completion claims and invoice intakes require an
              actual external source or invoice reference. A note alone does not
              send a request, approve charges or prove a provider performed
              work.
            </p>
            <form action={recordVendorEventAction} className={styles.form}>
              <Scope campgroundId={campground.id} />
              <Id />
              <label>
                Internal request
                <select name="requestId" required defaultValue="">
                  <option value="" disabled>
                    Choose request
                  </option>
                  {requests.map((r) => (
                    <option key={r.id} value={r.id}>
                      {vendorLabel(r.vendorId)} · {r.title}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                Evidence action
                <select name="kind" required>
                  {vendorEventKinds
                    .filter((k) => k !== "invoice_reviewed")
                    .map((k) => (
                      <option key={k} value={k}>
                        {pretty(k)}
                      </option>
                    ))}
                </select>
              </label>
              <label>
                External/source or invoice reference
                <input
                  name="sourceReference"
                  minLength={8}
                  maxLength={200}
                  placeholder="Required for response, completion and invoice intake"
                />
              </label>
              <label>
                Validated confidential evidence (optional)
                <select name="evidenceMediaId">
                  <OptionalChoice label="No attachment" items={documents} />
                </select>
              </label>
              <label className={styles.wide}>
                Evidence and follow-up note
                <textarea
                  name="note"
                  required
                  minLength={20}
                  maxLength={1500}
                  placeholder="What was observed, who supplied evidence, outstanding next step and follow-up owner"
                />
              </label>
              <button
                className="primary-button"
                type="submit"
                disabled={!requests.length}
              >
                Record service evidence
              </button>
            </form>
          </section>
        ) : null}

        {permissions.invoiceReview ? (
          <section className="content-panel">
            <SectionHeading
              id="vendor-invoice"
              title="Independently acknowledge invoice intake"
              eyebrow="Finance reviewer · not payable approval"
              helpTopic="shell.overview"
            />
            <p>
              Only a reviewer other than the original intake recorder can
              acknowledge an invoice intake. This records receipt/review for
              follow-up; it cannot approve, post or pay an invoice.
            </p>
            <div className={styles.cards}>
              {awaitingInvoice.length ? (
                awaitingInvoice.map((e) => (
                  <article className={styles.card} key={e.id}>
                    <h3>
                      {requests.find((r) => r.id === e.requestId)?.title ??
                        "Restricted request"}
                    </h3>
                    <p>
                      Invoice source {e.sourceReference} · Intake{" "}
                      {localTime(e.recordedAt, campground.timezone)}
                    </p>
                    <p>{e.note}</p>
                    {e.actorUserId === session.user.id ? (
                      <p className={styles.warnText}>
                        Independent reviewer required; the intake recorder
                        cannot acknowledge their own evidence.
                      </p>
                    ) : (
                      <form
                        action={recordVendorEventAction}
                        className={styles.inline}
                      >
                        <Scope campgroundId={campground.id} />
                        <Id />
                        <input
                          type="hidden"
                          name="kind"
                          value="invoice_reviewed"
                        />
                        <input
                          type="hidden"
                          name="requestId"
                          value={e.requestId}
                        />
                        <input
                          type="hidden"
                          name="reviewsEventId"
                          value={e.id}
                        />
                        <label className={styles.wide}>
                          Independent review note
                          <input
                            name="note"
                            required
                            minLength={20}
                            maxLength={1500}
                            placeholder="Received source invoice for reconciliation; no payable approval"
                          />
                        </label>
                        <button className="primary-button" type="submit">
                          Acknowledge intake only
                        </button>
                      </form>
                    )}
                  </article>
                ))
              ) : (
                <p>No unreviewed invoice intakes in this campground scope.</p>
              )}
            </div>
          </section>
        ) : null}
      </div>
    </AppShell>
  );
}
