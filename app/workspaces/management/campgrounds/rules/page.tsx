import { randomUUID } from "node:crypto";
import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";

import { AppShell } from "@/components/app-shell";
import { SectionHeading } from "@/components/section-heading";
import { requireStaff } from "@/lib/auth/current-session";
import {
  hasCampgroundPermission,
  listAssignedCampgrounds,
} from "@/lib/authz/postgres.mjs";
import { getRuleSetDashboard } from "@/lib/campground-rules/postgres.mjs";

import {
  createCampgroundRuleSetAction,
  publishCampgroundRuleVersionAction,
} from "./actions";
import styles from "../reservations/reservations.module.css";

export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "Published campground & facility rules · iCamp",
};
const categories = [
  "campground",
  "pool",
  "waterfront",
  "sports",
  "playground",
  "event",
  "access",
];
const label = (category: string) =>
  category.charAt(0).toUpperCase() + category.slice(1);

export default async function CampgroundRuleSetsPage({
  searchParams,
}: {
  searchParams: Promise<{ campground?: string; saved?: string }>;
}) {
  const path = "/workspaces/management/campgrounds/rules";
  const session = await requireStaff(path);
  const params = await searchParams;
  const assigned = await listAssignedCampgrounds(session.user.id);
  const eligible = (
    await Promise.all(
      assigned.map(async (campground) => ({
        campground,
        read: await hasCampgroundPermission(
          session.user.id,
          campground.campgroundId,
          "campground.rules.read",
        ),
        publish: await hasCampgroundPermission(
          session.user.id,
          campground.campgroundId,
          "campground.rules.publish",
        ),
      })),
    )
  ).filter((entry) => entry.read || entry.publish);
  if (!eligible.length) redirect("/auth/not-authorized");
  const selected =
    eligible.find(
      (entry) => entry.campground.campgroundId === params.campground,
    ) ?? eligible[0];
  const snapshot = await getRuleSetDashboard(
    session.user.id,
    selected.campground.campgroundId,
  );
  const campgroundId = selected.campground.campgroundId;

  return (
    <AppShell>
      <div className="page-stack">
        <nav className="breadcrumbs" aria-label="Breadcrumb">
          <Link href="/">iCamp</Link>
          <span>/</span>
          <Link href="/workspaces/management/campgrounds">Campgrounds</Link>
          <span>/</span>
          <span>Published rules</span>
        </nav>
        <section className="hero-panel">
          <p className="eyebrow">Build 082 · Safety and rules</p>
          <h1>Versioned campground &amp; facility rules</h1>
          <p className="hero-panel__lead">
            Publish immutable rule versions for campground-wide and specific
            facility guidance. Guests acknowledge the exact version shown for
            their confirmed or checked-in reservation.
          </p>
        </section>
        {params.saved ? (
          <p role="status" className={styles.notice}>
            {params.saved}
          </p>
        ) : null}
        <section className="content-panel">
          <SectionHeading
            id="rule-scope"
            title="Choose campground"
            eyebrow="Scope"
            helpTopic="campground.rules"
          />
          <form action={path} method="get" className={styles.inlineForm}>
            <label>
              Campground
              <select name="campground" defaultValue={campgroundId}>
                {eligible.map((item) => (
                  <option
                    key={item.campground.campgroundId}
                    value={item.campground.campgroundId}
                  >
                    {item.campground.campgroundName}
                  </option>
                ))}
              </select>
            </label>
            <button type="submit" className="primary-button">
              Open rule sets
            </button>
          </form>
        </section>
        {selected.publish ? (
          <section className="content-panel">
            <SectionHeading
              id="rule-new"
              title="Register a rule set"
              eyebrow="New policy"
              helpTopic="campground.rules"
            />
            <p>
              Use a stable code for each policy. Once registered, the identity
              and category remain fixed; the published text can be revised
              through new versions.
            </p>
            <form
              action={createCampgroundRuleSetAction}
              className={styles.formGrid}
            >
              <input type="hidden" name="campgroundId" value={campgroundId} />
              <label>
                Rule code
                <input
                  name="code"
                  minLength={3}
                  maxLength={40}
                  pattern="[A-Za-z][A-Za-z0-9_-]{2,39}"
                  placeholder="POOL_SAFETY"
                  required
                />
              </label>
              <label>
                Title
                <input
                  name="title"
                  minLength={4}
                  maxLength={160}
                  placeholder="Pool safety rules"
                  required
                />
              </label>
              <label>
                Category
                <select name="category" defaultValue="campground">
                  {categories.map((category) => (
                    <option value={category} key={category}>
                      {label(category)}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                Facility (optional; use only for facility categories)
                <select name="facilityId" defaultValue="">
                  <option value="">
                    All facilities in this category / campground-wide
                  </option>
                  {snapshot.facilities.map((facility) => (
                    <option key={facility.id} value={facility.id}>
                      {facility.code} · {facility.display_name}
                    </option>
                  ))}
                </select>
              </label>
              <button className="primary-button" type="submit">
                Register rule set
              </button>
            </form>
          </section>
        ) : null}
        <section className="content-panel">
          <SectionHeading
            id="published-rules"
            title="Rule publication register"
            eyebrow={snapshot.campground.name}
            helpTopic="campground.rules"
          />
          {snapshot.sets.length === 0 ? (
            <p>No rule sets registered for this campground yet.</p>
          ) : null}
          <div className={styles.history}>
            {snapshot.sets.map((rule) => (
              <article key={rule.id}>
                <h3>{rule.title}</h3>
                <p>
                  <strong>{rule.code}</strong> · {label(rule.rule_category)} ·{" "}
                  {rule.facility_id ? "Facility-specific" : "Category-wide"}
                </p>
                <p>
                  {rule.version_number
                    ? `Published version ${rule.version_number}`
                    : "Not yet published"}{" "}
                  · {rule.acknowledgement_count} acknowledgement(s) for current
                  version
                </p>
                {rule.published_at ? (
                  <p>
                    Published{" "}
                    {new Date(rule.published_at).toLocaleString("en-CA")}
                  </p>
                ) : null}
                {rule.content ? (
                  <p style={{ whiteSpace: "pre-wrap" }}>{rule.content}</p>
                ) : null}
                {selected.publish ? (
                  <form
                    action={publishCampgroundRuleVersionAction}
                    className={styles.formGrid}
                  >
                    <input
                      type="hidden"
                      name="campgroundId"
                      value={campgroundId}
                    />
                    <input type="hidden" name="ruleSetId" value={rule.id} />
                    <input
                      type="hidden"
                      name="clientPublicationId"
                      value={randomUUID()}
                    />
                    <input
                      type="hidden"
                      name="expectedVersion"
                      value={rule.version_number ?? 0}
                    />
                    <label className={styles.full}>
                      New version text
                      <textarea
                        name="content"
                        minLength={30}
                        maxLength={10000}
                        rows={8}
                        defaultValue={rule.content ?? ""}
                        required
                      />
                    </label>
                    <label>
                      <input
                        type="checkbox"
                        name="acknowledgementRequired"
                        defaultChecked={rule.acknowledgement_required ?? true}
                      />{" "}
                      Require guest acknowledgement
                    </label>
                    <button className="primary-button" type="submit">
                      Publish version {(rule.version_number ?? 0) + 1}
                    </button>
                  </form>
                ) : null}
              </article>
            ))}
          </div>
        </section>
        <section className="content-panel">
          <SectionHeading
            id="rule-boundaries"
            title="Operational boundaries"
            eyebrow="Important"
            helpTopic="campground.rules"
          />
          <p>
            Publishing rules does not automatically revoke access, suspend
            guests, change reservation terms, close a facility or satisfy
            lifeguard/safety staffing requirements. Those decisions stay in
            their dedicated workflows.
          </p>
          <p>
            For phone/SMS, staff can read current rules and provide a secure My
            Stay link. An unverified call or text cannot create guest
            acknowledgement evidence.
          </p>
        </section>
      </div>
    </AppShell>
  );
}
