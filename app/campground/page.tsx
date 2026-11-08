import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";

import { AppShell } from "@/components/app-shell";
import { requireStaff } from "@/lib/auth/current-session";
import {
  getCampgroundAuthorization,
  listAssignedCampgrounds,
} from "@/lib/authz/postgres.mjs";

export const metadata: Metadata = {
  title: "Campground workspace · iCamp",
  robots: { index: false, follow: false },
};
export const dynamic = "force-dynamic";

export default async function CampgroundPage({
  searchParams,
}: Readonly<{
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}>) {
  const session = await requireStaff("/campground");
  const assigned = await listAssignedCampgrounds(session.user.id);
  if (!assigned.length) redirect("/auth/not-authorized");

  const requested = (await searchParams).campground;
  if (
    requested !== undefined &&
    (typeof requested !== "string" ||
      !assigned.some((item) => item.campgroundId === requested))
  ) {
    redirect("/auth/not-authorized");
  }
  const selected =
    assigned.find((item) => item.campgroundId === requested) ?? assigned[0];
  // Verify the active authorization again before showing tenant navigation.
  const authorization = await getCampgroundAuthorization(
    session.user.id,
    selected.campgroundId,
  );
  if (!authorization) redirect("/auth/not-authorized");
  const scope = `campground=${encodeURIComponent(selected.campgroundId)}`;

  return (
    <AppShell>
      <div className="page-stack standard-ops-page">
        <section className="hero-panel meadow-hero">
          <p className="eyebrow">Campground operations · Build 232</p>
          <h1>{selected.campgroundName}</h1>
          <p className="hero-panel__lead">
            Your assigned campground workspace. Bookings, guest services,
            amenities and maintenance stay within this tenant&apos;s
            permissions.
          </p>
        </section>
        {assigned.length > 1 ? (
          <section
            className="content-panel"
            aria-label="Switch assigned campground"
          >
            <h2>Your assigned campgrounds</h2>
            <ul>
              {assigned.map((item) => (
                <li key={item.campgroundId}>
                  <Link
                    href={`/campground?campground=${encodeURIComponent(item.campgroundId)}`}
                    aria-current={
                      item.campgroundId === selected.campgroundId
                        ? "page"
                        : undefined
                    }
                  >
                    {item.campgroundName}
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        ) : null}
        <section className="content-panel">
          <h2>Campground management</h2>
          <ul>
            <li>
              <Link href={`/workspaces/management/campgrounds?${scope}`}>
                Campground overview
              </Link>
            </li>
            <li>
              <Link
                href={`/workspaces/management/campgrounds/reservations?${scope}`}
              >
                Reservations and stays
              </Link>
            </li>
            <li>
              <Link
                href={`/workspaces/management/campgrounds/amenity-status?${scope}`}
              >
                Amenity availability and maintenance
              </Link>
            </li>
            <li>
              <Link
                href={`/workspaces/management/campgrounds/maps/wayfinding/services?${scope}`}
              >
                Guest services and accessible wayfinding
              </Link>
            </li>
          </ul>
          <p>Available actions are checked again by each campground module.</p>
        </section>
      </div>
    </AppShell>
  );
}
