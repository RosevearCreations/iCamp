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
