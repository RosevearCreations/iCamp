import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";

import { AdminRefreshControl } from "@/components/admin-refresh-control";
import { AppShell } from "@/components/app-shell";
import { SectionHeading } from "@/components/section-heading";
import { requireStaff } from "@/lib/auth/current-session";
import {
  getCampgroundAuthorization,
  listAssignedCampgrounds,
} from "@/lib/authz/postgres.mjs";
import { incidentSignalLabel } from "@/lib/security-dashboard/core.mjs";
import { listSecurityAccessDashboard } from "@/lib/security-dashboard/postgres.mjs";

import styles from "./dashboard.module.css";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Security & Access Operations Dashboard · iCamp",
  description:
    "Campground-scoped gate, device, credential, denied-access, override and expiring-pass operations dashboard.",
};

function label(value: string) {
  return value.replaceAll("_", " ");
}

function timestamp(value: string | null, timeZone: string) {
  if (!value) return "Not observed";
  return new Intl.DateTimeFormat("en-CA", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone,
  }).format(new Date(value));
}

function deviceStatusClass(healthState: string) {
  if (["offline", "degraded"].includes(healthState)) {
    return styles.status + " " + styles.danger;
  }
  if (["unknown", "maintenance"].includes(healthState)) {
    return styles.status + " " + styles.attention;
  }
  return styles.status;
}

