import type { Metadata } from "next";
import Link from "next/link";

import { AppShell } from "@/components/app-shell";
import { SectionHeading } from "@/components/section-heading";

export const metadata: Metadata = {
  title: "Not authorized · iCamp",
};

export default function NotAuthorizedPage() {
  return (
    <AppShell>
      <div className="page-stack">
        <section className="content-panel auth-panel">
          <SectionHeading
            eyebrow="Access control"
            title="This account cannot open that area."
            id="not-authorized-heading"
            helpTopic="auth.sessions"
          />
          <p>
            Authentication confirms identity. Campground roles and permissions
            are defined separately in Build 005.
          </p>
          <Link className="primary-link primary-link--dark" href="/">
            Return to iCamp
          </Link>
        </section>
      </div>
    </AppShell>
  );
}
