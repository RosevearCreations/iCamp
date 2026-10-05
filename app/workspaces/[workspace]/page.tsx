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
