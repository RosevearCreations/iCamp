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
import { inspectFinancialEvidence263 } from "@/lib/finance-assurance263/postgres.mjs";

import styles from "../finance-close/finance-close.module.css";

export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "Build 263 · External financial evidence · iCamp",
  description:
    "Original financial statement signature checks without bank clearing or live payment activation.",
};

export default async function FinancialEvidence263Page() {
  const path = "/workspaces/management/command/finance-assurance263";
  const user = await requireStaff(path);
  const assigned = await listAssignedCampgrounds(user.user.id);
  const permissions = await Promise.all(
    assigned.map(async (campground) => {
      const grant = await getCampgroundAuthorization(
        user.user.id,
        campground.campgroundId,
      );
      return Boolean(
        grant?.permissions.includes("finance.manage") &&
        grant.permissions.includes("staff.manage") &&
        grant.permissions.some((value) =>
          ["reservation.read", "reservation.modify"].includes(value),
        ),
      );
    }),
  );
  if (!permissions.some(Boolean)) redirect("/auth/not-authorized");
  const evidence = await inspectFinancialEvidence263();
  return (
    <AppShell>
      <div className="page-stack">
        <nav className="breadcrumbs" aria-label="Breadcrumb">
          <Link href="/">iCamp</Link>
          <span>/</span>
          <Link href="/workspaces/management/command/finance-assurance262">
            Independent database custody
          </Link>
          <span>/</span>
          <span>Build 263 financial evidence</span>
        </nav>
        <section className="hero-panel">
          <p className="eyebrow">Build 263 · read-only evidence validation</p>
          <h1>Independent financial statement evidence</h1>
          <p className="hero-panel__lead">
            Review separately enrolled issuer and independent reviewer
            signatures against the original statement digest, issuer identity,
            exact deployed commit and bounded expiry. This is not a bank
            connection and never records a transfer of funds.
          </p>
          <p>
            <strong>Live financial activation:</strong> {evidence.status}
          </p>
        </section>
        <section className="content-panel">
          <SectionHeading
            id="financial263-source"
            eyebrow="Two-party original signature check"
            title="Observed financial source"
            helpTopic="shell.overview"
          />
          <div className={styles.meta}>
            <p>
              <strong>Signed source:</strong> {evidence.signedEvidenceStatus}
            </p>
            <p>
              <strong>Statement reference:</strong>{" "}
              {evidence.evidenceStatementId ?? "not observed"}
            </p>
            <p>
              <strong>Reported currency:</strong>{" "}
              {evidence.evidenceCurrency ?? "not observed"}
            </p>
            <p>
              <strong>Reported amount:</strong>{" "}
              {evidence.evidenceAmountCents == null
                ? "not observed"
                : `${evidence.evidenceAmountCents} original cents (not bank-confirmed)`}
            </p>
            <p>
              <strong>Bank API verification:</strong>{" "}
              {evidence.independentBankApiConfirmed
                ? "independently verified"
                : "HOLD — unavailable"}
            </p>
          </div>
          <p className={styles.note}>
            A document whose signatures verify only proves that the enrolled
            keys signed that document. It does not prove legal identity,
            settlement finality or receipt by a bank. Independent bank-provider
            API confirmation, external payment/refund adapters and authorized
            financial operations remain HOLD.
          </p>
        </section>
        <section className="content-panel">
          <SectionHeading
            id="financial263-blockers"
            eyebrow="Production-safe boundaries"
            title="Unresolved evidence and activation checks"
            helpTopic="shell.overview"
          />
          <div className={styles.warning} role="alert">
            {evidence.blockers.map((blocker, index) => (
              <p key={index}>{blocker}</p>
            ))}
          </div>
          <p>
            No payment capture, refund, accounting posting, tax filing, bank
            statement retrieval or guest account modification occurs.
          </p>
        </section>
      </div>
    </AppShell>
  );
}
