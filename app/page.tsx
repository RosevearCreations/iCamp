import Link from "next/link";

import { AppShell } from "@/components/app-shell";
import { ChannelSupportSummary } from "@/components/channel-support";
import { SectionHeading } from "@/components/section-heading";
import { publicConfig } from "@/lib/config/public";
import { shellChannelSupport } from "@/lib/channels";
import { workspaces } from "@/lib/workspaces";

export default function HomePage() {
  return (
    <AppShell>
      <div className="page-stack">
        <section className="hero-panel">
          <p className="eyebrow">Build 003 · Data, refresh & contextual help</p>
          <h1>One campground platform. Every operating surface.</h1>
          <p className="hero-panel__lead">
            iCamp is being built as a flexible, free-first development platform
            that can scale to larger infrastructure without replacing its core
            campground logic.
          </p>
          <div className="hero-actions">
            <Link className="primary-link" href="/workspaces/public">
              Explore the public shell
            </Link>
            <a className="secondary-link" href="#workspaces">
              View all workspaces
            </a>
            {publicConfig.environment !== "production" ? (
              <Link className="secondary-link" href="/demo">
                Open demo campground
              </Link>
            ) : null}
          </div>
        </section>

        <section className="content-panel" aria-labelledby="principles-heading">
          <SectionHeading
            eyebrow="Architecture principles"
            title="Designed to change without starting over"
            id="principles-heading"
            helpTopic="shell.overview"
          />
          <div className="principle-grid">
            <article>
              <strong>Free-first development</strong>
              <p>
                No paid provider is required for this build. Provider-specific
                services arrive later behind replaceable adapters.
              </p>
            </article>
            <article>
              <strong>Live and modular</strong>
              <p>
                Workspaces and channel capabilities are data-driven so
                campground needs can evolve without rebuilding the shell.
              </p>
            </article>
            <article>
              <strong>Scale-ready</strong>
              <p>
                Standard web, TypeScript and portable server output keep future
                self-hosted, container and managed deployment options open.
              </p>
            </article>
          </div>
        </section>

        <section
          className="content-panel"
          id="workspaces"
          aria-labelledby="workspaces-heading"
        >
          <SectionHeading
            eyebrow="Role-specific surfaces"
            title="iCamp workspaces"
            id="workspaces-heading"
            helpTopic="shell.workspaces"
            trailing={
              <span className="build-chip">{workspaces.length} workspaces</span>
            }
          />

          <div className="workspace-grid">
            {workspaces.map((workspace) => (
              <Link
                className="workspace-card"
                href={`/workspaces/${workspace.slug}`}
                key={workspace.slug}
              >
                <span className="workspace-card__audience">
                  {workspace.audience}
                </span>
                <strong>{workspace.title}</strong>
                <p>{workspace.summary}</p>
                <span className="workspace-card__link">Open shell →</span>
              </Link>
            ))}
          </div>
        </section>

        <section className="content-panel" aria-labelledby="health-heading">
          <SectionHeading
            eyebrow="Operational foundation"
            title="Health and I.T. analysis are built in."
            id="health-heading"
            helpTopic="it.analysis"
          />
          <p>
            iCamp now exposes client-safe service status and a dedicated I.T.
            workspace foundation. Sensitive diagnostics remain intentionally
            unavailable until authentication and permissions are implemented.
          </p>
          <div className="hero-actions">
            <Link className="primary-link primary-link--dark" href="/status">
              View system status
            </Link>
            <Link
              className="primary-link primary-link--dark"
              href="/workspaces/it-analysis"
            >
              Open I.T. & Analysis
            </Link>
          </div>
        </section>

        <section className="content-panel" aria-labelledby="channels-heading">
          <SectionHeading
            eyebrow="Omnichannel foundation"
            title="The web app is only one interface"
            id="channels-heading"
            helpTopic="shell.channels"
          />
          <p>
            Every later operational feature must declare a meaningful Web/PWA,
            telephone keypad and text-message path—or document why a secure
            visual or staff-assisted handoff is safer.
          </p>
          <ChannelSupportSummary support={shellChannelSupport} />
        </section>
      </div>
    </AppShell>
  );
}
