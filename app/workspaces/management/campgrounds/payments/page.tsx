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
import { getCampgroundPaymentPolicy } from "@/lib/payments/postgres.mjs";
import { getPaymentProviderConfig } from "@/lib/payments/provider.mjs";

import styles from "../booking-rules/booking-rules.module.css";
import { savePaymentPolicyAction } from "./actions";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Deposits, balances & payments · iCamp",
  description:
    "Configure campground deposit, security-deposit and balance-due rules.",
};

function money(cents: number | null) {
  return ((cents ?? 0) / 100).toFixed(2);
}

export default async function PaymentPolicyPage({
  searchParams,
}: Readonly<{
  searchParams: Promise<{ campground?: string; saved?: string }>;
}>) {
  const path = "/workspaces/management/campgrounds/payments";
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
        return authorization?.permissions.includes("campground.configuration")
          ? campground
          : null;
      }),
    )
  ).filter((item): item is NonNullable<typeof item> => item !== null);

  if (authorized.length === 0) {
    redirect("/auth/not-authorized");
  }

  const selected =
    authorized.find((item) => item.campgroundId === params.campground) ??
    authorized[0];
  const snapshot = await getCampgroundPaymentPolicy(
    session.user.id,
    selected.campgroundId,
  );
  const policy = snapshot.policy;
  const provider = getPaymentProviderConfig();

  return (
    <AppShell>
      <div className="page-stack">
        <nav className="breadcrumbs" aria-label="Breadcrumb">
          <Link href="/">iCamp</Link>
          <span>/</span>
          <Link href="/workspaces/management">Management</Link>
          <span>/</span>
          <Link href="/workspaces/management/campgrounds">Campgrounds</Link>
          <span>/</span>
          <span>Payments</span>
        </nav>

        <section className="hero-panel">
          <p className="eyebrow">Build 042</p>
          <h1>Deposits, balances & payment provider</h1>
          <p className="hero-panel__lead">
            Configure the amount due at booking, refundable security-deposit
            timing and the remaining reservation balance due rule.
          </p>
        </section>

        {params.saved ? (
          <div className={styles.notice}>{params.saved}</div>
        ) : null}

        <section className="content-panel">
          <SectionHeading
            eyebrow="Property scope"
            title="Choose campground"
            id="payment-scope"
            helpTopic="campground.structure"
          />
          <form method="get" className={styles.selector}>
            <label className={styles.field}>
              <span>Campground</span>
              <select name="campground" defaultValue={selected.campgroundId}>
                {authorized.map((campground) => (
                  <option
                    key={campground.campgroundId}
                    value={campground.campgroundId}
                  >
                    {campground.campgroundName}
                  </option>
                ))}
              </select>
            </label>
            <button className="primary-button" type="submit">
              Open payment policy
            </button>
          </form>
        </section>

        <section className="content-panel">
          <SectionHeading
            eyebrow="Provider adapter"
            title="Current development provider"
            id="payment-provider"
            helpTopic="shell.overview"
          />
          <p>
            Provider <strong>{provider.provider}</strong> · mode{" "}
            <strong>{provider.mode}</strong>.
          </p>
          <p>
            The built-in mock adapter is free and exercises payment idempotency,
            captures and provider-event processing without collecting card data.
            A live provider remains replaceable behind the same adapter
            contract.
          </p>
          <p>
            <Link
              href={
                "/workspaces/management/campgrounds/refunds?campground=" +
                encodeURIComponent(selected.campgroundId)
              }
            >
              Configure Build 045 cancellation/refund safeguards →
            </Link>
          </p>
        </section>

        <section className="content-panel">
          <SectionHeading
            eyebrow="Campground policy"
            title="Deposit, security deposit & balance"
            id="payment-policy"
            helpTopic="campground.structure"
          />
          <form action={savePaymentPolicyAction} className={styles.formGrid}>
            <input
              type="hidden"
              name="campgroundId"
              value={selected.campgroundId}
            />
            <input type="hidden" name="rowVersion" value={policy.rowVersion} />

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
              <span>Deposit mode</span>
              <select name="depositMode" defaultValue={policy.depositMode}>
                <option value="full">Full reservation total</option>
                <option value="fixed">Fixed amount</option>
                <option value="percentage">Percentage</option>
              </select>
            </label>

            <label className={styles.field}>
              <span>Fixed deposit amount</span>
              <input
                name="depositFixedAmount"
                inputMode="decimal"
                defaultValue={money(policy.depositFixedCents)}
                pattern="\d+(?:\.\d{1,2})?"
              />
            </label>

            <label className={styles.field}>
              <span>Deposit percentage</span>
              <input
                name="depositPercentage"
                type="number"
                min="0.01"
                max="100"
                step="0.01"
                defaultValue={
                  policy.depositPercentageBasisPoints == null
                    ? "25.00"
                    : (policy.depositPercentageBasisPoints / 100).toFixed(2)
                }
              />
            </label>

            <label className={styles.field}>
              <span>Security deposit amount</span>
              <input
                name="securityDepositAmount"
                inputMode="decimal"
                defaultValue={money(policy.securityDepositCents)}
                pattern="\d+(?:\.\d{1,2})?"
                required
              />
            </label>

            <label className={styles.field}>
              <span>Security deposit due</span>
              <select
                name="securityDepositDueStage"
                defaultValue={policy.securityDepositDueStage}
              >
                <option value="with_deposit">With booking deposit</option>
                <option value="with_balance">With reservation balance</option>
                <option value="on_arrival">On arrival</option>
              </select>
            </label>

            <label className={styles.field}>
              <span>Reservation balance due</span>
              <select
                name="balanceDueMode"
                defaultValue={policy.balanceDueMode}
              >
                <option value="at_booking">At booking</option>
                <option value="days_before_arrival">Days before arrival</option>
                <option value="on_arrival">On arrival</option>
              </select>
            </label>

            <label className={styles.field}>
              <span>Days before arrival</span>
              <input
                name="balanceDueDaysBeforeArrival"
                type="number"
                min="1"
                max="365"
                defaultValue={policy.balanceDueDaysBeforeArrival ?? 30}
              />
            </label>

            <div className={styles.actions}>
              <button className="primary-button" type="submit">
                Save payment policy
              </button>
            </div>
          </form>

          <p className={styles.boundary}>
            New reservations snapshot the effective policy when their payment
            schedule is first created. Existing reservation schedules remain
            immutable even if this campground policy changes later.
          </p>
        </section>

        <section className="content-panel">
          <h2>Security boundary</h2>
          <p>
            iCamp stores provider references, amounts, currency, state and
            verified event metadata only. Raw PAN/card numbers, CVV values and
            provider secrets are not stored in campground policy or reservation
            payment tables.
          </p>
        </section>
      </div>
    </AppShell>
  );
}
