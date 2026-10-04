import Link from "next/link";

import { EnvironmentBanner } from "@/components/environment-banner";
import { workspaces } from "@/lib/workspaces";

export function AppShell({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <div className="app-shell">
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
            <small>iCamp2027</small>
          </span>
        </Link>

        <div className="topbar__status" aria-label="Build status">
          <span className="status-dot" aria-hidden="true" />
          Build 003 · Data, refresh & help foundation
        </div>
      </header>

      <div className="shell-grid">
        <aside className="sidebar" aria-label="iCamp workspaces">
          <p className="sidebar__label">Workspaces</p>
          <nav>
            <ul className="workspace-nav">
              {workspaces.map((workspace) => (
                <li key={workspace.slug}>
                  <Link href={`/workspaces/${workspace.slug}`}>
                    {workspace.shortTitle}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>

          <div className="sidebar__principle">
            <strong>Free-first. Scale-ready.</strong>
            <span>Provider-neutral by design.</span>
          </div>
        </aside>

        <main className="main-content" id="main-content">
          {children}
        </main>
      </div>

      <footer className="site-footer">
        <span>iCamp · evolving campground operations platform</span>
        <span className="site-footer__links">
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
