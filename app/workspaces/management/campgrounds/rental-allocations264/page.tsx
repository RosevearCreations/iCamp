import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";

import { AppShell } from "@/components/app-shell";
import { SectionHeading } from "@/components/section-heading";
import { requireAnyCampgroundPermission } from "@/lib/authz/current-user";
import {
  getCampgroundAuthorization,
  listAssignedCampgrounds,
} from "@/lib/authz/postgres.mjs";
import {
  listManagedAllocations264,
} from "@/lib/rental-planner/allocations264-postgres.mjs";
import { inspectRentalMigration264 } from "@/lib/rental-planner/migration264-postgres.mjs";
import {
  listManagedRentalRequests,
} from "@/lib/rental-planner/postgres.mjs";
import { listSupervisedSessions263 } from "@/lib/rental-planner/sessions263-postgres.mjs";
import {
  cancelRental264Action,
  reserveRental264Action,
  reviewSupervisedPilot264Action,
} from "./actions";
import styles from "../../../../events/recreation.module.css";

export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "Build 264 · Rental allocation and pilot · iCamp",
  description: "Authenticated source-asset guest reservation, operational migration readback and independent supervised pilot review.",
  robots: { index: false, follow: false },
};

export default async function RentalAllocations264Page({
  searchParams,
}: Readonly<{
  searchParams: Promise<{ campground?: string; saved?: string; error?: string }>;
}>) {
  const path = "/workspaces/management/campgrounds/rental-allocations264";
  const user = await requireAnyCampgroundPermission("rental.manage", path);
  const query = await searchParams;
  const assigned = await listAssignedCampgrounds(user.user.id);
  const allowed = (
    await Promise.all(
      assigned.map(async (campground) => {
        const grant = await getCampgroundAuthorization(
          user.user.id,
          campground.campgroundId,
        );
        return grant?.permissions.includes("rental.manage")
          ? { ...campground, pilotReviewer: grant.permissions.includes("staff.manage") }
          : null;
      }),
    )
  ).filter((item): item is NonNullable<typeof item> => item !== null);
  if (!allowed.length) redirect("/auth/not-authorized");
  const selected =
    allowed.find((item) => item.campgroundId === query.campground) ??
    allowed[0];

  const [migration, records, requests, sessions] = await Promise.all([
    inspectRentalMigration264(),
    listManagedAllocations264({
      actorUserId: user.user.id,
      campgroundId: selected.campgroundId,
    }),
    listManagedRentalRequests({
      userId: user.user.id,
      campgroundId: selected.campgroundId,
    }),
    listSupervisedSessions263({
      actorUserId: user.user.id,
      campgroundId: selected.campgroundId,
    }),
  ]);
  const reservedRequests = new Set(
    records.reservations
      .filter((x) => x.status === "reserved_for_staff_collection")
      .map((x) => x.requestId),
  );
  const eligiblePlans = requests.filter(
    (r) => r.status === "reviewed" && !reservedRequests.has(r.id),
  );
  const assessedSessions = new Set(
    records.pilotReviews.map((item) => item.sessionId),
  );
  const unreviewedSessions = sessions.sessions.filter(
    (s) => s.status === "planned" && !assessedSessions.has(s.id),
  );
  const enabled = migration.sourceReadbackMatched;
  return (
    <AppShell>
      <div className="page-stack">
        <nav className="breadcrumbs" aria-label="Breadcrumb">
          <Link href="/workspaces/management/campgrounds">Campgrounds</Link>
          <span>/</span>
          <Link href="/workspaces/management/campgrounds/rentals">Rentals</Link>
          <span>/</span>
          <span>Build 264</span>
        </nav>
        <section className="hero-panel">
          <p className="eyebrow">Build 264 · source-backed physical asset control</p>
          <h1>Rental reservation and supervised pilot acceptance</h1>
          <p className="hero-panel__lead">
            Staff may reserve one actual operational item for an eligible guest
            stay after review, with serialized overlap prevention. Independent
            staff may accept a supervised activity for an INTERNAL pilot.
            Neither action charges guests, issues equipment, assigns animals,
            sells tickets or authorizes unsupervised activities.
          </p>
          <p><strong>Live database readback:</strong> {migration.status}</p>
        </section>
        {query.saved ? (
          <p role="status" className={styles.notice}>
            Internal staff decision saved and audited. No payment, handover
            or outbound notification occurred.
          </p>
        ) : null}
        {query.error ? (
          <p role="alert" className={styles.warning}>
            The original item, scope, staff authority, independent reviewer,
            schedule or migration evidence changed. Refresh before trying again.
          </p>
        ) : null}
        <section className="content-panel">
          <SectionHeading
            id="rental264-campground"
            eyebrow="Authoritative tenant scope"
            title="Select campground and verify original migration"
            helpTopic="campground.structure"
          />
          <form method="get" className={styles.filters}>
            <label>
              Campground
              <select name="campground" defaultValue={selected.campgroundId}>
                {allowed.map((cg) => (
                  <option key={cg.campgroundId} value={cg.campgroundId}>
                    {cg.campgroundName}
                  </option>
                ))}
              </select>
            </label>
            <button type="submit" className="primary-button">
              View original rental assets
            </button>
          </form>
          <p>Migration versions verified: {migration.checkedVersions.join(", ")}</p>
          {!enabled ? (
            <div className={styles.warning} role="alert">
              <strong>Allocations locked until live migration proof.</strong>
              {migration.blockers.map((reason) => (
                <p key={reason}>{reason}</p>
              ))}
            </div>
          ) : (
            <p>
              Original deployment source, migration digests, RLS and database
              triggers match. Independent database custodian witness, guest
              pickup and payment still require separate evidence.
            </p>
          )}
          <p>
            <strong>Physical handover:</strong> NOT VERIFIED.{" "}
            <strong>Live payment:</strong> DISABLED.{" "}
            <strong>Independent pilot insurance:</strong> NOT CERTIFIED.
          </p>
        </section>
        <section className="content-panel">
          <SectionHeading
            id="rental264-approvals"
            eyebrow="Real registered equipment only"
            title={`Reviewed guest requests ready for staff allocation (${eligiblePlans.length})`}
            helpTopic="campground.structure"
          />
          {!enabled ? (
            <p>Live reservation action is locked until exact migration readback succeeds.</p>
          ) : !eligiblePlans.length ? (
            <p>No eligible reviewed guest plans are awaiting source-asset reservation.</p>
          ) : (
            <div className={styles.cards}>
              {eligiblePlans.map((request) => (
                <article className={styles.card} key={request.id}>
                  <h3>{request.assetName}</h3>
                  <p>{request.startDate} to {request.endDate} · Original stay {request.reservationId}</p>
                  <form action={reserveRental264Action} className={styles.form}>
                    <input type="hidden" name="campgroundId" value={selected.campgroundId} />
                    <input type="hidden" name="requestId" value={request.id} />
                    <label>
                      Equipment checks, weather, collection and guest safety review
                      <textarea name="staffSafetyReview" required minLength={20} maxLength={500}
                        placeholder="Confirm operational source asset, condition, safety measures and where staff will arrange handover." />
                    </label>
                    <button type="submit" className="primary-button">
                      Reserve real equipment for staff collection
                    </button>
                  </form>
                </article>
              ))}
            </div>
          )}
          <p>Reserved status is a staff-administered allocation, not a paid rental or a completed checkout.</p>
        </section>
        <section className="content-panel">
          <SectionHeading
            id="rental264-active"
            eyebrow="Staff-only reservation ledger"
            title={`Original allocated items (${records.reservations.length})`}
            helpTopic="campground.structure"
          />
          <div className={styles.cards}>
            {records.reservations.map((allocation) => (
              <article className={styles.card} key={allocation.id}>
                <h3>{allocation.assetName}</h3>
                <p>{allocation.startDate} to {allocation.endDate}</p>
                <p><strong>{allocation.status.replaceAll("_", " ")}</strong></p>
                {enabled && allocation.status === "reserved_for_staff_collection" ? (
                  <form action={cancelRental264Action}>
                    <input type="hidden" name="campgroundId" value={selected.campgroundId} />
                    <input type="hidden" name="allocationId" value={allocation.id} />
                    <button type="submit" className="secondary-button">
                      Cancel staff-only equipment reservation
                    </button>
                  </form>
                ) : null}
              </article>
            ))}
          </div>
          {records.coverageCapped ? <p>Source coverage limit reached; inventory counts are incomplete.</p> : null}
        </section>
        <section className="content-panel">
          <SectionHeading
            id="rental264-pilot"
            eyebrow="Separation of duties"
            title={`Unreviewed proposed supervised sessions (${unreviewedSessions.length})`}
            helpTopic="campground.structure"
          />
          {!selected.pilotReviewer ? (
            <p>Independent reviewer needs both rental.manage and staff.manage authority.</p>
          ) : !enabled ? (
            <p>Proposed-session acceptance remains blocked by production migration readback.</p>
          ) : (
            <div className={styles.cards}>
              {unreviewedSessions.map((activity) => (
                <article className={styles.card} key={activity.id}>
                  <h3>{activity.assetName} · {activity.activityKind.replaceAll("_", " ")}</h3>
                  <p>{activity.plannedDay} · planned limit {activity.participantLimit}</p>
                  <p>{activity.safetyBrief}</p>
                  <form action={reviewSupervisedPilot264Action} className={styles.form}>
                    <input type="hidden" name="campgroundId" value={selected.campgroundId} />
                    <input type="hidden" name="sessionId" value={activity.id} />
                    <label>
                      Internal review decision
                      <select name="outcome" required defaultValue="hold">
                        <option value="hold">HOLD — original evidence incomplete</option>
                        <option value="accepted_for_internal_pilot">
                          Accept for supervised INTERNAL pilot only
                        </option>
                      </select>
                    </label>
                    <label>
                      Original staff/insurance/welfare evidence reference
                      <input name="originalEvidenceReference" minLength={12} maxLength={150}
                        placeholder="internal-evidence:reference" required />
                    </label>
                    <label>
                      Independent safety, training, supervision and animal welfare assessment
                      <textarea name="supervisionWelfareCheck" minLength={30} maxLength={650}
                        required placeholder="Describe reviewed operator qualifications, insured activity, safety, weather and animal welfare requirements." />
                    </label>
                    <button type="submit" className="primary-button">
                      Record independent internal pilot review
                    </button>
                  </form>
                </article>
              ))}
            </div>
          )}
          <p>
            Planner and reviewer must be different authorized staff.
            Internal acceptance does not activate guest-facing horse rides,
            qualified instructors, waivers, ticket sales or external insurance.
          </p>
        </section>
        <section className="content-panel">
          <SectionHeading
            id="rental264-reviews"
            eyebrow="Append-only internal pilot ledger"
            title="Independent staff review evidence"
            helpTopic="campground.structure"
          />
          <div className={styles.cards}>
            {records.pilotReviews.map((item) => (
              <article className={styles.card} key={item.id}>
                <h3>{item.activityKind.replaceAll("_", " ")}</h3>
                <p>{item.outcome.replaceAll("_", " ")} · {item.reviewedAt}</p>
                <p>Evidence reference: {item.originalEvidenceReference}</p>
              </article>
            ))}
          </div>
          {!records.pilotReviews.length && <p>No independently reviewed internal supervised pilots.</p>}
        </section>
      </div>
    </AppShell>
  );
}
