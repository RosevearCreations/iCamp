import Link from "next/link";

import { EnvironmentBanner } from "@/components/environment-banner";
import { StandardAccessibilityControls } from "@/components/standard-accessibility-controls";

/** The Sysop chrome intentionally has no campground booking or guest links. */
export function SysopShell({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <div
      className="app-shell"
      data-theme="standard"
      data-visual="orbit"
      data-shell="sysop"
    >
      <a className="skip-link" href="#main-content">
        Skip to main content
      </a>
      <EnvironmentBanner />
      <header className="topbar">
        <Link className="brand" href="/sysop" aria-label="Rosevear Sysop home">
          <span className="brand__mark" aria-hidden="true">
            SO
          </span>
          <span>
            <strong>iCamp Sysop</strong>
            <small>Platform oversight · Orbit Command</small>
          </span>
        </Link>
        <nav
          className="topbar__quicklinks"
          aria-label="Platform quick navigation"
        >
          <Link href="/sysop">Platform overview</Link>
          <Link href="/platform">Platform statistics</Link>
          <Link href="/status">Service health</Link>
          <Link href="/integration/comms-hub">Elevated Comms guidance</Link>
        </nav>
        <StandardAccessibilityControls />
        <div className="topbar__status" aria-label="Shell mode">
          <span className="orbit-command-mark">Read-only sysop</span>
        </div>
      </header>
      <div className="shell-grid">
        <aside className="sidebar" aria-label="Platform Sysop navigation">
          <p className="sidebar__label">Platform control plane</p>
          <nav>
            <div className="sidebar__group">
              <p className="sidebar__group-label">
                Diagnosis &amp; observation
              </p>
              <ul className="workspace-nav">
                <li>
                  <Link href="/sysop">Read-only overview</Link>
                </li>
                <li>
                  <Link href="/platform">Aggregate statistics</Link>
                </li>
                <li>
                  <Link href="/status">Service availability</Link>
                </li>
                <li>
                  <Link href="/integration/comms-hub">
                    Comms Hub connection guidance
                  </Link>
                </li>
              </ul>
            </div>
          </nav>
          <div className="sidebar__principle">
            <strong>✦ Orbit Command · Build 247</strong>
            <span>Platform intelligence only · no tenant records.</span>
            <span>Campground work requires a separate active assignment.</span>
          </div>
        </aside>
        <main className="main-content" id="main-content">
          {children}
        </main>
      </div>
      <footer className="site-footer">
        <span>iCamp · Sysop shell</span>
        <span className="site-footer__links">
          <Link href="/auth/account">Account &amp; session security</Link>
          <span aria-hidden="true">·</span>
          <Link href="/auth/mfa?next=%2Fsysop">Verify MFA</Link>
        </span>
      </footer>
    </div>
  );
}
