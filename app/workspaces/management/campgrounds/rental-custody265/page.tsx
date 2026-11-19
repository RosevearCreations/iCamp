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
import { listManagedAllocations264 } from "@/lib/rental-planner/allocations264-postgres.mjs";
import { listLocalCustody265 } from "@/lib/campground-support265/postgres.mjs";
import {
  recordRentalPickup265Action,
  recordSupervisedWitness265Action,
} from "./actions";
import styles from "../../../../events/recreation.module.css";

export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "Build 265 · Equipment custody and supervised witness · iCamp",
  description:
    "Scoped original guest consent and staff pickup/return observations, not proof of external live rental certification.",
  robots: { index: false, follow: false },
};

export default async function CampgroundRentalCustody265Page({
  searchParams,
}: Readonly<{
  searchParams: Promise<{
    campground?: string;
    saved?: string;
    error?: string;
  }>;
}>) {
  const path = "/workspaces/management/campgrounds/rental-custody265";
  const session = await requireAnyCampgroundPermission("rental.manage", path);
  const params = await searchParams;
  const assigned = await listAssignedCampgrounds(session.user.id);
  const allowed = (
    await Promise.all(
      assigned.map(async (cg) => {
        const grant = await getCampgroundAuthorization(
          session.user.id,
          cg.campgroundId,
        );
        return grant?.permissions.includes("rental.manage")
          ? {
              ...cg,
              canWitness: grant.permissions.includes("staff.manage"),
            }
          : null;
      }),
    )
  ).filter((x): x is NonNullable<typeof x> => x !== null);
  if (!allowed.length) redirect("/auth/not-authorized");
  const current =
    allowed.find((cg) => cg.campgroundId === params.campground) ?? allowed[0];
  const [base, custody] = await Promise.all([
    listManagedAllocations264({
      actorUserId: session.user.id,
      campgroundId: current.campgroundId,
    }),
    listLocalCustody265({
      userId: session.user.id,
      campgroundId: current.campgroundId,
    }),
  ]);
  const hasPickup = new Set(
    custody.events
      .filter((e) => e.eventKind === "staff_observed_pickup")
      .map((e) => e.allocationId),
  );
  const hasReturn = new Set(
    custody.events
      .filter((e) => e.eventKind === "staff_observed_return")
      .map((e) => e.allocationId),
  );
  const witnessed = new Set(custody.witnesses.map((w) => w.pilotReviewId));
  return (
    <AppShell>
      <div className="page-stack">
        <nav className="breadcrumbs" aria-label="Breadcrumbs">
          <Link href="/workspaces/management/campgrounds/rentals">
            Rental management
          </Link>
          <span>/</span>
          <span>Custody</span>
        </nav>
        <section className="hero-panel">
          <p className="eyebrow">Build 265 · campground equipment custody</p>
          <h1>Guest safety, staff-observed pickup and return</h1>
          <p className="hero-panel__lead">
            A guest first acknowledges the exact safety statement on their
            original staff-reserved equipment record. Staff can then record an
            observed pickup and later a return. All records are immutable and
            source-bound. They are staff attestations, not third-party proof,
            insurance certificates or payments.
          </p>
        </section>
        {params.saved ? (
          <p role="status" className={styles.notice}>
            Original staff evidence saved and audited.
          </p>
        ) : null}
        {params.error ? (
          <p role="alert" className={styles.warning}>
            Action held. Check original guest safety, operational equipment,
            dates, independent staff authority and previously recorded custody.
          </p>
        ) : null}
        <section className="content-panel">
          <SectionHeading
            id="rental265-scope"
            title="Campground scope"
            eyebrow="Original tenant record"
            helpTopic="campground.structure"
          />
          <form method="get" className={styles.filters}>
            <label>
              Campground
              <select name="campground" defaultValue={current.campgroundId}>
                {allowed.map((c) => (
                  <option key={c.campgroundId} value={c.campgroundId}>
                    {c.campgroundName}
                  </option>
                ))}
              </select>
            </label>
            <button className="primary-button" type="submit">
              Open
            </button>
          </form>
          <p>
            <strong>Original allocation source:</strong> {base.status}
          </p>
          <p>
            <strong>Build 265 custody source:</strong> {custody.status}
          </p>
        </section>
        <section className="content-panel">
          <SectionHeading
            id="rental265-pickup"
            title={`Staff-reserved physical items (${base.reservations.length})`}
            eyebrow="No automatic pickup, fee or animal handover"
            helpTopic="campground.structure"
          />
          {!base.reservations.length ? (
            <p>No staff-reserved original rental equipment observed.</p>
          ) : (
            <div className={styles.cards}>
              {base.reservations.map((item) => (
                <article className={styles.card} key={item.id}>
                  <h3>{item.assetName}</h3>
                  <p>
                    {item.startDate} through {item.endDate} ·{" "}
                    <strong>{item.status}</strong>
                  </p>
                  <p>
                    {hasPickup.has(item.id)
                      ? "Staff pickup observation recorded"
                      : "No pickup observation"}{" "}
                    ·{" "}
                    {hasReturn.has(item.id)
                      ? "Return recorded"
                      : "Return not observed"}
                  </p>
                  {item.status === "reserved_for_staff_collection" &&
                  !hasReturn.has(item.id) ? (
                    <form
                      action={recordRentalPickup265Action}
                      className={styles.form}
                    >
                      <input
                        type="hidden"
                        name="campgroundId"
                        value={current.campgroundId}
                      />
                      <input
                        type="hidden"
                        name="allocationId"
                        value={item.id}
                      />
                      <input
                        type="hidden"
                        name="eventKind"
                        value={
                          hasPickup.has(item.id)
                            ? "staff_observed_return"
                            : "staff_observed_pickup"
                        }
                      />
                      <label>
                        Original equipment / handover reference
                        <input
                          name="evidenceReference"
                          minLength={12}
                          maxLength={160}
                          required
                          placeholder="Internal observed source reference"
                        />
                      </label>
                      <label>
                        Staff observations, condition, safety and return details
                        <textarea
                          name="conditionNote"
                          minLength={30}
                          maxLength={650}
                          required
                        />
                      </label>
                      <button className="primary-button" type="submit">
                        {hasPickup.has(item.id)
                          ? "Record staff-observed return"
                          : "Record staff-observed pickup"}
                      </button>
                    </form>
                  ) : null}
                </article>
              ))}
            </div>
          )}
        </section>
        <section className="content-panel">
          <SectionHeading
            id="rental265-pilot"
            title="Independent on-site supervised activity witness"
            eyebrow="Internal evidence only"
            helpTopic="campground.structure"
          />
          {!current.canWitness ? (
            <p>
              A different staff-and-rental manager must record independent
              witness evidence.
            </p>
          ) : null}
          <div className={styles.cards}>
            {base.pilotReviews.map((pilot) => (
              <article className={styles.card} key={pilot.id}>
                <h3>{pilot.activityKind.replaceAll("_", " ")}</h3>
                <p>
                  {pilot.outcome} · Original review{" "}
                  {pilot.originalEvidenceReference}
                </p>
                {current.canWitness &&
                pilot.outcome === "accepted_for_internal_pilot" &&
                !witnessed.has(pilot.id) ? (
                  <form
                    action={recordSupervisedWitness265Action}
                    className={styles.form}
                  >
                    <input
                      type="hidden"
                      name="campgroundId"
                      value={current.campgroundId}
                    />
                    <input
                      type="hidden"
                      name="pilotReviewId"
                      value={pilot.id}
                    />
                    <label>
                      Real on-site observation reference
                      <input
                        name="siteReference"
                        minLength={8}
                        maxLength={140}
                        required
                      />
                    </label>
                    <label>
                      Original qualified supervisor reference
                      <input
                        name="supervisionReference"
                        minLength={12}
                        maxLength={140}
                        required
                      />
                    </label>
                    <label>
                      Observed restrictions, animal welfare and safety checks
                      <textarea
                        name="safetyRestrictions"
                        minLength={30}
                        maxLength={650}
                        required
                      />
                    </label>
                    <button className="primary-button" type="submit">
                      Record independent staff observation
                    </button>
                  </form>
                ) : null}
              </article>
            ))}
          </div>
          <p>
            Even independent staff evidence cannot, by itself, certify
            licensing, venue safety, insurance, an actual customer pilot or
            physical animal welfare. No customer booking is opened.
          </p>
        </section>
        <section className="content-panel">
          <SectionHeading
            id="rental265-log"
            title="Original custody history"
            eyebrow="Append-only, tenant-scoped"
            helpTopic="campground.structure"
          />
          {!custody.events.length ? (
            <p>No custody observation events recorded.</p>
          ) : (
            <div className={styles.cards}>
              {custody.events.map((e) => (
                <article className={styles.card} key={e.id}>
                  <h3>{e.eventKind.replaceAll("_", " ")}</h3>
                  <p>
                    {e.evidenceReference} · {e.recordedAt}
                  </p>
                  <p>{e.conditionNote}</p>
                </article>
              ))}
            </div>
          )}
        </section>
      </div>
    </AppShell>
  );
}
