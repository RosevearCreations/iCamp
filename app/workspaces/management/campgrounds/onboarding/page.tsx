import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";

import { AppShell } from "@/components/app-shell";
import { listAccommodations } from "@/lib/accommodations/postgres.mjs";
import { requireStaff } from "@/lib/auth/current-session";
import {
  getCampgroundAuthorization,
  listAssignedCampgrounds,
} from "@/lib/authz/postgres.mjs";
import { onboardingReadiness289 } from "@/lib/build289/onboarding.mjs";
import { listCampgroundStructure } from "@/lib/campground-structure/postgres.mjs";
import { listMapImageVersions } from "@/lib/map-images/postgres.mjs";

export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "Campground setup wizard · iCamp",
  robots: { index: false, follow: false },
};
const root = "/workspaces/management/campgrounds";
const path = root + "/onboarding";

export default async function CampgroundOnboarding({
  searchParams,
}: Readonly<{ searchParams: Promise<{ campground?: string }> }>) {
  const session = await requireStaff(path);
  const { campground } = await searchParams;
  if (!campground) redirect("/campground");
  const authorization = await getCampgroundAuthorization(
    session.user.id,
    campground,
  );
  const permissions = authorization?.permissions ?? [];
  if (!permissions.includes("campground.configuration"))
    redirect("/auth/not-authorized");
  const assigned = await listAssignedCampgrounds(session.user.id);
  const selected = assigned.find((item) => item.campgroundId === campground);
  if (!selected) redirect("/auth/not-authorized");

  const [structure, accommodations, maps] = await Promise.allSettled([
    listCampgroundStructure(session.user.id, campground),
    permissions.some((permission) =>
      ["accommodation.read", "accommodation.manage"].includes(permission),
    )
      ? listAccommodations(session.user.id, campground)
      : Promise.resolve(null),
    permissions.includes("campground.map")
      ? listMapImageVersions(session.user.id, campground)
      : Promise.resolve(null),
  ]);
  const steps = onboardingReadiness289({
    structure: structure.status === "fulfilled" ? structure.value : null,
    accommodations:
      accommodations.status === "fulfilled" ? accommodations.value : null,
    maps: maps.status === "fulfilled" ? maps.value : null,
  });
  const routes: Record<string, string> = {
    property: root + "#campground-heading",
    sections: root + "#sections-heading",
    accommodations: root + "/accommodations",
    maps: root + "/maps",
  };
  function scoped(route: string) {
    const [pathname, hash] = route.split("#");
    return (
      pathname +
      "?campground=" +
      encodeURIComponent(campground ?? "") +
      (hash ? "#" + hash : "")
    );
  }
  return (
    <AppShell>
      <div className="page-stack">
        <section className="hero-panel">
          <h1>{selected.campgroundName} · Setup wizard</h1>
          <p>
            Signed in: {session.user.username ?? session.user.email} ·{" "}
            {authorization?.roleCodes.join(", ")}
          </p>
          <p>
            Follow the setup steps using existing authorized editors. Readiness
            is calculated from current records; an unavailable source does not
            count as complete. This wizard never activates or publishes a
            campground automatically.
          </p>
        </section>
        <section className="content-panel">
          <h2>Property and map setup</h2>
          <ol>
            {steps.map((step) => (
              <li key={step.key}>
                <h3>{step.title}</h3>
                <p>{step.state.replaceAll("_", " ")}</p>
                <Link href={scoped(routes[step.key])}>
                  Open authorized editor
                </Link>
              </li>
            ))}
          </ol>
          <p>
            {steps.filter((step) => step.state === "RECORDED").length} of{" "}
            {steps.length} initial record checks present. Not launch approval.
          </p>
        </section>
        <section className="content-panel">
          <h2>Operating configuration — review required</h2>
          <p>
            Review operating policies, amenities, service catalogue, staff
            access and financial settings before accepting real reservations.
            These checks are not certified by the initial record count.
          </p>
          <ul>
            <li><Link href={scoped(root + "/rules")}>Rules and policies</Link></li>
            <li><Link href={scoped(root + "/assets")}>Facilities and amenities</Link></li>
            <li><Link href={scoped(root + "/services")}>Services and charges</Link></li>
            <li><Link href={scoped(root + "/operations-centre265")}>Operations and support</Link></li>
          </ul>
          <p>
            Staff assignment, branding, season, tax and payment approval must
            be separately verified. No real payment or account is activated.
          </p>
        </section>
        <Link href={scoped(path)}>Refresh setup readiness</Link>
      </div>
    </AppShell>
  );
}
