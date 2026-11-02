import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";

import { AppShell } from "@/components/app-shell";
import { SectionHeading } from "@/components/section-heading";
import { requireStaff } from "@/lib/auth/current-session";
import {
  getCampgroundAuthorization,
  listAssignedCampgrounds,
} from "@/lib/authz/postgres.mjs";
import { buildDeskQueues } from "@/lib/front-desk-workboard/core.mjs";
import { listFrontDeskWorkboard } from "@/lib/front-desk-workboard/postgres.mjs";
import { formatMoney } from "@/lib/pricing/core.mjs";

import styles from "../reservations.module.css";

export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "Unified front desk workboard · iCamp",
  description:
    "Campground-scoped live arrival, departure and exception readback with links to canonical staff workflows.",
  robots: { index: false, follow: false },
};

const BASE = "/workspaces/management/campgrounds/reservations/front-desk";

function label(value: string) {
  return value.replaceAll("_", " ");
}

function Coverage({
  name,
  entry,
}: {
  name: string;
  entry: { shown: number; total: number; complete: boolean } | null;
}) {
  return (
    <li>
      {name}:{" "}
      {entry
        ? `${entry.shown} of ${entry.total} source ${name === "reservations" || name === "holds" ? "records" : "groups"}${entry.complete ? " (complete)" : " (display cap reached; flags and counts are partial)"}`
        : "restricted — no details or counts"}
    </li>
  );
}

