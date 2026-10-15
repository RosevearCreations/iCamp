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
import { listGuestProfileDesk } from "@/lib/guest-profile/postgres.mjs";

import { saveStaffGuestProfileAction } from "./actions";
import styles from "../reservations/reservations.module.css";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Guest profiles · iCamp",
  description:
    "Manage optional guest profiles, saved stay information and guest history.",
};

export default async function GuestProfileDeskPage({
  searchParams,
}: Readonly<{
  searchParams: Promise<{
    campground?: string;
    saved?: string;
    error?: string;
  }>;
}>) {
  const path = "/workspaces/management/campgrounds/guests";
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
        return authorization?.permissions.some((permission) =>
          ["guest.read", "guest.manage"].includes(permission),
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
  const profiles = await listGuestProfileDesk({
    userId: session.user.id,
    campgroundId: selected.campgroundId,
  });
  const mayManage =
    selected.authorization.permissions.includes("guest.manage");

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
          <span>Guests</span>
        </nav>

        <section className="hero-panel">
          <p className="eyebrow">Build 048 · Guest, Front Desk & privacy</p>
          <h1>Guest profiles & saved stay information</h1>
          <p className="hero-panel__lead">
            Keep one canonical guest profile for future stays, optionally link
            it to a guest account, and reuse RV, vehicle and pet details without
            rewriting historical reservation, payment or receipt evidence.
          </p>
        </section>

        {params.saved ? <div className={styles.notice}>{params.saved}</div> : null}
        {params.error ? (
          <div className={styles.notice + " " + styles.error}>
            {params.error}
          </div>
        ) : null}

        <section className="content-panel">
          <SectionHeading
            eyebrow="Property scope"
            title="Guest desk"
            id="guest-desk-scope"
            helpTopic="campground.structure"
          />
          <form method="get" className={styles.inlineForm}>
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
            <button className="secondary-button" type="submit">
              Switch campground
            </button>
          </form>
        </section>

        {mayManage ? (
          <section className="content-panel">
            <SectionHeading
              eyebrow="Optional profile"
              title="Create a guest profile"
              id="create-guest-profile"
              helpTopic="auth.sessions"
            />
            <p>
              An iCamp login is optional. Leave account email blank for an
              office-only profile, or enter an existing active guest-account
              email to link the profile.
            </p>
            <form action={saveStaffGuestProfileAction} className={styles.formGrid}>
              <input
                type="hidden"
                name="campgroundId"
                value={selected.campgroundId}
              />
              <label>
                First name
                <input name="firstName" maxLength={80} required />
              </label>
              <label>
                Last name
                <input name="lastName" maxLength={80} required />
              </label>
              <label>
                Preferred name
                <input name="preferredName" maxLength={80} />
              </label>
              <label>
                Contact email
                <input name="contactEmail" type="email" maxLength={254} />
              </label>
              <label>
                Contact phone
                <input name="contactPhone" maxLength={40} />
              </label>
              <label>
                Optional existing account email
                <input name="accountEmail" type="email" maxLength={320} />
              </label>
              <label>
                Preferred contact
                <select name="preferredContactChannel" defaultValue="email">
                  <option value="email">Email</option>
                  <option value="sms">SMS</option>
                  <option value="phone">Phone</option>
                  <option value="none">No preference</option>
                </select>
              </label>
              <label className={styles.full}>
                <input
                  type="checkbox"
                  name="saveStayPreferences"
                  defaultChecked
                />{" "}
                Guest permits reusable stay details to be retained.
              </label>
              <label className={styles.full}>
                <input
                  type="checkbox"
                  name="allowStaffProfileLookup"
                  defaultChecked
                />{" "}
                Guest permits ordinary future-stay profile lookup.
              </label>
              <button className="primary-button" type="submit">
                Create guest profile
              </button>
            </form>
          </section>
        ) : null}

        <section className="content-panel">
          <SectionHeading
            eyebrow="Canonical profiles"
            title={selected.campgroundName}
            id="guest-profile-list"
            helpTopic="auth.sessions"
          />
          <div className={styles.tableWrap}>
            <table>
              <thead>
                <tr>
                  <th>Guest</th>
                  <th>Contact</th>
                  <th>Account</th>
                  <th>Saved info</th>
                  <th>Stay history</th>
                  <th>Privacy</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {profiles.map((profile) => (
                  <tr key={profile.id}>
                    <td>
                      {profile.firstName} {profile.lastName}
                      {profile.preferredName ? (
                        <>
                          <br />
                          <small>{profile.preferredName}</small>
                        </>
                      ) : null}
                    </td>
                    <td>
                      {profile.contactEmail ?? "—"}
                      <br />
                      <small>{profile.contactPhone ?? "No phone"}</small>
                    </td>
                    <td>{profile.userAccountId ? "Linked" : "Optional / none"}</td>
                    <td>
                      {profile.rvCount} RV · {profile.vehicleCount} vehicle ·{" "}
                      {profile.petCount} pet
                    </td>
                    <td>{profile.stayCount}</td>
                    <td>
                      {profile.saveStayPreferences ? "Save on" : "Save off"} ·{" "}
                      {profile.allowStaffProfileLookup
                        ? "lookup on"
                        : "lookup restricted"}
                    </td>
                    <td>
                      <Link
                        href={
                          "/workspaces/management/campgrounds/guests/" +
                          encodeURIComponent(profile.id) +
                          "?campground=" +
                          encodeURIComponent(selected.campgroundId)
                        }
                      >
                        Open →
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {profiles.length === 0 ? <p>No guest profiles are available.</p> : null}
        </section>

        <section className="content-panel">
          <h2>Channel contract & privacy boundary</h2>
          <p>
            <strong>Web/PWA:</strong> full Front Desk profile lookup, profile
            management, saved-stay review and history.
          </p>
          <p>
            <strong>IVR/DTMF:</strong> verified guest/staff status lookup and
            guided updates use the same server authorization; complex profile
            edits fall back to verified staff assistance or secure web handoff.
          </p>
          <p>
            <strong>SMS/MMS:</strong> concise verified status and secure-link
            handoff are supported. Sensitive profile details are never echoed
            before identity verification.
          </p>
          <p>
            Build 014 remains the source of truth for messaging consent.
            Build 053 will own formal road-vehicle plate/jurisdiction
            registration; Build 048 stores only reusable travel descriptions.
          </p>
        </section>
      </div>
    </AppShell>
  );
}
