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
import { inspectFinancialAssurance262 } from "@/lib/finance-assurance262/postgres.mjs";

import styles from "../finance-close/finance-close.module.css";

export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "Build 262 · Production financial activation · iCamp",
  description:
    "Signed original database custody, live adapter readiness and fail-closed settlement approval controls.",
};

export default async function FinancialAssurance262Page() {
  const path = "/workspaces/management/command/finance-assurance262";
  const session = await requireStaff(path);
  const assigned = await listAssignedCampgrounds(session.user.id);
  const permitted = await Promise.all(
    assigned.map(async (campground) => {
      const permission = await getCampgroundAuthorization(
        session.user.id,
        campground.campgroundId,
      );
      return Boolean(
        permission?.permissions.includes("finance.manage") &&
        permission.permissions.includes("staff.manage") &&
        permission.permissions.some((item) =>
          ["reservation.read", "reservation.modify"].includes(item),
        ),
      );
    }),
  );
  if (!permitted.some(Boolean)) redirect("/auth/not-authorized");

  const report = await inspectFinancialAssurance262();
  return (
    <AppShell>
      <div className="page-stack">
        <nav className="breadcrumbs" aria-label="Breadcrumb">
          <Link href="/">iCamp</Link>
          <span>/</span>
          <Link href="/workspaces/management/command">Management Command</Link>
          <span>/</span>
          <Link href="/workspaces/management/command/finance-assurance261">
            Production financial provenance
          </Link>
          <span>/</span>
          <span>Build 262</span>
        </nav>
        <section className="hero-panel">
          <p className="eyebrow">
            Build 262 · immutable financial safety gates
          </p>
          <h1>Production database custody & settlement activation</h1>
          <p className="hero-panel__lead">
            Compare the actual production migration readback with two-party
            signed original database custody and independently enrolled provider
            evidence. This board never posts funds, authorizes tax filings or
            treats a signed statement as bank clearing.
          </p>
          <p>
            <strong>Settlement activation:</strong> {report.activation.status}
          </p>
          <p>
            <strong>Owner non-posting review:</strong>{" "}
            {report.activation.ownerEvidenceEligible
              ? "TECHNICALLY ELIGIBLE — separate approval required"
              : "HOLD — independent source evidence missing"}
          </p>
        </section>
        <div className="hero-actions">
          <Link
            className="secondary-link"
            href="/workspaces/management/command/finance-assurance263"
          >
            Build 263 independent financial evidence
          </Link>
        </div>
        <section className="content-panel">
          <SectionHeading
            eyebrow="Original source"
            title="Production database custody"
            id="finance262-db"
            helpTopic="shell.overview"
          />
          <div className={styles.meta}>
            <p>
              <strong>Deployed revision:</strong>{" "}
              {report.sourceRevision ?? "HOLD"}
            </p>
            <p>
              <strong>Original migration:</strong> {report.migrationStatus}
            </p>
            <p>
              <strong>Dual-signed database custody:</strong>{" "}
              {report.custodyStatus}
            </p>
            <p>
              <strong>Custody expiry:</strong>{" "}
              {report.custodyExpiresAt ?? "no verified original receipt"}
            </p>
          </div>
          <p className={styles.note}>
            Signatures are checked using separately enrolled public keys against
            the production hostname fingerprint, exact deployed commit and
            migration 0238 checksum. The original database hostname, private
            credentials and source documents are not displayed. A signature
            alone is not independent legal identity verification.
          </p>
        </section>
        <section className="content-panel">
          <SectionHeading
            eyebrow="No live money movement"
            title="External provider and settlement readiness"
            id="finance262-provider"
            helpTopic="shell.overview"
          />
          <div className={styles.meta}>
            <p>
              <strong>Provider enrollment:</strong>{" "}
              {report.providerEnrollmentStatus}
            </p>
            <p>
              <strong>External payment adapter:</strong>{" "}
              {report.paymentAdapterReady
                ? "capability detected"
                : "NOT INSTALLED"}
            </p>
            <p>
              <strong>External refund adapter:</strong>{" "}
              {report.refundAdapterReady
                ? "capability detected"
                : "NOT INSTALLED"}
            </p>
            <p>
              <strong>Bank settlement verified:</strong>{" "}
              {report.independentlyVerifiedBankSettlement
                ? "verified"
                : "HOLD — original bank receipt unavailable"}
            </p>
          </div>
          <p>
            A source-consistent invoice, HST calculation, or settlement
            statement is not proof that the provider deposited funds.
            Independent bank evidence, approved provider credentials, insurance,
            accounting and owner authorization remain separate.
          </p>
        </section>
        <section className="content-panel">
          <SectionHeading
            eyebrow="Fail-closed activation"
            title="Outstanding independent blockers"
            id="finance262-holds"
            helpTopic="shell.overview"
          />
          {report.activation.blockers.length ? (
            <div className={styles.warning} role="alert">
              {report.activation.blockers.map((blocker, index) => (
                <p key={index}>{blocker}</p>
              ))}
            </div>
          ) : (
            <p>
              Technical controls are ready for a separate authenticated owner
              activation process. No bank close or financial posting occurs.
            </p>
          )}
          <p>
            This application remains non-posting and cannot automatically enable
            external charges, refunds, settlements, tax filing or the accounting
            close.
          </p>
        </section>
      </div>
    </AppShell>
  );
}