export default async function UnifiedFrontDeskPage({
  searchParams,
}: Readonly<{
  searchParams: Promise<{
    campground?: string;
    view?: string;
    sort?: string;
    query?: string;
  }>;
}>) {
  const session = await requireStaff(BASE);
  if (!process.env.DATABASE_URL?.trim()) {
    return (
      <AppShell>
        <section className="content-panel" role="status">
          <h1>Front desk workboard unavailable</h1>
          <p>
            The database is not connected. No reservation, payment, visitor,
            availability or other action was taken.
          </p>
        </section>
      </AppShell>
    );
  }
  const params = await searchParams;
  const assigned = await listAssignedCampgrounds(session.user.id);
  const authorized = (
    await Promise.all(
      assigned.map(async (campground) => {
        const access = await getCampgroundAuthorization(
          session.user.id,
          campground.campgroundId,
        );
        return access?.permissions.some(
          (permission) =>
            permission === "reservation.read" ||
            permission === "reservation.modify",
        )
          ? campground
          : null;
      }),
    )
  ).filter((item): item is NonNullable<typeof item> => item !== null);
  if (!authorized.length) redirect("/auth/not-authorized");
  const selected =
    authorized.find((item) => item.campgroundId === params.campground) ??
    authorized[0];
  const desk = await listFrontDeskWorkboard({
    userId: session.user.id,
    campgroundId: selected.campgroundId,
  });
  const queue = buildDeskQueues({ ...desk, filters: params });
  const baseParam = `campground=${encodeURIComponent(selected.campgroundId)}`;
  const truncated = Object.values(desk.coverage).some(
    (entry) => entry && !entry.complete,
  );
  const uncovered = desk.visitors.filter(
    (item) =>
      !desk.reservations.some(
        (reservation) => reservation.id === item.reservationId,
      ),
  );
  const siteWideOrders =
    desk.maintenance.find((item) => item.accommodationId === null)?.openCount ??
    0;
  return (
    <AppShell>
      <div className="page-stack">
        <nav className="breadcrumbs" aria-label="Breadcrumb">
          <Link href="/workspaces/management/campgrounds">Campgrounds</Link>
          <span>/</span>
          <Link
            href={`/workspaces/management/campgrounds/reservations?${baseParam}`}
          >
            Reservations
          </Link>
          <span>/</span>
          <span>Unified front desk</span>
        </nav>
        <section className="hero-panel">
          <p className="eyebrow">Build 185 · Front desk operations</p>
          <h1>One desk for arrivals, departures & exceptions</h1>
          <p className="hero-panel__lead">
            Live, permission-scoped status from canonical reservations, guest
            pre-registration, holds, visitors, site work orders and cottage
            turnover. Follow a link to complete verification in its original
            workflow. This overview never approves a guest, checks anyone in or
            out, releases inventory, captures payment or sends a message.
          </p>
          <div className="hero-actions">
            <Link
              className="secondary-link"
              href={`/workspaces/management/campgrounds/reservations/check-in?${baseParam}`}
            >
              Check-in desk
            </Link>
            <Link
              className="secondary-link"
              href={`/workspaces/management/campgrounds/reservations/check-out?${baseParam}`}
            >
              Check-out desk
            </Link>
            <Link
              className="secondary-link"
              href={`/workspaces/management/campgrounds/reservations/arrival-readiness?${baseParam}`}
            >
              Pre-registration reviews
            </Link>
            <Link
              className="secondary-link"
              href={`/workspaces/maintenance/turnover-release?${baseParam}`}
            >
              Turnover release board
            </Link>
          </div>
        </section>
        <section className="content-panel" aria-labelledby="desk-workload">
          <SectionHeading
            eyebrow={`Campground-local ${desk.campground.localDate} · ${desk.campground.timezone}`}
            title="Desk workload"
            id="desk-workload"
            helpTopic="campground.structure"
          />
          <p>
            <strong>{queue.counts.arrivals}</strong> arrivals ·{" "}
            <strong>{queue.counts.departures}</strong> departures ·{" "}
            <strong>{queue.counts.exceptions}</strong> flagged stay rows ·{" "}
            <strong>{queue.counts.holds}</strong> active holds.
          </p>
          <p>
            Arrivals: active stays from yesterday through 14 days ahead.
            Departures: all checked-in stays and completed check-outs from the
            last 14 days. Holds: unexpired overlapping the arrival horizon. An
            arrival and departure may be separate rows for one reservation.
          </p>
          <p role="status">
            {truncated
              ? "Display caps reached. Figures above count loaded rows only, not the complete property workload. See coverage below."
              : "Counts above reconcile the loaded, fully covered source windows. Exception flags only reflect sources you are authorized to read."}
          </p>
          <form
            method="get"
            className={styles.inlineForm}
            role="search"
            aria-label="Front desk filters"
          >
            <label>
              Campground
              <select name="campground" defaultValue={selected.campgroundId}>
                {authorized.map((item) => (
                  <option key={item.campgroundId} value={item.campgroundId}>
                    {item.campgroundName}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Queue
              <select name="view" defaultValue={queue.filters.view}>
                <option value="all">All work</option>
                <option value="exceptions">Needs attention</option>
                <option value="arrivals">Arrivals</option>
                <option value="departures">Departures</option>
                <option value="holds">Active holds</option>
              </select>
            </label>
            <label>
              Sort
              <select name="sort" defaultValue={queue.filters.sort}>
                <option value="urgency">Highest attention first</option>
                <option value="date">Stay date</option>
                <option value="accommodation">Accommodation</option>
              </select>
            </label>
            <label>
              Find guest/site/reference
              <input
                name="query"
                type="search"
                defaultValue={queue.filters.query}
                maxLength={80}
                placeholder="Guest, site or exception"
              />
            </label>
            <button className="primary-button" type="submit">
              Update workboard
            </button>
          </form>
          <p>
            Showing <strong>{queue.rows.length}</strong> rows after filters.
            Press Tab to reach filters and the canonical action for each row,
            then Enter to open it.{" "}
            <Link href={`${BASE}?${baseParam}`}>
              Clear filters and refresh live status
            </Link>
            .
          </p>
        </section>
        <section className="content-panel" aria-labelledby="desk-queue">
          <SectionHeading
            eyebrow="Live status · no inline approval"
            title="Unified work queue"
            id="desk-queue"
            helpTopic="campground.structure"
          />
          {queue.rows.length === 0 ? (
            <p>
              No matching rows from the visible and authorized source windows.
              Change filters or refresh. This does not certify that the
              campground has no exceptions outside these windows.
            </p>
          ) : (
            <div className={styles.tableWrap}>
              <table>
                <caption>
                  Read-only front desk status. Open the canonical workflow to
                  make decisions.
                </caption>
                <thead>
                  <tr>
                    <th scope="col">Queue / date</th>
                    <th scope="col">Guest / accommodation</th>
                    <th scope="col">Source status</th>
                    <th scope="col">Attention</th>
                    <th scope="col">Next step</th>
                  </tr>
                </thead>
                <tbody>
                  {queue.rows.map((row) => (
                    <tr key={row.key}>
                      <td>
                        <strong>{label(row.kind)}</strong>
                        <p>{row.date}</p>
                      </td>
                      <td>
                        <strong>{row.guestDisplayName}</strong>
                        <p>
                          {row.accommodationCode} · {row.accommodationName}
                        </p>
                        <small>
                          {row.arrivalDate} → {row.departureDate}
                        </small>
                      </td>
                      <td>
                        {row.status ? label(row.status) : "Unexpired hold"}
                        {"finance" in row &&
                        row.finance &&
                        desk.permissions.finance ? (
                          <p>
                            Outstanding status:{" "}
                            {formatMoney(
                              row.finance.outstandingBalanceCents,
                              row.finance.currencyCode,
                            )}
                          </p>
                        ) : null}
                      </td>
                      <td>
                        {row.flags.length ? (
                          <ul>
                            {row.flags.map((flag) => (
                              <li key={flag.label}>{flag.label}</li>
                            ))}
                          </ul>
                        ) : (
                          "No flagged exception in authorized sources"
                        )}
                      </td>
                      <td>
                        <Link href={row.primaryHref}>
                          Open{" "}
                          {row.kind === "holds"
                            ? "holds desk"
                            : desk.permissions.finance
                              ? row.kind === "arrivals"
                                ? "check-in"
                                : "check-out"
                              : "reservation"}
                        </Link>
                        {row.secondaryHref ? (
                          <p>
                            <Link href={row.secondaryHref}>
                              Reservation record
                            </Link>
                          </p>
                        ) : null}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
        <section className="content-panel" aria-labelledby="desk-exceptions">
          <SectionHeading
            eyebrow="Separate canonical authority"
            title="Exception follow-up desks"
            id="desk-exceptions"
            helpTopic="campground.structure"
          />
          <ul>
            <li>
              <Link
                href={`/workspaces/management/campgrounds/reservations/arrival-readiness?${baseParam}`}
              >
                Guest pre-registration: review submitted plans and stale staff
                receipts
              </Link>
            </li>
            {desk.permissions.holds ? (
              <li>
                <Link
                  href={`/workspaces/management/campgrounds/availability/holds?${baseParam}`}
                >
                  Active temporary holds: inspect or release only with canonical
                  authority
                </Link>
              </li>
            ) : null}
            {desk.permissions.visitors ? (
              <li>
                <Link
                  href={`/workspaces/management/campgrounds/visitors?${baseParam}`}
                >
                  Visitor registration:{" "}
                  {desk.visitors.reduce((sum, row) => sum + row.issueCount, 0)}{" "}
                  payment/registration exceptions across{" "}
                  {desk.coverage.visitors?.shown ?? 0} displayed reservation
                  groups
                  {uncovered.length
                    ? ` (${uncovered.length} group(s) outside displayed stay rows)`
                    : ""}
                </Link>
              </li>
            ) : null}
            {desk.permissions.maintenance ? (
              <li>
                <Link href={`/workspaces/maintenance/work-orders?${baseParam}`}>
                  Maintenance: {siteWideOrders} open orders without a specific
                  accommodation; review all work orders and asset/section-wide
                  risks separately
                </Link>
              </li>
            ) : null}
            {desk.permissions.housekeeping ? (
              <li>
                <Link
                  href={`/workspaces/maintenance/cottage-turnover?${baseParam}`}
                >
                  Cottage turnover: inspect unfinished tasks before any
                  availability decision
                </Link>
              </li>
            ) : null}
          </ul>
          <p>
            Open work orders indicate attention, not an automatic availability
            block; only an explicit blocked state is labelled blocked. A
            complete housekeeping/safety release and inventory authority remain
            in their source workflows. Billing and outbound Omnichannel are
            HELD.
          </p>
        </section>
        <section className="content-panel" aria-labelledby="desk-coverage">
          <SectionHeading
            eyebrow="Source integrity & limitations"
            title="Coverage and permission readback"
            id="desk-coverage"
            helpTopic="campground.structure"
          />
          <ul>
            <Coverage name="reservations" entry={desk.coverage.reservations} />
            <Coverage name="holds" entry={desk.coverage.holds} />
            <Coverage name="visitors" entry={desk.coverage.visitors} />
            <Coverage name="maintenance" entry={desk.coverage.maintenance} />
            <Coverage name="turnovers" entry={desk.coverage.turnovers} />
          </ul>
          <p>
            Visitor counts are reservation groups with unresolved
            registration/payment *statuses*, not debt collection or payment
            authorization. Maintenance counts are accommodation/other-location
            groups; turnover counts are cottage groups. Visible reservation
            flags only include matching groups from the loaded snapshot. Scope
            and permissions were rechecked on the server, and the read uses one
            consistent database snapshot. Reload after taking any canonical
            action.
          </p>
        </section>
      </div>
    </AppShell>
  );
}