export default async function SecurityAccessDashboardPage({
  searchParams,
}: Readonly<{
  searchParams: Promise<{ campground?: string }>;
}>) {
  const path = "/workspaces/security/dashboard";
  const session = await requireStaff(path);
  const params = await searchParams;
  const assigned = await listAssignedCampgrounds(session.user.id);

  const authorized = (
    await Promise.all(
      assigned.map(async (campground) => {
        const authorization = await getCampgroundAuthorization(
          session.user.id,
          campground.campgroundId,
        );
        if (!authorization) return null;

        const permissions = authorization.permissions;
        const canReadCredentials =
          permissions.includes("access.credential.issue") ||
          permissions.includes("access.credential.revoke");
        const canReadDashboard =
          permissions.includes("gate.state.read") &&
          permissions.includes("access.events.read") &&
          canReadCredentials;

        return canReadDashboard ? { ...campground, authorization } : null;
      }),
    )
  ).filter((item): item is NonNullable<typeof item> => item !== null);

  if (authorized.length === 0) redirect("/auth/not-authorized");

  const selected =
    authorized.find((item) => item.campgroundId === params.campground) ??
    authorized[0];

  const data = await listSecurityAccessDashboard({
    userId: session.user.id,
    campgroundId: selected.campgroundId,
  });
  const timeZone = data.campground.timeZone;

  return (
    <AppShell>
      <div className="page-stack">
        <nav className="breadcrumbs" aria-label="Breadcrumb">
          <Link href="/">iCamp</Link>
          <span>/</span>
          <Link href="/workspaces/security">Security</Link>
          <span>/</span>
          <span>Operations Dashboard</span>
        </nav>

        <section className="hero-panel">
          <p className="eyebrow">Build 063 · Security operations</p>
          <h1>Security & Access Operations Dashboard</h1>
          <p className="hero-panel__lead">
            One campground-scoped view of gate/device health, active
            credentials, denied access, manual overrides, expiring passes and
            recent security signals. The dashboard reads the existing canonical
            ledgers instead of creating a second access-control system.
          </p>
        </section>

        <section className="content-panel">
          <SectionHeading
            eyebrow="Property scope"
            title="Security operations"
            id="security-dashboard-scope"
            helpTopic="security.access.dashboard"
            trailing={<span className="build-chip">Build 063</span>}
          />
          <form method="get" className={styles.scopeForm}>
            <label>
              Campground
              <select name="campground" defaultValue={selected.campgroundId}>
                {authorized.map((item) => (
                  <option key={item.campgroundId} value={item.campgroundId}>
                    {item.campgroundName}
                  </option>
                ))}
              </select>
            </label>
            <button className="primary-button" type="submit">
              Open dashboard
            </button>
          </form>
          <AdminRefreshControl
            renderedAt={data.generatedAt}
            sectionKey="workspace.security.operations-dashboard"
          />
        </section>

        <section className="content-panel">
          <SectionHeading
            eyebrow="Current posture"
            title={data.campground.name}
            id="security-dashboard-summary"
            helpTopic="security.access.dashboard"
          />
          <div className="health-grid">
            <article className="health-card">
              <span className="health-card__label">Devices</span>
              <strong>{data.summary.deviceCount}</strong>
              <span>{data.summary.devicesNeedingAttention} need attention</span>
            </article>
            <article className="health-card">
              <span className="health-card__label">Open gates</span>
              <strong>{data.summary.openGateCount}</strong>
              <span>Latest observed state</span>
            </article>
            <article className="health-card">
              <span className="health-card__label">Active credentials</span>
              <strong>{data.summary.activeCredentialCount}</strong>
              <span>Valid at dashboard time</span>
            </article>
            <article className="health-card">
              <span className="health-card__label">Denied access</span>
              <strong>{data.summary.deniedAccessRecentCount}</strong>
              <span>Past {data.windows.recentHours} hours</span>
            </article>
            <article className="health-card">
              <span className="health-card__label">Overrides</span>
              <strong>{data.summary.overrideRecentCount}</strong>
              <span>Past {data.windows.recentHours} hours</span>
            </article>
            <article className="health-card">
              <span className="health-card__label">Expiring passes</span>
              <strong>{data.summary.expiringPassCount}</strong>
              <span>Next {data.windows.expiringHours} hours</span>
            </article>
            <article className="health-card">
              <span className="health-card__label">Security signals</span>
              <strong>{data.summary.incidentSignalCount}</strong>
              <span>Recent faults, denials and failed overrides</span>
            </article>
          </div>
        </section>

        <section className="content-panel">
          <SectionHeading
            eyebrow="Gate & device state"
            title="Latest operational status"
            id="security-dashboard-devices"
            helpTopic="access.device.registry"
          />
          <div className={styles.tableWrap}>
            <table>
              <thead>
                <tr>
                  <th>Device</th>
                  <th>Location / zone</th>
                  <th>Health</th>
                  <th>Gate state</th>
                  <th>Observed</th>
                </tr>
              </thead>
              <tbody>
                {data.devices.map((device) => (
                  <tr key={device.id}>
                    <td>
                      <strong>{device.displayName}</strong>
                      <br />
                      <small>
                        {device.deviceCode} · {label(device.deviceType)}
                      </small>
                    </td>
                    <td>
                      {device.locationLabel ?? "Not labelled"}
                      <br />
                      <small>{device.zoneReference ?? "No zone label"}</small>
                    </td>
                    <td>
                      <span className={deviceStatusClass(device.healthState)}>
                        {device.isActive
                          ? label(device.healthState)
                          : "inactive"}
                      </span>
                    </td>
                    <td>
                      <span className={styles.status}>
                        {label(device.gateState)}
                      </span>
                    </td>
                    <td>{timestamp(device.gateStateObservedAt, timeZone)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {data.devices.length === 0 ? (
            <p className={styles.empty}>No access devices are registered.</p>
          ) : null}
        </section>

        <section className="content-panel">
          <SectionHeading
            eyebrow="Credential posture"
            title="Active credentials"
            id="security-dashboard-credentials"
            helpTopic="access.credential.lifecycle"
          />
          <div className={styles.tableWrap}>
            <table>
              <thead>
                <tr>
                  <th>Credential</th>
                  <th>Type</th>
                  <th>Subject</th>
                  <th>Valid until</th>
                </tr>
              </thead>
              <tbody>
                {data.activeCredentials.map((credential) => (
                  <tr key={credential.id}>
                    <td>
                      <strong>{credential.credentialNumber}</strong>
                    </td>
                    <td>{label(credential.credentialType)}</td>
                    <td>
                      {credential.subjectLabel}
                      <br />
                      <small>{label(credential.subjectKind)}</small>
                    </td>
                    <td>
                      {credential.validUntil
                        ? timestamp(credential.validUntil, timeZone)
                        : "No fixed expiry"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {data.activeCredentials.length === 0 ? (
            <p className={styles.empty}>No active credentials are visible.</p>
          ) : null}
        </section>

        <section className="content-panel">
          <SectionHeading
            eyebrow="Access evidence"
            title="Recent denied access"
            id="security-dashboard-denied"
            helpTopic="access.events"
          />
          <div className={styles.tableWrap}>
            <table>
              <thead>
                <tr>
                  <th>When</th>
                  <th>Device</th>
                  <th>Direction</th>
                  <th>Known association</th>
                  <th>Reason</th>
                </tr>
              </thead>
              <tbody>
                {data.deniedAccess.map((event) => (
                  <tr key={event.id}>
                    <td>{timestamp(event.occurredAt, timeZone)}</td>
                    <td>
                      {event.deviceName}
                      <br />
                      <small>{event.deviceCode}</small>
                    </td>
                    <td>{label(event.direction)}</td>
                    <td>
                      {event.subjectKinds.length
                        ? event.subjectKinds.join(", ")
                        : "unknown"}
                    </td>
                    <td>{event.deniedReason}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {data.deniedAccess.length === 0 ? (
            <p className={styles.empty}>
              No denied access events are recorded.
            </p>
          ) : null}
        </section>

        <section className="content-panel">
          <SectionHeading
            eyebrow="Privileged actions"
            title="Manual gate overrides"
            id="security-dashboard-overrides"
            helpTopic="gate.override"
          />
          <div className={styles.tableWrap}>
            <table>
              <thead>
                <tr>
                  <th>Requested</th>
                  <th>Device</th>
                  <th>Command</th>
                  <th>Outcome</th>
                  <th>Reason</th>
                </tr>
              </thead>
              <tbody>
                {data.overrides.map((override) => (
                  <tr key={override.id}>
                    <td>{timestamp(override.requestedAt, timeZone)}</td>
                    <td>
                      {override.deviceName}
                      <br />
                      <small>{override.deviceCode}</small>
                    </td>
                    <td>{label(override.command)}</td>
                    <td>
                      <span
                        className={
                          [
                            "failed",
                            "rejected",
                            "timeout",
                            "unsupported",
                          ].includes(override.outcome)
                            ? styles.status + " " + styles.danger
                            : styles.status
                        }
                      >
                        {label(override.outcome)}
                      </span>
                    </td>
                    <td>{override.reason}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {data.overrides.length === 0 ? (
            <p className={styles.empty}>No manual overrides are recorded.</p>
          ) : null}
        </section>

        <section className="content-panel">
          <SectionHeading
            eyebrow="Expiry watch"
            title={
              "Passes expiring within " + data.windows.expiringHours + " hours"
            }
            id="security-dashboard-expiring"
            helpTopic="access.passes"
          />
          <div className={styles.tableWrap}>
            <table>
              <thead>
                <tr>
                  <th>Pass</th>
                  <th>Presentation</th>
                  <th>Linked purpose</th>
                  <th>Subject</th>
                  <th>Expires</th>
                </tr>
              </thead>
              <tbody>
                {data.expiringPasses.map((pass) => (
                  <tr key={pass.id}>
                    <td>
                      <strong>{pass.passNumber}</strong>
                    </td>
                    <td>{label(pass.presentationKind)}</td>
                    <td>{label(pass.linkKind)}</td>
                    <td>{pass.subjectLabel}</td>
                    <td>{timestamp(pass.validUntil, timeZone)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {data.expiringPasses.length === 0 ? (
            <p className={styles.empty}>No passes expire in this window.</p>
          ) : null}
        </section>

        <section className="content-panel">
          <SectionHeading
            eyebrow="Triage signals"
            title="Recent security signals"
            id="security-dashboard-signals"
            helpTopic="security.access.dashboard"
          />
          <p className={styles.note}>
            These are operational signals derived from device faults, denied
            access and failed/rejected overrides. They are not fabricated
            incident cases. Canonical incident case management requires its own
            future queue assignment.
          </p>
          <div className={styles.tableWrap}>
            <table>
              <thead>
                <tr>
                  <th>When</th>
                  <th>Signal</th>
                  <th>Subject</th>
                  <th>Detail</th>
                </tr>
              </thead>
              <tbody>
                {data.incidentSignals.map((signal, index) => (
                  <tr key={signal.kind + signal.occurredAt + index}>
                    <td>{timestamp(signal.occurredAt, timeZone)}</td>
                    <td>{incidentSignalLabel(signal.kind)}</td>
                    <td>{signal.subject}</td>
                    <td>{signal.detail}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {data.incidentSignals.length === 0 ? (
            <p className={styles.empty}>
              No security signals were recorded in the recent window.
            </p>
          ) : null}
        </section>

        <section className="content-panel">
          <h2>Security and channel boundaries</h2>
          <p>
            <strong>Web/PWA:</strong> full dashboard for authorized security
            staff. The dashboard never exposes raw PINs, QR bearer tokens,
            fingerprints, controller secrets or provider credentials.
          </p>
          <p>
            <strong>IVR/DTMF:</strong> verified staff may receive concise status
            summaries through the existing canonical domains. Visual dashboard
            review uses secure staff handoff.
          </p>
          <p>
            <strong>SMS/MMS:</strong> only concise verified summaries or a
            secure-link handoff are appropriate; sensitive access detail is not
            copied into ordinary messages.
          </p>
          <p>
            Manual open/close remains the separate Build 059 high-risk command
            path with reason, recent re-authentication, rate limiting and audit.
            This dashboard is monitoring, not a browser-to-controller command
            channel.
          </p>
        </section>
      </div>
    </AppShell>
  );
}
