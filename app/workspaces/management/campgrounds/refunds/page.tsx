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
import { getRefundProviderConfig } from "@/lib/refunds/provider.mjs";
import { getCampgroundCancellationRefundPolicy } from "@/lib/refunds/postgres.mjs";

import styles from "../booking-rules/booking-rules.module.css";
import { saveCancellationRefundPolicyAction } from "./actions";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Cancellation & refund policy · iCamp",
  description:
    "Configure cancellation refund percentages, fees and approval safeguards.",
};

function money(cents: number) {
  return (cents / 100).toFixed(2);
}

function percent(basisPoints: number) {
  return (basisPoints / 100).toFixed(2);
}

export default async function CancellationRefundPolicyPage({
  searchParams,
}: Readonly<{
  searchParams: Promise<{
    campground?: string;
    saved?: string;
  }>;
}>) {
  const path = "/workspaces/management/campgrounds/refunds";
  const session = await requireStaff(path);
  const params = await searchParams;
  const assigned = await listAssignedCampgrounds(session.user.id);

  const authorized = (
    await Promise.all(
      assigned.map(async (item) => {
        const auth = await getCampgroundAuthorization(
          session.user.id,
          item.campgroundId,
        );
        return auth?.permissions.some((permission) =>
          [
            "finance.read",
            "finance.manage",
            "refund.issue",
            "campground.configuration",
          ].includes(permission),
        )
          ? { item, auth }
          : null;
      }),
    )
  ).filter((item): item is NonNullable<typeof item> => item !== null);

  if (authorized.length === 0) {
    redirect("/auth/not-authorized");
  }

  const selected =
    authorized.find(({ item }) => item.campgroundId === params.campground) ??
    authorized[0];
  const snapshot = await getCampgroundCancellationRefundPolicy({
    userId: session.user.id,
    campgroundId: selected.item.campgroundId,
  });
  const policy = snapshot.policy;
  const mayManage = selected.auth.permissions.some((permission) =>
    ["finance.manage", "campground.configuration"].includes(permission),
  );
  const provider = getRefundProviderConfig();

  return (
    <AppShell>
      <div className="page-stack">
        <nav className="breadcrumbs" aria-label="Breadcrumb">
          <Link href="/">iCamp</Link>
          <span>/</span>
          <Link href="/workspaces/management">Management</Link>
          <span>/</span>
          <Link href="/workspaces/management/campgrounds/payments">
            Payments
          </Link>
          <span>/</span>
          <span>Refund policy</span>
        </nav>

        <section className="hero-panel">
          <p className="eyebrow">Build 045 · Financial safeguards</p>
          <h1>Cancellation, refund & approval policy</h1>
          <p className="hero-panel__lead">
            Set the policy recommendation and approval threshold used before
            money is returned. Captured payment evidence remains immutable.
          </p>
        </section>

        {params.saved ? (
          <div className={styles.notice}>{params.saved}</div>
        ) : null}

        <section className="content-panel">
          <SectionHeading
            eyebrow="Property scope"
            title="Choose campground"
            id="refund-policy-scope"
            helpTopic="campground.structure"
          />
          <form method="get" className={styles.selector}>
            <label className={styles.field}>
              <span>Campground</span>
              <select
                name="campground"
                defaultValue={selected.item.campgroundId}
              >
                {authorized.map(({ item }) => (
                  <option key={item.campgroundId} value={item.campgroundId}>
                    {item.campgroundName}
                  </option>
                ))}
              </select>
            </label>
            <button className="primary-button" type="submit">
              Open refund policy
            </button>
          </form>
        </section>

        <section className="content-panel">
          <SectionHeading
            eyebrow="Provider adapter"
            title="Refund execution boundary"
            id="refund-provider"
            helpTopic="shell.overview"
          />
          <p>
            Provider <strong>{provider.provider}</strong> · mode{" "}
            <strong>{provider.mode}</strong>.
          </p>
          <p>
            The built-in mock adapter is free and exercises provider
            idempotency, original-payment linkage and successful refund evidence
            without a paid payment account.
          </p>
        </section>

        <section className="content-panel">
          <SectionHeading
            eyebrow="Cancellation policy"
            title="Refund recommendation & approval"
            id="refund-policy"
            helpTopic="campground.structure"
          />
          {mayManage ? (
            <form
              action={saveCancellationRefundPolicyAction}
              className={styles.formGrid}
            >
              <input
                type="hidden"
                name="campgroundId"
                value={selected.item.campgroundId}
              />
              <input
                type="hidden"
                name="rowVersion"
                value={policy.rowVersion}
              />

              <label className={styles.field}>
                <span>Currency</span>
                <input
                  name="currencyCode"
                  defaultValue={policy.currencyCode}
                  pattern="[A-Z]{3}"
                  maxLength={3}
                  required
                />
              </label>

              <label className={styles.field}>
                <span>Free-cancellation cutoff (days before arrival)</span>
                <input
                  name="freeCancellationDaysBeforeArrival"
                  type="number"
                  min="0"
                  max="365"
                  defaultValue={policy.freeCancellationDaysBeforeArrival}
                  required
                />
              </label>

              <label className={styles.field}>
                <span>Refund before cutoff (%)</span>
                <input
                  name="earlyRefundPercentage"
                  type="number"
                  min="0"
                  max="100"
                  step="0.01"
                  defaultValue={percent(policy.earlyRefundBasisPoints)}
                  required
                />
              </label>

              <label className={styles.field}>
                <span>Refund after cutoff (%)</span>
                <input
                  name="lateRefundPercentage"
                  type="number"
                  min="0"
                  max="100"
                  step="0.01"
                  defaultValue={percent(policy.lateRefundBasisPoints)}
                  required
                />
              </label>

              <label className={styles.field}>
                <span>Security-deposit refund (%)</span>
                <input
                  name="securityDepositRefundPercentage"
                  type="number"
                  min="0"
                  max="100"
                  step="0.01"
                  defaultValue={percent(
                    policy.securityDepositRefundBasisPoints,
                  )}
                  required
                />
              </label>

              <label className={styles.field}>
                <span>Cancellation fee</span>
                <input
                  name="cancellationFeeAmount"
                  inputMode="decimal"
                  defaultValue={money(policy.cancellationFeeCents)}
                  pattern="\d+(?:\.\d{1,2})?"
                  required
                />
              </label>

              <label className={styles.field}>
                <span>Approval threshold</span>
                <input
                  name="approvalThresholdAmount"
                  inputMode="decimal"
                  defaultValue={money(policy.approvalThresholdCents)}
                  pattern="\d+(?:\.\d{1,2})?"
                  required
                />
              </label>

              <div className={styles.actions}>
                <button className="primary-button" type="submit">
                  Save cancellation/refund policy
                </button>
              </div>
            </form>
          ) : (
            <p>
              You may review this policy, but finance management or campground
              configuration authority is required to change it.
            </p>
          )}

          <p className={styles.boundary}>
            Refund recommendations never mutate the original Build 041 quote,
            Build 042 payment schedule/capture, Build 043 documents or Build 044
            reservation-change history. Overrides above policy or threshold
            require a separate approver.
          </p>
        </section>

        <section className="content-panel">
          <h2>Channel contract</h2>
          <p>
            <strong>Web/PWA:</strong> full policy configuration, refund request,
            approval and execution review.
          </p>
          <p>
            <strong>IVR/DTMF:</strong> verified staff may hear refund status;
            refund approval/execution uses staff-assisted or secure visual
            fallback and never collects payment credentials.
          </p>
          <p>
            <strong>SMS/MMS:</strong> concise status plus secure-link handoff;
            no raw payment credentials or unrestricted financial documents are
            accepted through messaging.
          </p>
        </section>
      </div>
    </AppShell>
  );
}
