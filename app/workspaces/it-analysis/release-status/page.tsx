import type { Metadata } from "next";
import Link from "next/link";

import { AppShell } from "@/components/app-shell";
import { requireAnyCampgroundPermission } from "@/lib/authz/current-user";
import { getSafeItSnapshot } from "@/lib/observability/health";

export const metadata: Metadata = {
  title: "Current deployment and separate activation readiness · iCamp",
  robots: { index: false, follow: false },
};
export const dynamic = "force-dynamic";

export default async function CurrentReleaseStatusPage() {
  await requireAnyCampgroundPermission(
    "it.health.read",
    "/workspaces/it-analysis/release-status",
  );
  const state = getSafeItSnapshot();

  return (
    <AppShell>
      <div className="page-stack standard-ops-page">
        <section className="hero-panel meadow-hero">
          <p className="eyebrow">I.T. operational truth · Build 233</p>
          <h1>Current release status and separate activation decisions</h1>
          <p className="hero-panel__lead">
            Deployed source, commercial launch and external communication
            activation are three different states. Older paper checklists are
            retained for history and do not block ordinary campground work.
          </p>
        </section>
        <section className="content-panel">
          <h2>Observed application runtime</h2>
          <dl className="status-details">
            <div>
              <dt>Environment</dt>
              <dd>{state.environment}</dd>
            </div>
            <div>
              <dt>Runtime configuration</dt>
              <dd>{state.readiness.configuration}</dd>
            </div>
            <div>
              <dt>Application version</dt>
              <dd>{state.version}</dd>
            </div>
            <div>
              <dt>Deployed Git commit</dt>
              <dd>
                <code>{state.buildSha}</code>
              </dd>
            </div>
          </dl>
          <p>
            These values come from this running application. They do not certify
            GitHub CI status or a third-party provider.
          </p>
          <p>
            <Link href="/api/version">Inspect deployed version JSON</Link> ·{" "}
            <Link href="/api/health/ready">Inspect runtime readiness JSON</Link>
          </p>
        </section>
        <section className="content-panel">
          <h2>Campground operations</h2>
          <p>
            Ordinary tenant management, booking rules, optional service editing,
            amenity updates and staff workflows use their own role permissions.
            Historic Comms, payment or go-live evidence worksheets are{" "}
            <strong>not</strong> prerequisites for these actions.
          </p>
          <p>
            <Link href="/campground">Open assigned campground</Link>
          </p>
        </section>
        <section className="content-panel">
          <h2>Independent live-activation decisions</h2>
          <ul>
            <li>
              <strong>Paid SaaS subscriptions:</strong> Requires separate real
              provider, legal consent and payment verification; a simulated
              replay is not activation.
            </li>
            <li>
              <strong>Guest SMS, calls, gates and external Comms:</strong>{" "}
              Confirm live connection and permission in the owning service. This
              page makes no connection claim.
            </li>
            <li>
              <strong>Original-host migrations and owner enrollment:</strong>{" "}
              Must be verified on the real database, independently of deployment
              status.
            </li>
          </ul>
          <p>
            <Link href="/integration/comms-hub">
              Comms Hub connection guidance
            </Link>{" "}
            · <Link href="/launch/subscriptions">Subscription foundation</Link>
          </p>
        </section>
        <section className="content-panel">
          <h2>Historical worksheets (reference only)</h2>
          <p>
            These older forms preserve source-era evidence. Their fixed HOLD
            labels refer to an earlier review, not the current deployment or a
            blanket blocker for campground features.
          </p>
          <ul>
            <li>
              <Link href="/launch/readiness">
                Build 156 commercial launch worksheet
              </Link>
            </li>
            <li>
              <Link href="/launch/audit">
                Build 158 billing/evidence worksheet
              </Link>
            </li>
            <li>
              <Link href="/integration/ql258">
                Historical QL-258 owner-intake checkpoint
              </Link>
            </li>
          </ul>
        </section>
      </div>
    </AppShell>
  );
}
