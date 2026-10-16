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
import { getMyStaySettingsForStaff } from "@/lib/my-stay/postgres.mjs";

import { saveMyStaySettingsAction } from "./actions";
import styles from "../reservations/reservations.module.css";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "My Stay guest experience · iCamp",
  description:
    "Configure guest-facing rules, Wi-Fi guidance, assistance and safe handoff links for My Stay.",
};

export default async function GuestExperiencePage({
  searchParams,
}: Readonly<{
  searchParams: Promise<{ campground?: string; saved?: string }>;
}>) {
  const path = "/workspaces/management/campgrounds/guest-experience";
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
        return authorization?.permissions.includes("campground.configuration")
          ? campground
          : null;
      }),
    )
  ).filter((item): item is NonNullable<typeof item> => item !== null);

  if (authorized.length === 0) redirect("/auth/not-authorized");

  const selected =
    authorized.find((item) => item.campgroundId === params.campground) ??
    authorized[0];
  const snapshot = await getMyStaySettingsForStaff({
    userId: session.user.id,
    campgroundId: selected.campgroundId,
  });
  const settings = snapshot.settings;

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
          <span>My Stay guest experience</span>
        </nav>

        <section className="hero-panel">
          <p className="eyebrow">Build 051 · Guest experience</p>
          <h1>My Stay guest experience</h1>
          <p className="hero-panel__lead">
            Publish concise guest rules, Wi-Fi access guidance, assistance
            instructions and safe links into the authenticated My Stay portal.
          </p>
        </section>

        {params.saved ? (
          <div className={styles.notice}>{params.saved}</div>
        ) : null}

        <section className="content-panel">
          <SectionHeading
            eyebrow="Property scope"
            title="Choose campground"
            id="my-stay-config-scope"
            helpTopic="campground.structure"
          />
          <form method="get" className={styles.inlineForm}>
            <label>
              Campground
              <select name="campground" defaultValue={selected.campgroundId}>
                {authorized.map((campground) => (
                  <option
                    key={campground.campgroundId}
                    value={campground.campgroundId}
                  >
                    {campground.campgroundName}
                  </option>
                ))}
              </select>
            </label>
            <button className="primary-button" type="submit">
              Open guest experience
            </button>
          </form>
        </section>

        <section className="content-panel">
          <SectionHeading
            eyebrow={snapshot.campground.name}
            title="Published My Stay guidance"
            id="my-stay-config"
            helpTopic="campground.structure"
          />
          <form action={saveMyStaySettingsAction} className={styles.formGrid}>
            <input
              type="hidden"
              name="campgroundId"
              value={selected.campgroundId}
            />
            <input
              type="hidden"
              name="rowVersion"
              value={settings.rowVersion}
            />

            <label className={styles.full}>
              Guest rules summary
              <textarea
                name="guestRulesSummary"
                maxLength={4000}
                defaultValue={settings.guestRulesSummary ?? ""}
                placeholder="Quiet hours, fire rules, pet reminders, office expectations, etc."
              />
            </label>

            <label>
              Wi-Fi network name
              <input
                name="wifiNetworkName"
                maxLength={120}
                defaultValue={settings.wifiNetworkName ?? ""}
              />
            </label>

            <label className={styles.full}>
              Wi-Fi access instructions
              <textarea
                name="wifiAccessInstructions"
                maxLength={2000}
                defaultValue={settings.wifiAccessInstructions ?? ""}
                placeholder="Guest connection instructions. Do not place router/admin credentials here."
              />
            </label>

            <label className={styles.full}>
              Assistance instructions
              <textarea
                name="assistanceInstructions"
                maxLength={2000}
                defaultValue={settings.assistanceInstructions ?? ""}
                placeholder="Office hours, after-hours contact procedure, emergency guidance, etc."
              />
            </label>

            <label>
              Campground store link
              <input
                name="storeUrl"
                maxLength={2048}
                defaultValue={settings.storeUrl ?? ""}
                placeholder="/store or https://..."
              />
            </label>
            <label>
              Equipment rentals link
              <input
                name="rentalsUrl"
                maxLength={2048}
                defaultValue={settings.rentalsUrl ?? ""}
                placeholder="/rentals or https://..."
              />
            </label>
            <label>
              Events link
              <input
                name="eventsUrl"
                maxLength={2048}
                defaultValue={settings.eventsUrl ?? ""}
                placeholder="/events or https://..."
              />
            </label>
            <label>
              Local interests link
              <input
                name="localInterestsUrl"
                maxLength={2048}
                defaultValue={settings.localInterestsUrl ?? ""}
                placeholder="/local or https://..."
              />
            </label>
            <label>
              Assistance link
              <input
                name="assistanceUrl"
                maxLength={2048}
                defaultValue={settings.assistanceUrl ?? ""}
                placeholder="/help or https://..."
              />
            </label>

            <div className={styles.review + " " + styles.full}>
              Links are presentation handoffs only. Build 078 owns camper
              assistance, Builds 097–106 own events/local interests, Builds
              112–116 own rentals, and Build 121 owns the online store. My Stay
              never treats a link as a canonical booking/order/request record.
            </div>

            <button className="primary-button" type="submit">
              Save My Stay settings
            </button>
          </form>
        </section>

        <section className="content-panel">
          <h2>Privacy & security boundary</h2>
          <p>
            Wi-Fi and guest guidance are available only to authenticated guests
            with a confirmed or checked-in reservation for this campground.
            Direct anon/authenticated table access remains denied; application
            access uses the existing iCamp server/RLS boundary.
          </p>
          <p>
            Do not store network administration credentials, payment card data,
            alarm codes or infrastructure secrets in guest-facing fields.
          </p>
        </section>
      </div>
    </AppShell>
  );
}
