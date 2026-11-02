import Link from "next/link";

import { AppShell } from "@/components/app-shell";

export default function NotFound() {
  return (
    <AppShell>
      <section className="hero-panel">
        <p className="eyebrow">Not found</p>
        <h1>This iCamp workspace does not exist.</h1>
        <p className="hero-panel__lead">
          The application shell only exposes registered workspaces. This keeps
          navigation data-driven and prevents stray routes from becoming part of
          the product accidentally.
        </p>
        <Link className="primary-link" href="/">
          Return to iCamp
        </Link>
      </section>
    </AppShell>
  );
}
