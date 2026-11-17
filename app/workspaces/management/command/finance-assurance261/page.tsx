import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";

import { AppShell } from "@/components/app-shell";
import { SectionHeading } from "@/components/section-heading";
import { requireStaff } from "@/lib/auth/current-session";
import {
  getCampgroundAuthorization,
  listAssignedCampgrounds,
} from "@/lib/authz/postgres.mjs";
import { inspectFinancialAssurance261 } from "@/lib/finance-assurance261/postgres.mjs";

import styles from "../finance-close/finance-close.module.css";

export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "Build 261 · Financial assurance and production provenance · iCamp",
  description:
    "Production migration checksum, independent provider enrollment, settlement and owner approval readiness.",
};

export default async function FinancialAssurance261Page() {
  const path = "/workspaces/management/command/finance-assurance261";
  const session = await requireStaff(path);
  const assigned = await listAssignedCampgrounds(session.user.id);
  const authorized = await Promise.all(
    assigned.map(async (campground) => {
      const grant = await getCampgroundAuthorization(
        session.user.id,
        campground.campgroundId,
      );
      return (
        grant?.permissions.includes("finance.manage") &&
        grant.permissions.includes("staff.manage") &&
        grant.permissions.some((key) =>
          ["reservation.read", "reservation.modify"].includes(key),
        )
      );
    }),
  );
  if (!authorized.some(Boolean)) redirect("/auth/not-authorized");

  const evidence = await inspectFinancialAssurance261();
  return (
    <AppShell>
      <div className="page-stack">
        <nav className="breadcrumbs" aria-label="Breadcrumb">
          <Link href="/">iCamp</Link>
          <span>/</span>
          <Link href="/workspaces/management/command">Management Command</Link>
          <span>/</span>
          <Link href="/workspaces/management/command/finance-close260">
            Financial close
          </Link>
          <span>/</span>
          <span>Production assurance</span>
        </nav>
        <section className="hero-panel">
          <p className="eyebrow">Build 261 · independent financial custody</p>
          <h1>Production migration & provider settlement assurance</h1>
          <p className="hero-panel__lead">
            Read-only original production database checks and independent
            settlement-signer enrollment. A code deployment cannot certify
            operational activation, bank clearing, tax filing or book close.
          </p>
          <p>
            <strong>Evidence-review approval gate:</strong>{" "}
            {evidence.ownerEvidenceDecisionStatus}
          </p>
          <p>
            <strong>Live provider settlement activation:</strong>{" "}
            {evidence.liveSettlementActivationStatus}
          </p>
          <div className="hero-actions">
            <Link
              className="secondary-link"
              href="/workspaces/management/command/finance-close260"
            >
              Open Build 260 owner review
            </Link>
          </div>
        </section>

        <section className="content-panel">
          <SectionHeading
            id="finance261-migrations"
            eyebrow="Authenticated runtime readback"
            title="Production database migration provenance"
            helpTopic="shell.overview"
          />
          <div className={styles.meta}>
            <p>
              <strong>Recorded status:</strong> {evidence.migration.status}
            </p>
            <p>
              <strong>Source commit:</strong>{" "}
              {evidence.revision ?? "HOLD_SOURCE_UNAVAILABLE"}
            </p>
            <p>
              <strong>Required migration:</strong>{" "}
              {evidence.migration.expectedMigrationVersion}
            </p>
            <p>
              <strong>Canonical migration SHA-256:</strong>{" "}
              <code>{evidence.migration.expectedMigrationChecksumSha256}</code>
            </p>
            <p>
              <strong>Host identity independently confirmed:</strong>{" "}
              {evidence.independentDatabaseHostIdentityConfirmed
                ? "yes"
                : "not independently attested"}
            </p>
          </div>
          <p className={styles.note}>
            The server reads the configured runtime DATABASE_URL only if its
            hostname matches the separately configured production pin. It checks
            the original migration ledger, checksum, RLS, approval guard, policy
            count and immutable privileges. A matching host pin alone does not
            prove that a human independently authenticated the target. No
            migration is applied from this page.
          </p>
        </section>

        <section className="content-panel">
          <SectionHeading
            id="finance261-provider"
            eyebrow="Distinct independently enrolled public keys"
            title="Provider enrollment and source evidence"
            helpTopic="shell.overview"
          />
          <div className={styles.meta}>
            <p>
              <strong>Dual-signature enrollment:</strong>{" "}
              {evidence.enrollmentStatus}
            </p>
            <p>
              <strong>Enrollment expiry:</strong>{" "}
              {evidence.enrollmentExpiresAt ?? "not available"}
            </p>
            <p>
              <strong>Live external payment adapter:</strong>{" "}
              {evidence.assurance.externalProviderAdapterInstalled
                ? "verified"
                : "not installed"}
            </p>
          </div>
          <p className={styles.note}>
            Distinct issuer and reviewer signatures must match the current
            deployed revision and the exact migration digest. Independent
            provider identity verification, credentials, account settlement,
            bank statements and accounting approval are separately required. The
            current external payment adapter has not been installed.
          </p>
        </section>

        <section className="content-panel">
          <SectionHeading
            id="finance261-blockers"
            eyebrow="Fail-closed operations"
            title="Outstanding approval blockers"
            helpTopic="shell.overview"
          />
          {evidence.assurance.blockers.length ? (
            <div role="alert" className={styles.warning}>
              {evidence.assurance.blockers.map((item, index) => (
                <p key={index}>{item}</p>
              ))}
            </div>
          ) : (
            <p>
              Signed enrollment and pinned migration readback currently match.
              Only non-posting owner evidence review is eligible. Independent
              bank proof and final financial close are still HOLD.
            </p>
          )}
          <p>
            The system does not create settlement evidence, generate issuer
            keys, approve financial close, post accounting journals, remit HST
            or perform live captures or refunds automatically.
          </p>
        </section>
      </div>
    </AppShell>
  );
}
