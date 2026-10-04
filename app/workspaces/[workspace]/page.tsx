import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { AppShell } from "@/components/app-shell";
import { ChannelSupportSummary } from "@/components/channel-support";
import { getWorkspace, workspaces } from "@/lib/workspaces";

export function generateStaticParams() {
  return workspaces.map((workspace) => ({ workspace: workspace.slug }));
}

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
          <div className="section-heading">
            <div>
              <p className="eyebrow">Omnichannel contract</p>
              <h2 id="channel-heading">How this workspace can be reached</h2>
            </div>
            <span className="build-chip">Build 001</span>
          </div>
          <ChannelSupportSummary support={workspace.channelSupport} />
        </section>

        <section className="content-panel" aria-labelledby="future-heading">
          <p className="eyebrow">Purpose of this build</p>
          <h2 id="future-heading">Shell now, domain workflows later</h2>
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
