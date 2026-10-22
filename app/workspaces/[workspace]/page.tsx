import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { AdminRefreshControl } from "@/components/admin-refresh-control";
import { AppShell } from "@/components/app-shell";
import { ChannelSupportSummary } from "@/components/channel-support";
import { SectionHeading } from "@/components/section-heading";
import { requireSignedIn } from "@/lib/auth/current-session";
import { requireAnyCampgroundPermission } from "@/lib/authz/current-user";
import { getWorkspace } from "@/lib/workspaces";

export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
}: Readonly<{
  params: Promise<{ workspace: string }>;
}>): Promise<Metadata> {
  const { workspace: slug } = await params;
  const workspace = getWorkspace(slug);

  if (!workspace) {
    return { title: "Workspace not found · iCamp" };
  }

  return {
    title: `${workspace.title} · iCamp`,
    description: workspace.summary,
  };
}

export default async function WorkspacePage({
  params,
}: Readonly<{
  params: Promise<{ workspace: string }>;
}>) {
  const { workspace: slug } = await params;
  const workspace = getWorkspace(slug);

  if (!workspace) {
    notFound();
  }

  if (workspace.slug === "guest") {
    await requireSignedIn(`/workspaces/${workspace.slug}`);
  } else if (workspace.requiredPermission) {
    await requireAnyCampgroundPermission(
      workspace.requiredPermission,
      `/workspaces/${workspace.slug}`,
    );
  }

  const showsFreshness = !["public", "guest"].includes(workspace.slug);
  const renderedAt = new Date().toISOString();

  return (
    <AppShell>
      <div className="page-stack">
        <nav className="breadcrumbs" aria-label="Breadcrumb">
          <Link href="/">iCamp</Link>
          <span aria-hidden="true">/</span>
          <span>{workspace.shortTitle}</span>
        </nav>

        <section className="hero-panel">
          <p className="eyebrow">Workspace shell</p>
          <h1>{workspace.title}</h1>
          <p className="hero-panel__lead">{workspace.summary}</p>
          <p className="muted">
            Audience: <strong>{workspace.audience}</strong>
          </p>
        </section>

        <section className="content-panel" aria-labelledby="channel-heading">
          <SectionHeading
            eyebrow="Omnichannel contract"
            title="How this workspace can be reached"
            id="channel-heading"
            helpTopic="shell.channels"
            trailing={<span className="build-chip">Build 003</span>}
          />
          <ChannelSupportSummary support={workspace.channelSupport} />
        </section>

        {showsFreshness ? (
          <section
            className="content-panel"
            aria-labelledby="freshness-heading"
          >
            <SectionHeading
              eyebrow="Administrative tracking"
              title="Data freshness and refresh"
              id="freshness-heading"
              helpTopic="admin.refresh"
            />
            <AdminRefreshControl
              renderedAt={renderedAt}
              sectionKey={`workspace.${workspace.slug}`}
            />
          </section>
        ) : null}

        {workspace.slug === "public" ? (
          <section
            className="content-panel"
            aria-labelledby="public-booking-map-heading"
          >
            <SectionHeading
              eyebrow="Booking discovery"
              title="Choose accommodation on the live map"
              id="public-booking-map-heading"
              helpTopic="shell.overview"
              trailing={<span className="build-chip">Build 037</span>}
            />
            <p>
              Explore the published campground map by dates and accommodation
              type. Green polygons are selectable; grey, yellow and red explain
              unavailable, maintenance and closed inventory.
            </p>
            <Link
              className="primary-link primary-link--dark"
              href="/booking/map"
            >
              Open interactive booking map
            </Link>
          </section>
        ) : null}

        {workspace.slug === "management" ? (
          <section
            className="content-panel"
            aria-labelledby="campground-structure-heading"
          >
            <SectionHeading
              eyebrow="Campground administration"
              title="Sections, subsections and property settings"
              id="campground-structure-heading"
              helpTopic="campground.structure"
              trailing={<span className="build-chip">Build 017</span>}
            />
            <p>
              Manage ordered campground sections and subsections, active state,
              and section-specific operating settings through the protected
              configuration workflow.
            </p>
            <Link
              className="primary-link primary-link--dark"
              href="/workspaces/management/campgrounds"
            >
              Open campground structure
            </Link>
          </section>
        ) : null}

        {workspace.slug === "maintenance" ? (
          <>
            <section
              className="content-panel"
              aria-labelledby="maintenance-cottage-turnover-heading"
            >
              <SectionHeading
                eyebrow="Cottage operations"
                title="Cottage Housekeeping & Turnover"
                id="maintenance-cottage-turnover-heading"
                helpTopic="cottage.housekeeping"
                trailing={<span className="build-chip">Build 074</span>}
              />
              <p>
                Carry rental-cottage cleaning, linen, inventory and damage
                readiness through final signed inspection, canonical corrective
                work and safe return to booking availability.
              </p>
              <Link
                className="primary-link primary-link--dark"
                href="/workspaces/maintenance/cottage-turnover"
              >
                Open cottage housekeeping turnover
              </Link>
            </section>
            <section
              className="content-panel"
              aria-labelledby="maintenance-departure-cleanup-heading"
            >
              <SectionHeading
                eyebrow="Departure operations"
                title="Departure Campsite Cleanup"
                id="maintenance-departure-cleanup-heading"
                helpTopic="shell.overview"
                trailing={<span className="build-chip">Build 073</span>}
              />
              <p>
                Turn campsite checkout into automatic cleanup and site
                inspection work, keep failed items in canonical maintenance work
                orders, and release configured rebooking blocks only after
                clearance.
              </p>
              <Link
                className="primary-link primary-link--dark"
                href="/workspaces/maintenance/departure-cleanup"
              >
                Open departure campsite cleanup
              </Link>
            </section>
            <section
              className="content-panel"
              aria-labelledby="maintenance-infrastructure-heading"
            >
              <SectionHeading
                eyebrow="Infrastructure operations"
                title="Roads, Utilities, Garbage & Septic Maintenance"
                id="maintenance-infrastructure-heading"
                helpTopic="shell.overview"
                trailing={<span className="build-chip">Build 072</span>}
              />
              <p>
                Run recurring road, parking, utility, garbage/recycling and
                septic checks, manage restrictions through the canonical asset
                status engine, and escalate defects into canonical maintenance
                work orders.
              </p>
              <Link
                className="primary-link primary-link--dark"
                href="/workspaces/maintenance/infrastructure"
              >
                Open infrastructure maintenance
              </Link>
            </section>
            <section
              className="content-panel"
              aria-labelledby="maintenance-recreation-heading"
            >
              <SectionHeading
                eyebrow="Recreation operations"
                title="Baseball, Sports, Playground & Hall Maintenance"
                id="maintenance-recreation-heading"
                helpTopic="shell.overview"
                trailing={<span className="build-chip">Build 071</span>}
              />
              <p>
                Run recurring field, playground and hall condition checks,
                restrict or close unsafe assets through the canonical status
                engine, and escalate defects into canonical maintenance work
                orders.
              </p>
              <Link
                className="primary-link primary-link--dark"
                href="/workspaces/maintenance/recreation"
              >
                Open recreation maintenance
              </Link>
            </section>
            <section
              className="content-panel"
              aria-labelledby="maintenance-facility-upkeep-heading"
            >
              <SectionHeading
                eyebrow="Comfort-facility operations"
                title="Washroom, Shower & Laundry Upkeep"
                id="maintenance-facility-upkeep-heading"
                helpTopic="shell.overview"
                trailing={<span className="build-chip">Build 070</span>}
              />
              <p>
                Schedule cleaning and inspection, track supply and facility
                condition, and escalate defects into the canonical maintenance
                work-order engine.
              </p>
              <Link
                className="primary-link primary-link--dark"
                href="/workspaces/maintenance/facilities"
              >
                Open facility upkeep
              </Link>
            </section>
            <section
              className="content-panel"
              aria-labelledby="maintenance-aquatics-heading"
            >
              <SectionHeading
                eyebrow="Aquatic operations"
                title="Pool & Water-Park Maintenance Operations"
                id="maintenance-aquatics-heading"
                helpTopic="shell.overview"
                trailing={<span className="build-chip">Build 069</span>}
              />
              <p>
                Bind pools and water parks to recurring maintenance and signed
                inspection evidence, then manage limited/closed/reopen state
                through the canonical asset-status engine.
              </p>
              <Link
                className="primary-link primary-link--dark"
                href="/workspaces/maintenance/aquatics"
              >
                Open aquatic operations
              </Link>
            </section>
            <section
              className="content-panel"
              aria-labelledby="maintenance-inspections-heading"
            >
              <SectionHeading
                eyebrow="Inspection governance"
                title="Versioned Inspection Templates & Sign-Off"
                id="maintenance-inspections-heading"
                helpTopic="shell.overview"
                trailing={<span className="build-chip">Build 068</span>}
              />
              <p>
                Publish immutable asset/site/cottage checklists, execute
                inspections, create corrective maintenance from failures, and
                require independent sign-off where configured.
              </p>
              <Link
                className="primary-link primary-link--dark"
                href="/workspaces/maintenance/inspections"
              >
                Open inspections
              </Link>
            </section>
            <section
              className="content-panel"
              aria-labelledby="maintenance-schedules-heading"
            >
              <SectionHeading
                eyebrow="Maintenance automation"
                title="Recurring Maintenance Scheduler"
                id="maintenance-schedules-heading"
                helpTopic="shell.overview"
                trailing={<span className="build-chip">Build 067</span>}
              />
              <p>
                Create hourly, every-N-hours, daily, weekly, monthly, seasonal
                and custom maintenance schedules with discrete occurrence
                history and missed-task handling.
              </p>
              <Link
                className="primary-link primary-link--dark"
                href="/workspaces/maintenance/schedules"
              >
                Open recurring maintenance
              </Link>
            </section>
            <section
              className="content-panel"
              aria-labelledby="maintenance-foreman-heading"
            >
              <SectionHeading
                eyebrow="Maintenance leadership"
                title="Foreman queue & escalation"
                id="maintenance-foreman-heading"
                helpTopic="shell.overview"
                trailing={<span className="build-chip">Build 066</span>}
              />
              <p>
                Triage active work, assign within crew/foreman responsibility
                boundaries, and manage blocked, overdue and high-priority
                escalation.
              </p>
              <Link
                className="primary-link primary-link--dark"
                href="/workspaces/maintenance/foreman"
              >
                Open foreman queue
              </Link>
            </section>
            <section
              className="content-panel"
              aria-labelledby="maintenance-work-orders-heading"
            >
              <SectionHeading
                eyebrow="Maintenance operations"
                title="Work Order Engine"
                id="maintenance-work-orders-heading"
                helpTopic="shell.overview"
                trailing={<span className="build-chip">Build 065</span>}
              />
              <p>
                Create, assign, execute and complete canonical maintenance work
                orders with notes, secure media, materials, labour and
                completion evidence.
              </p>
              <Link
                className="primary-link primary-link--dark"
                href="/workspaces/maintenance/work-orders"
              >
                Open maintenance work orders
              </Link>
            </section>
            <section
              className="content-panel"
              aria-labelledby="maintenance-taxonomy-heading"
            >
              <SectionHeading
                eyebrow="Maintenance foundation"
                title="Taxonomy & priority targets"
                id="maintenance-taxonomy-heading"
                helpTopic="shell.overview"
                trailing={<span className="build-chip">Build 064</span>}
              />
              <p>
                Configure standard and custom maintenance categories plus
                Emergency, Urgent, Normal and Preventive response/completion
                planning targets for this campground.
              </p>
              <Link
                className="primary-link primary-link--dark"
                href="/workspaces/maintenance/taxonomy"
              >
                Open maintenance taxonomy
              </Link>
            </section>
          </>
        ) : null}

        {workspace.slug === "security" ? (
          <section
            className="content-panel"
            aria-labelledby="security-dashboard-heading"
          >
            <SectionHeading
              eyebrow="Security operations"
              title="Security & access operations dashboard"
              id="security-dashboard-heading"
              helpTopic="security.access.dashboard"
              trailing={<span className="build-chip">Build 063</span>}
            />
            <p>
              Review gate/device posture, active credentials, denied access,
              manual overrides, expiring passes and recent security signals in
              one campground-scoped operational view.
            </p>
            <Link
              className="primary-link primary-link--dark"
              href="/workspaces/security/dashboard"
            >
              Open security dashboard
            </Link>
          </section>
        ) : null}

        <section className="content-panel" aria-labelledby="future-heading">
          <SectionHeading
            eyebrow="Purpose of this workspace"
            title="Shell now, domain workflows later"
            id="future-heading"
            helpTopic="shell.overview"
          />
          <p>
            Build 001 establishes navigation, responsive layout and channel
            expectations without inventing unfinished campground data or
            permissions. Later builds add real capabilities through shared
            domain services so Web, telephone and text remain synchronized.
          </p>
        </section>
      </div>
    </AppShell>
  );
}
