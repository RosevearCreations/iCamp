import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";

import { AdminRefreshControl } from "@/components/admin-refresh-control";
import { AppShell } from "@/components/app-shell";
import { SectionHeading } from "@/components/section-heading";
import {
  hasCampgroundPermission,
  listAssignedCampgrounds,
} from "@/lib/authz/postgres.mjs";
import { requireAnyCampgroundPermission } from "@/lib/authz/current-user";
import { formatTargetMinutes } from "@/lib/maintenance-taxonomy/core.mjs";
import { getMaintenanceTaxonomySnapshot } from "@/lib/maintenance-taxonomy/postgres.mjs";

import {
  createMaintenanceCategoryAction,
  setMaintenanceCategoryActiveAction,
  updateMaintenancePriorityPolicyAction,
} from "./actions";
import styles from "./taxonomy.module.css";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Maintenance taxonomy & priority targets · iCamp",
  description:
    "Configure campground maintenance categories and response/completion targets.",
};

type SearchParams = Promise<{
  campground?: string;
  saved?: string;
}>;

function titleCase(value: string) {
  return value
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

export default async function MaintenanceTaxonomyPage({
  searchParams,
}: Readonly<{ searchParams: SearchParams }>) {
  const params = await searchParams;
  const path = "/workspaces/maintenance/taxonomy";
  const session = await requireAnyCampgroundPermission(
    "maintenance.read",
    path,
  );
  const assigned = await listAssignedCampgrounds(session.user.id);
  const allowed = await Promise.all(
    assigned.map(async (campground) => ({
      campground,
      allowed: await hasCampgroundPermission(
        session.user.id,
        campground.campgroundId,
        "maintenance.read",
      ),
    })),
  );
  const authorized = allowed
    .filter((entry) => entry.allowed)
    .map((entry) => entry.campground);

  if (authorized.length === 0) {
    redirect("/auth/not-authorized");
  }

  const selected =
    authorized.find(
      (campground) => campground.campgroundId === params.campground,
    ) ?? authorized[0];

  const snapshot = await getMaintenanceTaxonomySnapshot(
    session.user.id,
    selected.campgroundId,
  );
  const canManage = await hasCampgroundPermission(
    session.user.id,
    selected.campgroundId,
    "maintenance.assign",
  );
  const activeCategories = snapshot.categories.filter(
    (category) => category.isActive,
  );

  return (
    <AppShell>
      <div className="page-stack">
        <nav className="breadcrumbs" aria-label="Breadcrumb">
          <Link href="/">iCamp</Link>
          <span aria-hidden="true">/</span>
          <Link href="/workspaces/maintenance">Maintenance</Link>
          <span aria-hidden="true">/</span>
          <span>Taxonomy & priorities</span>
        </nav>

        <section className="hero-panel">
          <p className="eyebrow">Build 064 · Maintenance foundation</p>
          <h1>Maintenance taxonomy & priority targets</h1>
          <p className="hero-panel__lead">
            Keep one campground-specific category library and one canonical
            Emergency, Urgent, Normal and Preventive priority model for the work
            orders and schedules that follow.
          </p>
        </section>

        {params.saved ? (
          <p className={styles.notice} role="status">
            {params.saved}
          </p>
        ) : null}

        <section className="content-panel" aria-labelledby="scope-heading">
          <SectionHeading
            eyebrow="Property scope"
            title="Choose campground"
            id="scope-heading"
            helpTopic="shell.overview"
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
              Open maintenance configuration
            </button>
          </form>
        </section>

        <section className="content-panel" aria-labelledby="summary-heading">
          <SectionHeading
            eyebrow="Readiness"
            title="Maintenance classification summary"
            id="summary-heading"
            helpTopic="shell.overview"
            trailing={<span className="build-chip">Build 064</span>}
          />
          <div className={styles.metrics}>
            <div>
              <span>Active categories</span>
              <strong>{activeCategories.length}</strong>
            </div>
            <div>
              <span>Standard categories</span>
              <strong>
                {
                  snapshot.categories.filter((category) => category.isStandard)
                    .length
                }
              </strong>
            </div>
            <div>
              <span>Priority levels</span>
              <strong>{snapshot.priorities.length}</strong>
            </div>
            <div>
              <span>Campground timezone</span>
              <strong>{snapshot.campground.timezone}</strong>
            </div>
          </div>
          <p className={styles.boundary}>
            Response and completion values are internal planning targets, not
            guarantees or substitutes for emergency services, fire/life-safety
            procedures, utility isolation rules or other legal requirements.
          </p>
        </section>

        <section className="content-panel" aria-labelledby="priority-heading">
          <SectionHeading
            eyebrow="Priority model"
            title="Response & completion targets"
            id="priority-heading"
            helpTopic="shell.overview"
          />
          <div className={styles.grid}>
            {snapshot.priorities.map((priority) => (
              <article className={styles.card} key={priority.id}>
                <header>
                  <div>
                    <p className={styles.kicker}>Priority</p>
                    <h3>{titleCase(priority.priorityKey)}</h3>
                  </div>
                  <span className={styles.state}>
                    revision {priority.rowVersion}
                  </span>
                </header>
                <div className={styles.targetLine}>
                  <strong>
                    Respond:{" "}
                    {formatTargetMinutes(priority.targetResponseMinutes)}
                  </strong>
                  <span>
                    Complete:{" "}
                    {formatTargetMinutes(priority.targetCompletionMinutes)}
                  </span>
                </div>
                {priority.instructions ? <p>{priority.instructions}</p> : null}
                {canManage ? (
                  <form
                    action={updateMaintenancePriorityPolicyAction}
                    className={styles.formGrid}
                  >
                    <input
                      type="hidden"
                      name="campgroundId"
                      value={selected.campgroundId}
                    />
                    <input
                      type="hidden"
                      name="priorityKey"
                      value={priority.priorityKey}
                    />
                    <input
                      type="hidden"
                      name="rowVersion"
                      value={priority.rowVersion}
                    />
                    <label className={styles.field}>
                      <span>Response target (minutes)</span>
                      <input
                        name="targetResponseMinutes"
                        type="number"
                        min="1"
                        max="43200"
                        defaultValue={priority.targetResponseMinutes}
                        required
                      />
                    </label>
                    <label className={styles.field}>
                      <span>Completion target (minutes)</span>
                      <input
                        name="targetCompletionMinutes"
                        type="number"
                        min="1"
                        max="525600"
                        defaultValue={priority.targetCompletionMinutes}
                        required
                      />
                    </label>
                    <label className={styles.field + " " + styles.full}>
                      <span>Operating instructions</span>
                      <textarea
                        name="instructions"
                        maxLength={500}
                        defaultValue={priority.instructions ?? ""}
                      />
                    </label>
                    <div className={styles.actions}>
                      <button className="primary-button" type="submit">
                        Save {titleCase(priority.priorityKey)} targets
                      </button>
                    </div>
                  </form>
                ) : null}
              </article>
            ))}
          </div>
        </section>

        <section className="content-panel" aria-labelledby="category-heading">
          <SectionHeading
            eyebrow="Taxonomy"
            title="Maintenance category library"
            id="category-heading"
            helpTopic="shell.overview"
          />
          <p className={styles.boundary}>
            Standard categories provide the common campground baseline. Custom
            service types can be added without changing application code.
            Deactivation preserves the category identity for later historical
            work-order references.
          </p>
          <div className={styles.grid}>
            {snapshot.categories.map((category) => (
              <article className={styles.card} key={category.id}>
                <header>
                  <div>
                    <p className={styles.kicker}>
                      {category.isStandard ? "Standard" : "Custom"} ·{" "}
                      {category.code}
                    </p>
                    <h3>{category.name}</h3>
                  </div>
                  <span className={styles.state}>
                    {category.isActive ? "active" : "inactive"}
                  </span>
                </header>
                {category.description ? <p>{category.description}</p> : null}
                {canManage ? (
                  <form action={setMaintenanceCategoryActiveAction}>
                    <input
                      type="hidden"
                      name="campgroundId"
                      value={selected.campgroundId}
                    />
                    <input
                      type="hidden"
                      name="categoryId"
                      value={category.id}
                    />
                    <input
                      type="hidden"
                      name="rowVersion"
                      value={category.rowVersion}
                    />
                    <input
                      type="hidden"
                      name="isActive"
                      value={category.isActive ? "false" : "true"}
                    />
                    <button className="primary-button" type="submit">
                      {category.isActive ? "Deactivate" : "Reactivate"} category
                    </button>
                  </form>
                ) : null}
              </article>
            ))}
          </div>
        </section>

        {canManage ? (
          <section className="content-panel" aria-labelledby="custom-heading">
            <SectionHeading
              eyebrow="Extensible service types"
              title="Add custom maintenance category"
              id="custom-heading"
              helpTopic="shell.overview"
            />
            <form
              action={createMaintenanceCategoryAction}
              className={styles.formGrid}
            >
              <input
                type="hidden"
                name="campgroundId"
                value={selected.campgroundId}
              />
              <label className={styles.field}>
                <span>Category code</span>
                <input
                  name="code"
                  maxLength={50}
                  placeholder="pool_equipment"
                  required
                />
              </label>
              <label className={styles.field}>
                <span>Display name</span>
                <input name="name" minLength={2} maxLength={80} required />
              </label>
              <label className={styles.field + " " + styles.full}>
                <span>Description</span>
                <textarea name="description" maxLength={500} />
              </label>
              <div className={styles.actions}>
                <button className="primary-button" type="submit">
                  Add maintenance category
                </button>
              </div>
            </form>
          </section>
        ) : null}

        <section className="content-panel" aria-labelledby="freshness-heading">
          <SectionHeading
            eyebrow="Administrative tracking"
            title="Data freshness and refresh"
            id="freshness-heading"
            helpTopic="admin.refresh"
          />
          <AdminRefreshControl
            renderedAt={new Date().toISOString()}
            sectionKey="workspace.maintenance.taxonomy"
          />
        </section>

        <section className="content-panel" aria-labelledby="boundary-heading">
          <SectionHeading
            eyebrow="Build boundary"
            title="Classification first; work orders next"
            id="boundary-heading"
            helpTopic="shell.overview"
          />
          <p className={styles.boundary}>
            Build 064 defines maintenance categories and priority targets only.
            Build 065 will own canonical work orders, assignment/status, notes,
            media, materials, labour and completion evidence. Later scheduling
            builds will own hourly/daily/weekly/monthly/seasonal recurrence.
          </p>
        </section>
      </div>
    </AppShell>
  );
}
