import { randomUUID } from "node:crypto";

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
import { getTemporaryHoldWorkbench } from "@/lib/reservation-holds/postgres.mjs";

import {
  createTemporaryHoldAction,
  releaseTemporaryHoldAction,
  updateTemporaryHoldDurationAction,
} from "./actions";
import { HoldCountdown } from "./hold-countdown";
import { HoldSubmitButton } from "./submit-button";

export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "Temporary reservation holds · iCamp",
  description:
    "Create, monitor and release atomic temporary booking inventory holds.",
};

function isoDate(offsetDays: number) {
  const date = new Date(Date.now() + offsetDays * 86_400_000);
  return date.toISOString().slice(0, 10);
}

export default async function TemporaryReservationHoldsPage({
  searchParams,
}: Readonly<{ searchParams: Promise<Record<string, string | undefined>> }>) {
  const path = "/workspaces/management/campgrounds/availability/holds";
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
          ["reservation.read", "reservation.create"].includes(key),
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
  const [snapshot, workbench] = await Promise.all([
    getLiveAvailabilitySnapshot({
      userId: session.user.id,
      campgroundId: selected.campgroundId,
      arrivalDate,
      departureDate,
    }),
    getTemporaryHoldWorkbench({
      userId: session.user.id,
      campgroundId: selected.campgroundId,
    }),
  ]);
  const canCreate =
    selected.authorization.permissions.includes("reservation.create");
  const canConfigure = selected.authorization.permissions.includes(
    "campground.configuration",
  );
  const available = snapshot.items.filter((item) => item.available);
  const holdKey = randomUUID();

  return (
    <AppShell>
      <div className="page-stack">
        <nav className="breadcrumbs" aria-label="Breadcrumb">
          <Link href="/">iCamp</Link>
          <span>/</span>
          <Link href="/workspaces/management">Management</Link>
          <span>/</span>
          <Link href="/workspaces/management/campgrounds">Campgrounds</Link>
          <span>/</span>
          <Link href="/workspaces/management/campgrounds/availability">
            Live availability
          </Link>
          <span>/</span>
          <span>Temporary holds</span>
        </nav>

        <section className="hero-panel">
          <SectionHeading
            eyebrow="Booking inventory"
            title="Atomic temporary reservation holds"
            id="temporary-holds-title"
            helpTopic="campground.structure"
          />
          <p>
            Each request has one idempotency key, serializes against the same
            server-authoritative inventory used by reservations, and expires
            automatically at the campground-configured deadline.
          </p>
        </section>

        {params.saved ? (
          <section className="content-card" role="status">
            <strong>{params.saved}</strong>
          </section>
        ) : null}

        <section className="content-card">
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
            <button type="submit">Refresh hold window</button>
          </form>
        </section>

        {canConfigure ? (
          <section className="content-card">
            <h2>Hold duration</h2>
            <form
              action={updateTemporaryHoldDurationAction}
              className="form-grid"
            >
              <input
                type="hidden"
                name="campgroundId"
                value={selected.campgroundId}
              />
              <input type="hidden" name="arrivalDate" value={arrivalDate} />
              <input type="hidden" name="departureDate" value={departureDate} />
              <label>
                Minutes
                <input
                  type="number"
                  min="2"
                  max="60"
                  step="1"
                  name="durationMinutes"
                  defaultValue={workbench.holdDurationMinutes}
                  required
                />
              </label>
              <HoldSubmitButton idle="Save duration" pending="Saving…" />
            </form>
          </section>
        ) : null}

        <section className="content-card">
          <h2>Create hold</h2>
          {canCreate && available.length > 0 ? (
            <form action={createTemporaryHoldAction} className="form-grid">
              <input
                type="hidden"
                name="campgroundId"
                value={selected.campgroundId}
              />
              <input type="hidden" name="arrivalDate" value={arrivalDate} />
              <input type="hidden" name="departureDate" value={departureDate} />
              <input type="hidden" name="holdKey" value={holdKey} />
              <label>
                Available accommodation
                <select name="accommodationId" required>
                  {available.map((item) => (
                    <option
                      key={item.accommodationId}
                      value={item.accommodationId}
                    >
                      {item.code} · {item.displayName}
                    </option>
                  ))}
                </select>
              </label>
              <HoldSubmitButton
                idle={`Hold for ${workbench.holdDurationMinutes} minutes`}
                pending="Creating hold…"
              />
            </form>
          ) : (
            <p className="muted">
              {canCreate
                ? "No accommodation is currently available for this date window."
                : "Reservation-create permission is required to create a hold."}
            </p>
          )}
        </section>

        <section className="content-card">
          <h2>Active holds</h2>
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Accommodation</th>
                  <th>Stay</th>
                  <th>Countdown</th>
                  <th>State</th>
                  <th>Action</th>
                </tr>
              </thead>
              <tbody>
                {workbench.holds.length ? (
                  workbench.holds.map((hold) => (
                    <tr key={hold.id}>
                      <td>
                        {hold.accommodationCode ?? hold.accommodationId}
                        {hold.accommodationName
                          ? ` · ${hold.accommodationName}`
                          : ""}
                      </td>
                      <td>
                        {hold.arrivalDate} → {hold.departureDate}
                      </td>
                      <td>
                        <HoldCountdown expiresAt={hold.expiresAt} />
                      </td>
                      <td>{hold.holdState}</td>
                      <td>
                        {canCreate ? (
                          <form action={releaseTemporaryHoldAction}>
                            <input
                              type="hidden"
                              name="campgroundId"
                              value={selected.campgroundId}
                            />
                            <input
                              type="hidden"
                              name="arrivalDate"
                              value={arrivalDate}
                            />
                            <input
                              type="hidden"
                              name="departureDate"
                              value={departureDate}
                            />
                            <input
                              type="hidden"
                              name="holdId"
                              value={hold.id}
                            />
                            <input
                              type="hidden"
                              name="holdKey"
                              value={hold.holdKey}
                            />
                            <HoldSubmitButton
                              idle="Release"
                              pending="Releasing…"
                            />
                          </form>
                        ) : (
                          "—"
                        )}
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={5}>No active temporary holds.</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </section>

        <section className="content-card">
          <h2>Channel contract</h2>
          <p>
            <strong>Web/PWA:</strong> create, live countdown, expiry
            reconciliation and explicit release.
          </p>
          <p>
            <strong>IVR/DTMF:</strong> future booking menus call the same atomic
            server hold command; countdown is spoken as remaining minutes.
          </p>
          <p>
            <strong>SMS/MMS:</strong> future booking flows call the same atomic
            command and can return the server expiry time in a secure booking
            continuation.
          </p>
        </section>
      </div>
    </AppShell>
  );
}
