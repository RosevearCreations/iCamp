import type { Metadata } from "next";
import Link from "next/link";

import { AppShell } from "@/components/app-shell";
import { requireSignedIn } from "@/lib/auth/current-session";
import { getOwnAccountProfile } from "@/lib/auth/profile-postgres.mjs";

import { saveAccountProfileAction } from "./actions";

export const metadata: Metadata = {
  title: "My account profile · iCamp",
};
export const dynamic = "force-dynamic";

export default async function AccountProfilePage({
  searchParams,
}: Readonly<{ searchParams: Promise<{ status?: string }> }>) {
  const session = await requireSignedIn("/auth/profile");
  const profile = await getOwnAccountProfile(session.user.id);
  const params = await searchParams;

  return (
    <AppShell>
      <main className="page-stack">
        <section className="hero-panel">
          <p className="eyebrow">Personal account</p>
          <h1>My iCamp profile</h1>
          <p className="hero-panel__lead">
            Update personal display preferences independently of campground
            permissions, reservations, staff roles and application
            administration.
          </p>
        </section>
        <section className="content-panel auth-panel">
          {params.status === "saved" ? (
            <p role="status">Profile saved.</p>
          ) : null}
          {params.status === "invalid" ? (
            <p role="alert">Profile not saved. Check the supplied values.</p>
          ) : null}
          <p>Username: {session.user.username ?? "Not set"}</p>
          <p>Account type: {session.user.accountType}</p>
          <form className="auth-form" action={saveAccountProfileAction}>
            <label>
              Display name
              <input
                name="displayName"
                maxLength={100}
                defaultValue={profile.display_name}
              />
            </label>
            <label>
              Preferred contact (preference only)
              <select
                name="preferredContact"
                defaultValue={profile.preferred_contact}
              >
                <option value="none">No preference</option>
                <option value="email">Email</option>
                <option value="phone">Phone</option>
              </select>
            </label>
            <button className="primary-button" type="submit">
              Save profile
            </button>
          </form>
          <p>
            This does not enroll you in marketing, override booking consent or
            activate a disabled account.
          </p>
          <Link href="/auth/account">Back to account</Link>
        </section>
      </main>
    </AppShell>
  );
}
