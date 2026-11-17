import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";

import { AppShell } from "@/components/app-shell";
import { FinanceClose260Review } from "@/components/finance-close260-review";
import { SectionHeading } from "@/components/section-heading";
import { requireStaff } from "@/lib/auth/current-session";
import {
  getCampgroundAuthorization,
  listAssignedCampgrounds,
} from "@/lib/authz/postgres.mjs";

import styles from "../finance-close/finance-close.module.css";

export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "Build 260 · Provider evidence & owner financial review · iCamp",
  description:
    "Independent signer, HST invoice arithmetic, accounting comparison and owner-only non-posting evidence approval.",
};

export default async function FinanceClose260Page({
  searchParams,
}: Readonly<{
  searchParams: Promise<{ campground?: string; day?: string }>;
}>) {
  const path = "/workspaces/management/command/finance-close260";
  const session = await requireStaff(path);
  const query = await searchParams;
  const assigned = await listAssignedCampgrounds(session.user.id);
  const permitted = (
    await Promise.all(
      assigned.map(async (campground) => {
        const auth = await getCampgroundAuthorization(
          session.user.id,
          campground.campgroundId,
        );
        return auth?.permissions.some((item) =>
          ["finance.read", "finance.manage"].includes(item),
        ) &&
          auth.permissions.some((item) =>
            ["reservation.read", "reservation.modify"].includes(item),
          )
          ? { campground, auth }
          : null;
      }),
    )
  ).filter((value): value is NonNullable<typeof value> => value !== null);
  if (!permitted.length) redirect("/auth/not-authorized");
  const selected =
    permitted.find(
      ({ campground }) => campground.campgroundId === query.campground,
    ) ?? permitted[0];
  const ownerCandidate =
    selected.auth.permissions.includes("finance.manage") &&
    selected.auth.permissions.includes("staff.manage");

  return (
    <AppShell>
      <div className="page-stack">
        <nav className="breadcrumbs" aria-label="Breadcrumb">
          <Link href="/">iCamp</Link>
          <span>/</span>
          <Link href="/workspaces/management/command">Management Command</Link>
          <span>/</span>
          <Link href="/workspaces/management/command/finance-reconciliation">
            Finance reconciliation
          </Link>
          <span>/</span>
          <span>Build 260</span>
        </nav>
        <section className="hero-panel">
          <p className="eyebrow">Build 260 · owner-gated financial custody</p>
          <h1>Provider settlement, invoice/HST & owner close review</h1>
          <p className="hero-panel__lead">
            Verify an independently enrolled signature against original payment
            references, compare HST figures using genuine tax-invoice exports,
            reconcile accounting movements, then independently record an
            owner-approved non-posting evidence packet only.
          </p>
          <p>
            <strong>Activation status:</strong> HOLD until the external
            settlement signer is genuinely enrolled and migration 0238 is
            independently applied and verified. The current mock payment adapter
            cannot verify external settlement.
          </p>
        </section>
        <section className="content-panel">
          <SectionHeading
            id="finance260-scope"
            eyebrow="Tenant and day isolation"
            title="Choose the original financial sources"
            helpTopic="shell.overview"
          />
          <form method="get" className={styles.controls}>
            <label>
              Campground
              <select
                name="campground"
                defaultValue={selected.campground.campgroundId}
              >
                {permitted.map(({ campground }) => (
                  <option
                    value={campground.campgroundId}
                    key={campground.campgroundId}
                  >
                    {campground.campgroundName}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Local campground date
              <input type="date" name="day" defaultValue={query.day} />
            </label>
            <button type="submit" className="secondary-link">
              Select original sources
            </button>
          </form>
          <p className={styles.note}>
            Historic source rows are capped. Selection does not certify uncapped
            balances. Review cannot promote incomplete evidence.
          </p>
        </section>
        <FinanceClose260Review
          key={selected.campground.campgroundId + ":" + (query.day ?? "")}
          campgroundId={selected.campground.campgroundId}
          day={query.day ?? ""}
          ownerCandidate={ownerCandidate}
        />
      </div>
    </AppShell>
  );
}
