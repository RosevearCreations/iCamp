import Link from "next/link";

import { EnvironmentBanner } from "@/components/environment-banner";
import { StandardAccessibilityControls } from "@/components/standard-accessibility-controls";
import { workspaces } from "@/lib/workspaces";

const navGroups = [
  { label: "Explore & stay", slugs: ["public", "guest"] },
  {
    label: "Campground operations",
    slugs: [
      "front-desk",
      "maintenance",
      "security",
      "store",
      "staff",
      "foreman",
    ],
  },
  {
    label: "Management & I.T.",
    slugs: ["management", "finance", "it-analysis"],
  },
] as const;

export function AppShell({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <div className="app-shell" data-theme="standard" data-visual="orbit">
      <a className="skip-link" href="#main-content">
        Skip to main content
      </a>

      <EnvironmentBanner />

      <header className="topbar">
        <Link className="brand" href="/" aria-label="iCamp home">
          <span className="brand__mark" aria-hidden="true">
            iC
          </span>
          <span>
            <strong>iCamp</strong>
            <small>Campground operations · Orbit Command</small>
          </span>
        </Link>

        <nav className="topbar__quicklinks" aria-label="Quick navigation">
          <Link href="/">Overview</Link>
          <Link href="/booking/map">Find a stay</Link>
          <Link href="/workspaces/guest">My stay</Link>
          <Link href="/events">Events</Link>
          <Link href="/workspaces/front-desk">Staff workspace</Link>
          <Link href="/campground">My campground</Link>
          <Link href="/status">Status</Link>
        </nav>

        <StandardAccessibilityControls />
        <div className="topbar__status" aria-label="Theme status">
          <span className="theme-marker" aria-hidden="true">
            ✦
          </span>
          Orbit Command
        </div>
      </header>

      <div className="shell-grid">
        <aside className="sidebar" aria-label="iCamp workspaces">
          <p className="sidebar__label">Navigation</p>
          <nav>
            {navGroups.map((group) => (
              <div className="sidebar__group" key={group.label}>
                <p className="sidebar__group-label">{group.label}</p>
                <ul className="workspace-nav">
                  {group.slugs.map((slug) => {
                    const workspace = workspaces.find(
                      (item) => item.slug === slug,
                    );
                    if (!workspace) return null;
                    return (
                      <li key={slug}>
                        <Link href={`/workspaces/${slug}`}>
                          {workspace.shortTitle}
                        </Link>
                      </li>
                    );
                  })}
                </ul>
              </div>
            ))}
            <div className="sidebar__group">
              <p className="sidebar__group-label">Assigned campground</p>
              <ul className="workspace-nav">
                <li>
                  <Link href="/campground">Tenant workspace home</Link>
                </li>
              </ul>
            </div>
            <details className="sidebar__group sidebar__advanced">
              <summary>Administration &amp; system tools</summary>
              <ul className="workspace-nav">
                <li>
                  <Link href="/workspaces/management/command">
                    Campground command
                  </Link>
                </li>
                <li>
                  <Link href="/settings/themes">Theme management</Link>
                </li>
                <li>
                  <Link href="/settings/themes/acceptance">
                    Standard owner review
                  </Link>
                </li>
                <li>
                  <Link href="/integration/comms-hub">
                    Comms Hub connections
                  </Link>
                </li>
                <li>
                  <Link href="/launch/subscriptions">
                    Subscriptions & evidence
                  </Link>
                </li>
                <li>
                  <Link href="/launch/readiness">Launch readiness</Link>
                </li>
                <li>
                  <Link href="/status">System status</Link>
                </li>
              </ul>
            </details>
          </nav>

          <div className="sidebar__principle">
            <strong>✦ Orbit Command</strong>
            <span>Midnight / violet / cyan · Build 247</span>
            <span className="sidebar__principle-subtle">
              Future themes will use the same status meanings and accessible
              layouts.
            </span>
          </div>
        </aside>

        <main className="main-content" id="main-content">
          {children}
        </main>
      </div>

      <footer className="site-footer">
        <span>iCamp · evolving campground operations platform</span>
        <span className="site-footer__links">
          <Link href="/auth/account">Account</Link>
          <span aria-hidden="true">·</span>
          <Link href="/help">Help</Link>
          <span aria-hidden="true">·</span>
          <Link href="/status">System status</Link>
          <span aria-hidden="true">·</span>
          <span>Web · Phone / DTMF · SMS / MMS</span>
        </span>
      </footer>
    </div>
  );
}
