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
import { getLiveAvailabilitySnapshot } from "@/lib/live-availability/postgres.mjs";

import { AvailabilityLiveRefresh } from "./live-refresh";

export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "Live availability · iCamp",
  description:
    "Server-authoritative accommodation availability across reservations, holds and operational blockers.",
};

function isoDate(offsetDays: number) {
  const date = new Date(Date.now() + offsetDays * 86400000);
  return date.toISOString().slice(0, 10);
}

export default async function LiveAvailabilityPage({
  searchParams,
}: Readonly<{ searchParams: Promise<Record<string, string | undefined>> }>) {
  const path = "/workspaces/management/campgrounds/availability";
  const session = await requireStaff(path);
  const params = await searchParams;
  const assigned = await listAssignedCampgrounds(session.user.id);
  const authorized = (
    await Promise.all(
      assigned.map(async (campground) => {
        const authorization = await getCampgroundAuthorization(
          session.user.id,
          campground.campgroundId,
        );
        return authorization?.permissions.some((key) =>
          [
            "reservation.read",
            "reservation.create",
            "reservation.modify",
            "accommodation.read",
            "campground.operations.manage",
          ].includes(key),
        )
          ? { ...campground, authorization }
          : null;
      }),
    )
  ).filter((item): item is NonNullable<typeof item> => item !== null);
  if (authorized.length === 0) redirect("/auth/not-authorized");

  const selected =
    authorized.find((item) => item.campgroundId === params.campground) ??
    authorized[0];
  const arrivalDate = params.arrivalDate ?? isoDate(0);
  const departureDate = params.departureDate ?? isoDate(1);
  const snapshot = await getLiveAvailabilitySnapshot({
    userId: session.user.id,
    campgroundId: selected.campgroundId,
    arrivalDate,
    departureDate,
  });

  return (
    <AppShell>
      <AvailabilityLiveRefresh />
      <div className="page-stack">
        <nav className="breadcrumbs" aria-label="Breadcrumb">
          <Link href="/">iCamp</Link>
          <span>/</span>
          <Link href="/workspaces/management">Management</Link>
          <span>/</span>
          <Link href="/workspaces/management/campgrounds">Campgrounds</Link>
          <span>/</span>
          <span>Live availability</span>
        </nav>
        <section className="hero-panel">
          <SectionHeading
            eyebrow="Booking inventory"
            title="Server-authoritative live availability"
            id="live-availability-title"
            helpTopic="campground.structure"
          />
          <p>
            A ten-second live refresh combines reservations, temporary holds,
            management closures/holds, unresolved cottage turnover and seasonal
            assignments.
          </p>
        </section>
        <section className="content-card">
          <p>
            <Link
              href={`/workspaces/management/campgrounds/availability/holds?campground=${encodeURIComponent(selected.campgroundId)}&arrivalDate=${encodeURIComponent(arrivalDate)}&departureDate=${encodeURIComponent(departureDate)}`}
            >
              Manage atomic temporary holds →
            </Link>
          </p>
          <form method="get" className="form-grid">
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
              Arrival
              <input
                type="date"
                name="arrivalDate"
                defaultValue={arrivalDate}
                required
              />
            </label>
            <label>
              Departure
              <input
                type="date"
                name="departureDate"
                defaultValue={departureDate}
                required
              />
            </label>
            <button type="submit">Refresh availability</button>
          </form>
          <p className="muted">
            Generated {snapshot.generatedAt} · revision {snapshot.revision}
          </p>
        </section>
        <section className="content-card">
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Accommodation</th>
                  <th>Kind</th>
                  <th>Availability</th>
                  <th>Authoritative blockers</th>
                  <th>Revision</th>
                </tr>
              </thead>
              <tbody>
                {snapshot.items.map((item) => (
                  <tr key={item.accommodationId}>
                    <td>
                      {item.code} · {item.displayName}
                    </td>
                    <td>{item.accommodationKind.replaceAll("_", " ")}</td>
                    <td>{item.available ? "Available" : "Blocked"}</td>
                    <td>
                      {item.blockers.length ? item.blockers.join(", ") : "None"}
                    </td>
                    <td>{item.availabilityRevision}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
        <section className="content-card">
          <h2>Channel contract</h2>
          <p>
            <strong>Web/PWA:</strong> full live availability table and automatic
            refresh.
          </p>
          <p>
            <strong>IVR/DTMF:</strong> server availability may be read by future
            booking flows; visual table has staff-assisted fallback.
          </p>
          <p>
            <strong>SMS/MMS:</strong> server availability may be read by future
            booking flows; visual table has secure-link/staff-assisted fallback.
          </p>
        </section>
      </div>
    </AppShell>
  );
}
