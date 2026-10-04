import Link from "next/link";

import { AppShell } from "@/components/app-shell";
import { ChannelSupportSummary } from "@/components/channel-support";
import { shellChannelSupport } from "@/lib/channels";
import { workspaces } from "@/lib/workspaces";

export default function HomePage() {
  return (
    <AppShell>
      <div className="page-stack">
        <section className="hero-panel">
          <p className="eyebrow">Build 002 · Environment, health & I.T.</p>
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
          </div>
        </section>

        <section className="content-panel" aria-labelledby="principles-heading">
          <p className="eyebrow">Architecture principles</p>
          <h2 id="principles-heading">
            Designed to change without starting over
          </h2>
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
          <div className="section-heading">
            <div>
              <p className="eyebrow">Role-specific surfaces</p>
              <h2 id="workspaces-heading">iCamp workspaces</h2>
            </div>
            <span className="build-chip">{workspaces.length} shells</span>
          </div>

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
          <p className="eyebrow">Operational foundation</p>
          <h2 id="health-heading">Health and I.T. analysis are built in.</h2>
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
          <p className="eyebrow">Omnichannel foundation</p>
          <h2 id="channels-heading">The web app is only one interface</h2>
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
