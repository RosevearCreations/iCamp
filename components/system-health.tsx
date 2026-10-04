import Link from "next/link";

import {
  getPublicHealthSnapshot,
  getVersionSnapshot,
} from "@/lib/observability/health";

export function SystemHealthSummary() {
  const health = getPublicHealthSnapshot();
  const version = getVersionSnapshot();

  return (
    <div className="health-grid">
      <article className="health-card">
        <span className="health-card__label">Service</span>
        <strong>{health.status}</strong>
        <span>{health.service}</span>
      </article>
      <article className="health-card">
        <span className="health-card__label">Environment</span>
        <strong>{health.environment}</strong>
        <span>Public-safe status only</span>
      </article>
      <article className="health-card">
        <span className="health-card__label">Version</span>
        <strong>{version.version}</strong>
        <span>{version.buildSha === "local" ? "Local build" : version.buildSha}</span>
      </article>
      <article className="health-card">
        <span className="health-card__label">Support</span>
        <strong>Diagnostics protected</strong>
        <Link href="/status">Open system status</Link>
      </article>
    </div>
  );
}
