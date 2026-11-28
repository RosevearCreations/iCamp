import type { Metadata } from "next";
import Link from "next/link";

import { SysopShell } from "@/components/sysop-shell";
import { requireSysop } from "@/lib/platform/access";

import { TenantPlan } from "./tenant-plan";

export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "New campground onboarding plan · iCamp",
  robots: { index: false, follow: false },
};

export default async function TenantOnboardingPage() {
  await requireSysop("/sysop");
  return (
    <SysopShell>
      <section className="content-panel">
        <h1>New campground onboarding</h1>
        <p>
          Prepare a new independent campground plan. This is not a subscriber
          contract, owner approval or a live tenant creation service. Do not
          enter passwords, payment details or private customer information.
        </p>
        <TenantPlan />
        <p>
          <Link href="/sysop/accounts">Operator accounts and access</Link>
        </p>
      </section>
    </SysopShell>
  );
}
