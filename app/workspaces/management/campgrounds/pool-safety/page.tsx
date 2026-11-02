import { randomUUID } from "node:crypto";
import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";

import { AppShell } from "@/components/app-shell";
import { SectionHeading } from "@/components/section-heading";
import { requireStaff } from "@/lib/auth/current-session";
import { listAssignedCampgrounds } from "@/lib/authz/postgres.mjs";
import {
  getPoolPermissions,
  getPoolDashboard,
} from "@/lib/pool-supervision/postgres.mjs";

import {
  publishPoolPolicyAction,
  recordPoolQualificationAction,
  recordPoolEventAction,
} from "./actions";
import styles from "../reservations/reservations.module.css";

export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "Pool supervision & swim safety · iCamp",
  robots: { index: false, follow: false },
};
const label = (text: string) =>
  text.replaceAll("_", " ").replace(/\b\w/gu, (s) => s.toUpperCase());
export default async function PoolSafetyPage({
  searchParams,
}: Readonly<{
  searchParams: Promise<{ campground?: string; saved?: string }>;
}>) {
  const path = "/workspaces/management/campgrounds/pool-safety";
  const session = await requireStaff(path);
  const params = await searchParams;
  const assigned = await listAssignedCampgrounds(session.user.id);
  const available = (
    await Promise.all(
      assigned.map(async (item) => ({
        ...item,
        permissions: await getPoolPermissions(
          session.user.id,
          item.campgroundId,
        ),
      })),
    )
  ).filter((item) => Object.values(item.permissions).some(Boolean));
  if (!available.length) redirect("/auth/not-authorized");
  const selected =
    available.find((item) => item.campgroundId === params.campground) ??
    available[0];
  const dashboard = await getPoolDashboard(
    session.user.id,
    selected.campgroundId,
  );
  const {
    facilities,
    policies,
    qualifications,
    events,
    rules,
    staff,
    reservations,
    permissions,
  } = dashboard;
  const latest = facilities.map((facility) => ({
    facility,
    policy: policies.find((p) => p.asset_id === facility.id),
    lastDecision: events.find(
      (e) =>
        e.asset_id === facility.id &&
        (e.kind === "hold" || e.kind === "release"),
    ),
  }));
  const canAttest = permissions.attest;
  const canManage = permissions.manage;
  return (
    <AppShell>
      <div className="page-stack">
        <nav className="breadcrumbs" aria-label="Breadcrumb">
          <Link href="/">iCamp</Link>
          <span>/</span>
          <Link href="/workspaces/management/campgrounds">Campgrounds</Link>
          <span>/</span>
          <span>Pool safety</span>
        </nav>
        <section className="hero-panel">
          <p className="eyebrow">Build 084 · Supervised swimming</p>
          <h1>Lifeguarded pool &amp; swim safety register</h1>
          <p className="hero-panel__lead">
            Set campground-specific supervision policy, independently verify
            qualified staff, record admission decisions and incidents, and
            require manager review to release a swim hold.
          </p>
          <p>
            <strong>Safety boundary:</strong> This app never replaces a
            lifeguard, on-site emergency response, legally required staffing,
            physical barriers, or the existing inspected pool reopening process.
          </p>
        </section>
        {params.saved ? (
          <p role="status" className={styles.notice}>
            {params.saved}
          </p>
        ) : null}
        <section className="content-panel">
          <SectionHeading
            id="pool-property"
            title="Campground & pool status"
            eyebrow="Operating boundary"
            helpTopic="pool.supervision"
          />
          <form method="get" className={styles.inlineForm}>
            <label>
              Campground
              <select name="campground" defaultValue={selected.campgroundId}>
                {available.map((item) => (
                  <option key={item.campgroundId} value={item.campgroundId}>
                    {item.campgroundName}
                  </option>
                ))}
              </select>
            </label>
            <button type="submit" className="primary-button">
              Open
            </button>
          </form>
          {latest.length ? (
            <ul>
              {latest.map(({ facility, policy, lastDecision }) => (
                <li key={facility.id}>
                  <strong>{facility.display_name}</strong> · Canonical state:{" "}
                  {label(facility.operating_state)} · Policy:{" "}
                  {policy
                    ? `v${policy.version_number} (max ${policy.maximum_bathers} bathers, ${policy.minimum_lifeguards} lifeguards)`
                    : "Not yet published"}{" "}
                  · Supervised swimming:{" "}
                  {lastDecision?.kind === "hold"
                    ? "ON HOLD"
                    : lastDecision?.kind === "release"
                      ? "Released after management review"
                      : "No hold decision recorded"}
                </li>
              ))}
            </ul>
          ) : (
            <p>
              No registered active pools. First register a pool facility under
              operational assets.
            </p>
          )}
          <p>
            <Link href="/workspaces/maintenance/aquatics">
              Open canonical pool inspections, closures &amp; reopening
            </Link>{" "}
            ·{" "}
            <Link href="/workspaces/management/campgrounds/rules">
              Published pool rules &amp; guest acknowledgement
            </Link>
          </p>
        </section>
        {canManage ? (
          <section className="content-panel">
            <SectionHeading
              id="pool-policy"
              title="Publish a supervised-swim policy"
              eyebrow="Owner/manager configuration"
              helpTopic="pool.supervision"
            />
            <p>
              Set local operating limits after reviewing current provincial and
              public-health requirements. Choose the exact current published
              pool rule version. This register does not establish statutory
              compliance.
            </p>
            <form action={publishPoolPolicyAction} className={styles.formGrid}>
              <input
                type="hidden"
                name="campgroundId"
                value={selected.campgroundId}
              />
              <input type="hidden" name="id" value={randomUUID()} />
              <label>
                Pool
                <select name="assetId" required>
                  {facilities.map((f) => (
                    <option key={f.id} value={f.id}>
                      {f.display_name}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                Published pool rule
                <select name="ruleVersionId" required>
                  {rules.map((r) => (
                    <option key={r.id} value={r.id}>
                      {r.title} · version {r.version_number}
                      {r.facility_id ? " · facility scoped" : ""}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                Maximum bathers
                <input
                  name="maximumBathers"
                  type="number"
                  min="1"
                  max="10000"
                  defaultValue="30"
                  required
                />
              </label>
              <label>
                Minimum age for unaccompanied swimming
                <input
                  name="minimumUnaccompaniedAge"
                  type="number"
                  min="0"
                  max="25"
                  defaultValue="12"
                  required
                />
              </label>
              <label>
                Minimum age of accompanying supervisor
                <input
                  name="minimumSupervisorAge"
                  type="number"
                  min="13"
                  max="99"
                  defaultValue="18"
                  required
                />
              </label>
              <label>
                Maximum children per supervisor
                <input
                  name="maximumChildrenPerSupervisor"
                  type="number"
                  min="1"
                  max="50"
                  defaultValue="2"
                  required
                />
              </label>
              <label>
                Minimum on-duty lifeguards
                <input
                  name="minimumLifeguards"
                  type="number"
                  min="1"
                  max="50"
                  defaultValue="1"
                  required
                />
              </label>
              <label>
                Locally approved safety instructions
                <textarea
                  name="safetyInstructions"
                  rows={3}
                  minLength={30}
                  maxLength={2000}
                  required
                  placeholder="Document applicable supervision, incident and emergency procedures."
                />
              </label>
              <button
                type="submit"
                className="primary-button"
                disabled={!facilities.length || !rules.length}
              >
                Publish immutable policy version
              </button>
            </form>
          </section>
        ) : null}
        {canManage ? (
          <section className="content-panel">
            <SectionHeading
              id="pool-credentials"
              title="Verify or revoke lifeguard qualification"
              eyebrow="Independent management evidence"
              helpTopic="pool.supervision"
            />
            <p>
              Verify the actual credential, jurisdictional requirements and
              expiry outside iCamp. Lifeguard role access alone cannot authorize
              a swim check. Managers cannot verify their own qualifications.
            </p>
            <form
              action={recordPoolQualificationAction}
              className={styles.formGrid}
            >
              <input
                type="hidden"
                name="campgroundId"
                value={selected.campgroundId}
              />
              <input type="hidden" name="id" value={randomUUID()} />
              <label>
                Pool
                <select name="assetId">
                  {facilities.map((f) => (
                    <option key={f.id} value={f.id}>
                      {f.display_name}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                Assigned staff
                <select name="staffUserId">
                  {staff.map((s) => (
                    <option key={s.user_id} value={s.user_id}>
                      {s.email}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                Decision
                <select name="decision">
                  <option value="verify">Verify credential</option>
                  <option value="revoke">Revoke qualification</option>
                </select>
              </label>
              <label>
                Credential reference
                <input
                  name="credentialReference"
                  minLength={8}
                  maxLength={400}
                  required
                  placeholder="Verified credential record or certificate ID"
                />
              </label>
              <label>
                Credential expiry (required for verification)
                <input name="expiresAt" type="datetime-local" />
              </label>
              <label>
                Manager review note
                <textarea
                  name="decisionNote"
                  minLength={12}
                  maxLength={2000}
                  required
                  rows={2}
                />
              </label>
              <button
                type="submit"
                className="primary-button"
                disabled={!facilities.length || !staff.length}
              >
                Record credential decision
              </button>
            </form>
            <h3>Latest qualification decisions</h3>
            <ul>
              {qualifications.slice(0, 12).map((q) => (
                <li key={q.id}>
                  {q.staff_email ?? q.staff_user_id} · {label(q.decision)} ·{" "}
                  {q.credential_reference} ·{" "}
                  {q.expires_at
                    ? `expires ${new Date(q.expires_at).toLocaleDateString("en-CA")}`
                    : "revoked"}
                </li>
              ))}
            </ul>
          </section>
        ) : null}
        {canAttest ? (
          <section className="content-panel">
            <SectionHeading
              id="pool-observations"
              title="Record supervised swimming observation"
              eyebrow="Verified lifeguard only"
              helpTopic="pool.supervision"
            />
            <p>
              Before allowing entry, count all swimmers, supervising adults,
              children below the policy threshold, and qualified lifeguards. A
              positive admission requires the guest&apos;s current exact-version
              rule acknowledgement and an operational pool with no outstanding
              hold.
            </p>
            <form action={recordPoolEventAction} className={styles.formGrid}>
              <input
                type="hidden"
                name="campgroundId"
                value={selected.campgroundId}
              />
              <input type="hidden" name="id" value={randomUUID()} />
              <label>
                Pool &amp; active policy
                <select name="assetId" required>
                  {latest
                    .filter((v) => v.policy)
                    .map((v) => (
                      <option key={v.facility.id} value={v.facility.id}>
                        {v.facility.display_name}
                      </option>
                    ))}
                </select>
              </label>
              <label>
                Policy version
                <select name="policyId" required>
                  {latest
                    .filter((v) => v.policy)
                    .map((v) => (
                      <option key={v.policy!.id} value={v.policy!.id}>
                        {v.facility.display_name} · v{v.policy!.version_number}
                      </option>
                    ))}
                </select>
              </label>
              <label>
                Observation type
                <select name="kind">
                  <option value="admission_check">Swim admission check</option>
                  <option value="warning">Safety warning</option>
                  <option value="removal">Remove from swim area</option>
                  <option value="hold">Immediate swimming hold</option>
                  <option value="release_request">
                    Request swimming hold release
                  </option>
                </select>
              </label>
              <label>
                Active guest reservation (for admission/warning/removal)
                <select name="reservationId">
                  <option value="">No guest / facility-only event</option>
                  {reservations.map((r) => (
                    <option key={r.id} value={r.id}>
                      {r.accommodation_code} · {r.status} · {r.id.slice(0, 8)}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                Bathers observed
                <input
                  name="batherCount"
                  type="number"
                  min="0"
                  max="10000"
                  defaultValue="0"
                />
              </label>
              <label>
                Children below required unaccompanied age
                <input
                  name="underageCount"
                  type="number"
                  min="0"
                  max="10000"
                  defaultValue="0"
                />
              </label>
              <label>
                Adult supervisors present
                <input
                  name="supervisorCount"
                  type="number"
                  min="0"
                  max="10000"
                  defaultValue="0"
                />
              </label>
              <label>
                Qualified lifeguards on duty
                <input
                  name="lifeguardCount"
                  type="number"
                  min="0"
                  max="10000"
                  defaultValue="1"
                />
              </label>
              <label>
                Admission check outcome
                <select name="admitted">
                  <option value="no">Refuse admission / unsafe</option>
                  <option value="yes">Admit (only if all checks pass)</option>
                </select>
              </label>
              <label>
                Supervisor and unaccompanied swimmer ages verified
                <select name="supervisionAgesVerified">
                  <option value="no">Not verified</option>
                  <option value="yes">
                    On-site ages verified against policy
                  </option>
                </select>
              </label>
              <label>
                Observed facts / safety decision
                <textarea
                  name="reason"
                  rows={3}
                  minLength={12}
                  maxLength={2000}
                  required
                />
              </label>
              <button
                type="submit"
                className="primary-button"
                disabled={!policies.length}
              >
                Record immutable observation
              </button>
            </form>
          </section>
        ) : null}
        {canManage ? (
          <section className="content-panel">
            <SectionHeading
              id="pool-hold-review"
              title="Independently review swimming hold release"
              eyebrow="Management decision"
              helpTopic="pool.supervision"
            />
            <p>
              Release only after a separately qualified lifeguard has requested
              it, the physical facility is operational, and the established
              inspected reopening workflow is complete. Neither the hold
              originator nor the requestor may approve release.
            </p>
            <form action={recordPoolEventAction} className={styles.formGrid}>
              <input
                type="hidden"
                name="campgroundId"
                value={selected.campgroundId}
              />
              <input type="hidden" name="id" value={randomUUID()} />
              <input type="hidden" name="kind" value="release" />
              <label>
                Pool under review
                <select name="assetId">
                  {latest
                    .filter((v) => v.policy)
                    .map((v) => (
                      <option key={v.facility.id} value={v.facility.id}>
                        {v.facility.display_name}
                      </option>
                    ))}
                </select>
              </label>
              <label>
                Current pool policy
                <select name="policyId">
                  {latest
                    .filter((v) => v.policy)
                    .map((v) => (
                      <option key={v.policy!.id} value={v.policy!.id}>
                        {v.facility.display_name} · v{v.policy!.version_number}
                      </option>
                    ))}
                </select>
              </label>
              <label>
                Independent release review note
                <textarea
                  name="reason"
                  rows={3}
                  minLength={12}
                  maxLength={2000}
                  required
                />
              </label>
              <button
                type="submit"
                className="primary-button"
                disabled={!policies.length}
              >
                Approve swimming release
              </button>
            </form>
          </section>
        ) : null}
        <section className="content-panel">
          <SectionHeading
            id="pool-audit"
            title="Immutable supervision history"
            eyebrow="Accountable safety decisions"
            helpTopic="pool.supervision"
          />
          {events.length ? (
            <ul>
              {events.map((e) => (
                <li key={e.id}>
                  <strong>{label(e.kind)}</strong> ·{" "}
                  {facilities.find((f) => f.id === e.asset_id)?.display_name ??
                    "Pool"}{" "}
                  · {new Date(e.occurred_at).toLocaleString("en-CA")} ·{" "}
                  {e.admitted === null
                    ? ""
                    : e.admitted
                      ? "Admitted · "
                      : "Refused · "}
                  {e.reason} · Actor {e.actor_user_id.slice(0, 8)}
                </li>
              ))}
            </ul>
          ) : (
            <p>No supervision events yet.</p>
          )}
          <p>
            For formal guest-access restrictions, use{" "}
            <Link href="/workspaces/management/campgrounds/enforcement">
              warnings &amp; suspension review
            </Link>
            . A swim warning/removal is not an automatic reservation suspension.
          </p>
        </section>
      </div>
    </AppShell>
  );
}
