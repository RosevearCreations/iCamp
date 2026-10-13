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
import { evaluateCapacityRules } from "@/lib/capacity-rules/core.mjs";
import { getCapacityRuleSnapshot } from "@/lib/capacity-rules/postgres.mjs";

import {
  archiveCapacityLimitRuleAction,
  createCapacityLimitRuleAction,
} from "./actions";
import styles from "./capacity-rules.module.css";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Capacity, guest & vehicle limits · iCamp",
  description:
    "Manage campground occupant, visitor and vehicle limits by campground, type, section, accommodation and campsite size.",
};

function titleCase(value: string) {
  return value
    .replaceAll("_", " ")
    .replace(/\b\w/gu, (letter) => letter.toUpperCase());
}

function limitText(value: number | null | undefined) {
  return value === null || value === undefined ? "Not set" : String(value);
}

export default async function CapacityRulesPage({
  searchParams,
}: Readonly<{
  searchParams: Promise<{
    campground?: string;
    saved?: string;
    accommodation?: string;
    occupants?: string;
    visitors?: string;
    vehicles?: string;
  }>;
}>) {
  const path = "/workspaces/management/campgrounds/capacity-rules";
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
          ? { ...campground, authorization }
          : null;
      }),
    )
  ).filter((item): item is NonNullable<typeof item> => item !== null);

  if (authorized.length === 0) {
    redirect("/auth/not-authorized");
  }

  const selected =
    authorized.find((item) => item.campgroundId === params.campground) ??
    authorized[0];
  const snapshot = await getCapacityRuleSnapshot(
    session.user.id,
    selected.campgroundId,
  );
  const activeRules = snapshot.rules.filter((rule) => rule.isActive);
  const measuredCampsites = snapshot.accommodations.filter(
    (item) =>
      item.accommodationKind === "campsite" &&
      item.siteAreaSquareMeters !== null,
  ).length;

  const sectionNames = new Map(
    snapshot.sections.map((section) => [section.id, section.name]),
  );
  const accommodationNames = new Map(
    snapshot.accommodations.map((accommodation) => [
      accommodation.id,
      accommodation.code + " · " + accommodation.displayName,
    ]),
  );

  function scopeLabel(rule: (typeof snapshot.rules)[number]) {
    if (rule.scopeKind === "campground") {
      return "Whole campground";
    }
    if (rule.scopeKind === "section") {
      return (
        "Section · " + (sectionNames.get(rule.sectionId ?? "") ?? "Unknown")
      );
    }
    if (rule.scopeKind === "accommodation_type") {
      return "Type · " + titleCase(rule.accommodationKind ?? "unknown");
    }
    return (
      "Accommodation · " +
      (accommodationNames.get(rule.accommodationId ?? "") ?? "Unknown")
    );
  }

  function areaBand(rule: (typeof snapshot.rules)[number]) {
    if (
      rule.minimumSiteAreaSquareMeters === null &&
      rule.maximumSiteAreaSquareMeters === null
    ) {
      return "All site sizes";
    }
    return (
      (rule.minimumSiteAreaSquareMeters ?? "Any") +
      "–" +
      (rule.maximumSiteAreaSquareMeters ?? "Any") +
      " m²"
    );
  }

  const previewAccommodation = params.accommodation
    ? snapshot.accommodations.find((item) => item.id === params.accommodation)
    : null;
  let preview: ReturnType<typeof evaluateCapacityRules> | null = null;
  let previewError: string | null = null;

  if (params.accommodation) {
    if (!previewAccommodation) {
      previewError = "Choose an accommodation that belongs to this campground.";
    } else {
      try {
        preview = evaluateCapacityRules({
          rules: snapshot.rules,
          context: {
            accommodationId: previewAccommodation.id,
            accommodationKind: previewAccommodation.accommodationKind,
            sectionId: previewAccommodation.sectionId,
            siteAreaSquareMeters: previewAccommodation.siteAreaSquareMeters,
            physicalMaxOccupancy: previewAccommodation.physicalMaxOccupancy,
          },
          occupants: params.occupants ?? "1",
          visitors: params.visitors ?? "0",
          vehicles: params.vehicles ?? "1",
        });
      } catch (error) {
        previewError =
          error instanceof Error ? error.message : "Unable to evaluate limits.";
      }
    }
  }

  return (
    <AppShell>
      <div className="page-stack">
        <nav className="breadcrumbs" aria-label="Breadcrumb">
          <Link href="/">iCamp</Link>
          <span aria-hidden="true">/</span>
          <Link href="/workspaces/management">Management</Link>
          <span aria-hidden="true">/</span>
          <Link href="/workspaces/management/campgrounds">Campgrounds</Link>
          <span aria-hidden="true">/</span>
          <span>Capacity rules</span>
        </nav>

        <section className="hero-panel">
          <p className="eyebrow">Build 033</p>
          <h1>Capacity, guest &amp; vehicle limits</h1>
          <p className="hero-panel__lead">
            Layer occupant, visitor and vehicle limits from the campground down
            to an individual accommodation, with optional campsite-size bands
            and a server-authoritative preview of the effective rule.
          </p>
        </section>

        {params.saved ? (
          <div className={styles.notice}>{params.saved}</div>
        ) : null}

        <section className="content-panel" aria-labelledby="scope-heading">
          <SectionHeading
            eyebrow="Property scope"
            title="Choose campground"
            id="scope-heading"
            helpTopic="campground.structure"
          />
          <form method="get" className={styles.selector}>
            <label className={styles.field}>
              <span>Campground</span>
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
              Open capacity rules
            </button>
          </form>
        </section>

        <section className="content-panel" aria-labelledby="summary-heading">
          <SectionHeading
            eyebrow="Rule readiness"
            title="Current capacity-rule summary"
            id="summary-heading"
            helpTopic="campground.structure"
            trailing={<span className="build-chip">Build 033</span>}
          />
          <div className={styles.metrics}>
            <div>
              <span>Active rules</span>
              <strong>{activeRules.length}</strong>
            </div>
            <div>
              <span>Accommodations</span>
              <strong>{snapshot.accommodations.length}</strong>
            </div>
            <div>
              <span>Sections</span>
              <strong>{snapshot.sections.length}</strong>
            </div>
            <div>
              <span>Measured campsites</span>
              <strong>{measuredCampsites}</strong>
            </div>
          </div>
          <p className={styles.boundary}>
            Precedence is campground → accommodation type → section → individual
            accommodation. Within the same scope, a matching campsite-size band
            overrides that scope&apos;s default fields. Unspecified limits
            inherit from broader matching rules.
          </p>
        </section>

        <section className="content-panel" aria-labelledby="create-heading">
          <SectionHeading
            eyebrow="Configuration"
            title="Add a capacity rule"
            id="create-heading"
            helpTopic="campground.structure"
          />
          <p className={styles.boundary}>
            Set at least one limit. Site-area bands are optional, inclusive and
            may not overlap another active band in the same exact scope.
            Size-banded rules apply only when a campsite has both length and
            width measurements.
          </p>

          <form
            action={createCapacityLimitRuleAction}
            className={styles.formGrid}
          >
            <input
              type="hidden"
              name="campgroundId"
              value={selected.campgroundId}
            />
            <label className={styles.field}>
              <span>Rule scope</span>
              <select name="scopeKind" defaultValue="campground">
                <option value="campground">Whole campground</option>
                <option value="accommodation_type">Accommodation type</option>
                <option value="section">Section</option>
                <option value="accommodation">Individual accommodation</option>
              </select>
            </label>
            <label className={styles.field}>
              <span>Section target</span>
              <select name="sectionId" defaultValue="">
                <option value="">Used only for section scope</option>
                {snapshot.sections.map((section) => (
                  <option key={section.id} value={section.id}>
                    {section.code} · {section.name}
                  </option>
                ))}
              </select>
            </label>
            <label className={styles.field}>
              <span>Accommodation type target</span>
              <select name="accommodationKind" defaultValue="campsite">
                <option value="campsite">Campsite</option>
                <option value="rental_cottage">Rental cottage</option>
                <option value="permanent_unit">Permanent unit</option>
              </select>
            </label>
            <label className={styles.field}>
              <span>Individual accommodation target</span>
              <select name="accommodationId" defaultValue="">
                <option value="">Used only for individual scope</option>
                {snapshot.accommodations.map((accommodation) => (
                  <option key={accommodation.id} value={accommodation.id}>
                    {accommodation.code} · {accommodation.displayName} ·{" "}
                    {titleCase(accommodation.accommodationKind)}
                  </option>
                ))}
              </select>
            </label>
            <label className={styles.field}>
              <span>Minimum campsite area (m²)</span>
              <input
                name="minimumSiteAreaSquareMeters"
                type="number"
                min="0.01"
                step="0.01"
              />
            </label>
            <label className={styles.field}>
              <span>Maximum campsite area (m²)</span>
              <input
                name="maximumSiteAreaSquareMeters"
                type="number"
                min="0.01"
                step="0.01"
              />
            </label>
            <label className={styles.field}>
              <span>Maximum occupants</span>
              <input name="maxOccupants" type="number" min="1" max="80" />
            </label>
            <label className={styles.field}>
              <span>Maximum visitors</span>
              <input name="maxVisitors" type="number" min="0" max="80" />
            </label>
            <label className={styles.field}>
              <span>Maximum vehicles</span>
              <input name="maxVehicles" type="number" min="0" max="20" />
            </label>
            <label className={styles.field + " " + styles.full}>
              <span>Operations note</span>
              <textarea name="notes" maxLength={1000} />
            </label>
            <div className={styles.actions}>
              <button className="primary-button" type="submit">
                Add capacity rule
              </button>
            </div>
          </form>
        </section>

        <section className="content-panel" aria-labelledby="rules-heading">
          <SectionHeading
            eyebrow="Layered rules"
            title="Capacity rule library"
            id="rules-heading"
            helpTopic="campground.structure"
          />
          <p className={styles.boundary}>
            Rules are append-preserved. Archive a superseded rule and create its
            replacement rather than rewriting historical configuration.
          </p>

          <div className={styles.ruleGrid}>
            {snapshot.rules.map((rule) => (
              <article className={styles.ruleCard} key={rule.id}>
                <header>
                  <div>
                    <p className={styles.kicker}>{scopeLabel(rule)}</p>
                    <h3>{areaBand(rule)}</h3>
                  </div>
                  <span className={styles.state}>
                    {rule.isActive ? "active" : "archived"}
                  </span>
                </header>
                <div className={styles.limitLine}>
                  <span>Occupants: {limitText(rule.maxOccupants)}</span>
                  <span>Visitors: {limitText(rule.maxVisitors)}</span>
                  <span>Vehicles: {limitText(rule.maxVehicles)}</span>
                </div>
                <p>Row revision {rule.rowVersion}</p>
                {rule.notes ? <p>{rule.notes}</p> : null}
                {rule.isActive ? (
                  <form action={archiveCapacityLimitRuleAction}>
                    <input
                      type="hidden"
                      name="campgroundId"
                      value={selected.campgroundId}
                    />
                    <input type="hidden" name="ruleId" value={rule.id} />
                    <input
                      type="hidden"
                      name="rowVersion"
                      value={rule.rowVersion}
                    />
                    <button className="primary-button" type="submit">
                      Archive rule
                    </button>
                  </form>
                ) : null}
              </article>
            ))}
            {snapshot.rules.length === 0 ? (
              <p className={styles.empty}>No capacity rules configured yet.</p>
            ) : null}
          </div>
        </section>

        <section className="content-panel" aria-labelledby="preview-heading">
          <SectionHeading
            eyebrow="Rule preview"
            title="Test guest and vehicle counts"
            id="preview-heading"
            helpTopic="campground.structure"
          />
          {snapshot.accommodations.length > 0 ? (
            <form method="get" className={styles.formGrid}>
              <input
                type="hidden"
                name="campground"
                value={selected.campgroundId}
              />
              <label className={styles.field + " " + styles.full}>
                <span>Accommodation</span>
                <select
                  name="accommodation"
                  defaultValue={
                    params.accommodation ?? snapshot.accommodations[0]?.id
                  }
                  required
                >
                  {snapshot.accommodations.map((accommodation) => (
                    <option key={accommodation.id} value={accommodation.id}>
                      {accommodation.code} · {accommodation.displayName} ·{" "}
                      {accommodation.sectionName}
                    </option>
                  ))}
                </select>
              </label>
              <label className={styles.field}>
                <span>Occupants</span>
                <input
                  name="occupants"
                  type="number"
                  min="1"
                  max="80"
                  defaultValue={params.occupants ?? "1"}
                  required
                />
              </label>
              <label className={styles.field}>
                <span>Visitors</span>
                <input
                  name="visitors"
                  type="number"
                  min="0"
                  max="80"
                  defaultValue={params.visitors ?? "0"}
                  required
                />
              </label>
              <label className={styles.field}>
                <span>Vehicles</span>
                <input
                  name="vehicles"
                  type="number"
                  min="0"
                  max="20"
                  defaultValue={params.vehicles ?? "1"}
                  required
                />
              </label>
              <div className={styles.actions}>
                <button className="primary-button" type="submit">
                  Evaluate capacity
                </button>
              </div>
            </form>
          ) : (
            <p className={styles.empty}>
              Add an accommodation before previewing capacity rules.
            </p>
          )}

          {previewError ? (
            <div className={styles.previewBad}>{previewError}</div>
          ) : preview && previewAccommodation ? (
            <div
              className={
                preview.eligible ? styles.previewGood : styles.previewBad
              }
            >
              <strong>
                {preview.eligible
                  ? "Capacity rules pass."
                  : "Capacity rules need attention."}
              </strong>
              <p>
                {previewAccommodation.code} ·{" "}
                {titleCase(previewAccommodation.accommodationKind)} · section{" "}
                {previewAccommodation.sectionName}
              </p>
              <p>
                Effective limits — occupants{" "}
                {preview.effectiveLimits.maxOccupants ?? "not set"}, visitors{" "}
                {preview.effectiveLimits.maxVisitors ?? "not set"}, vehicles{" "}
                {preview.effectiveLimits.maxVehicles ?? "not set"}.
              </p>
              <p>
                Site area: {preview.siteAreaSquareMeters ?? "not measured"} m² ·
                applied rules: {preview.appliedRuleIds.length}
                {preview.physicalMaxOccupancy !== null
                  ? " · physical cottage occupancy " +
                    preview.physicalMaxOccupancy
                  : ""}
              </p>
              {!preview.configured ? (
                <p>
                  No matching configurable capacity limit is active for this
                  accommodation yet.
                </p>
              ) : null}
              {preview.issues.length > 0 ? (
                <ul>
                  {preview.issues.map((issue) => (
                    <li key={issue}>{issue}</li>
                  ))}
                </ul>
              ) : null}
            </div>
          ) : (
            <p className={styles.empty}>
              Choose an accommodation and counts to preview the effective
              layered capacity rules.
            </p>
          )}
        </section>

        <section className="content-panel" aria-labelledby="boundary-heading">
          <SectionHeading
            eyebrow="Build boundary"
            title="Capacity is not compatibility or live availability"
            id="boundary-heading"
            helpTopic="campground.structure"
          />
          <p className={styles.boundary}>
            Build 033 resolves people and vehicle limits only. Build 034 owns
            equipment, utility, accessibility, pet and other accommodation
            compatibility. Build 035 owns reservations, holds, closures,
            turnover and live inventory conflicts. Build 040 owns extra-guest,
            vehicle and pass fees.
          </p>
          <Link
            className="primary-link primary-link--dark"
            href={
              "/workspaces/management/campgrounds/booking-rules?campground=" +
              encodeURIComponent(selected.campgroundId)
            }
          >
            Review booking calendar & date rules
          </Link>
        </section>
      </div>
    </AppShell>
  );
}
