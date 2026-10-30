import type { Metadata } from "next";
import Link from "next/link";

import { AppShell } from "@/components/app-shell";
import { requireAnyCampgroundPermission } from "@/lib/authz/current-user";
import { SEMANTIC_STATUS, STANDARD_THEME } from "@/lib/theme/standard.mjs";

export const metadata: Metadata = { title: "Theme management · iCamp" };
export const dynamic = "force-dynamic";

export default async function ThemeManagementPage() {
  await requireAnyCampgroundPermission("reports.read", "/settings/themes");
  return (
    <AppShell>
      <div className="page-stack standard-ops-page">
        <section className="hero-panel meadow-hero">
          <p className="eyebrow">Theme management · Build 160</p>
          <h1>Campground Standard</h1>
          <p className="hero-panel__lead">
            A fresh-grass feeling for campers, with a deeper evergreen command
            experience for Management, I.T., Statistics and Status.
          </p>
          <div className="hero-actions">
            <Link className="primary-link" href="/workspaces/management">
              Management centre
            </Link>
            <Link className="secondary-link" href="/workspaces/it-analysis">
              I.T. centre
            </Link>
          </div>
        </section>
        <div className="ops-kpi-grid">
          <article className="ops-kpi">
            <div className="ops-kpi__icon" aria-hidden="true">
              ♧
            </div>
            <div>
              <span>Current theme</span>
              <strong>{STANDARD_THEME.label}</strong>
              <small>{STANDARD_THEME.style}</small>
            </div>
          </article>
          <article className="ops-kpi">
            <div
              className="ops-kpi__icon ops-kpi__icon--blue"
              aria-hidden="true"
            >
              ✧
            </div>
            <div>
              <span>Theme version</span>
              <strong>{STANDARD_THEME.version}</strong>
              <small>Server-defined design tokens</small>
            </div>
          </article>
          <article className="ops-kpi">
            <div
              className="ops-kpi__icon ops-kpi__icon--amber"
              aria-hidden="true"
            >
              ＋
            </div>
            <div>
              <span>More themes</span>
              <strong>Future release</strong>
              <small>No unavailable selector or unsaved preference</small>
            </div>
          </article>
        </div>
        <section className="content-panel ops-detail-card">
          <h2>Standard theme palette</h2>
          <p>
            Meadow hero photography, rich forest-green surfaces, fresh grass
            highlights and consistent readable information panels.
          </p>
          <div className="theme-swatches">
            {Object.entries(STANDARD_THEME.tokens).map(([name, value]) => (
              <div className="theme-swatch" key={name}>
                <span style={{ backgroundColor: value }} aria-hidden="true" />
                <strong>{name}</strong>
                <small>{value}</small>
              </div>
            ))}
          </div>
          <p className="ops-inline-note">
            Status colours are semantic: operational{" "}
            {SEMANTIC_STATUS.operational}, pending {SEMANTIC_STATUS.pending},
            critical {SEMANTIC_STATUS.critical}. Future themes must preserve
            their meaning and accessible contrast.
          </p>
        </section>
      </div>
    </AppShell>
  );
}
