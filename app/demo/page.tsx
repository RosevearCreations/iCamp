import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { AppShell } from "@/components/app-shell";
import { SectionHeading } from "@/components/section-heading";
import { publicConfig } from "@/lib/config/public";
import {
  demoCampgroundCatalogue,
  demoCampgroundSummary,
} from "@/lib/demo/catalogue.mjs";

export const metadata: Metadata = {
  title: "Demo Campground · iCamp",
  description:
    "Synthetic non-production campground fixtures for iCamp testing.",
};

export default function DemoCampgroundPage() {
  if (publicConfig.environment === "production") {
    notFound();
  }

  return (
    <AppShell>
      <div className="page-stack">
        <section className="hero-panel">
          <p className="eyebrow">Build 016 · Synthetic test environment</p>
          <h1>{demoCampgroundCatalogue.campground.name}</h1>
          <p className="hero-panel__lead">
            This catalogue is synthetic and exists only to exercise iCamp
            development, staging and automated browser flows. It contains no
            production personal data.
          </p>
          <div className="hero-actions">
            <Link className="primary-link" href="/">
              Return to iCamp
            </Link>
          </div>
        </section>

        <section
          className="content-panel"
          aria-labelledby="demo-summary-heading"
        >
          <SectionHeading
            eyebrow="Deterministic fixture set"
            title="A stable campground for repeatable tests"
            id="demo-summary-heading"
            helpTopic="shell.overview"
          />
          <div className="principle-grid">
            <article>
              <strong>{demoCampgroundSummary.sites} demo sites</strong>
              <p>
                Prototype tent, RV and mixed sites are fixture-only until the
                canonical accommodation builds introduce production tables.
              </p>
            </article>
            <article>
              <strong>{demoCampgroundSummary.cottages} demo cottages</strong>
              <p>
                Rustic, serviced and accessible cottage examples cover future
                booking and turnover scenarios without creating live inventory.
              </p>
            </article>
            <article>
              <strong>{demoCampgroundSummary.assets} demo assets</strong>
              <p>
                Gate, recreation, washroom, waterfront and maintenance examples
                are ready for later operational-asset workflows.
              </p>
            </article>
          </div>
        </section>

        <section
          className="content-panel"
          aria-labelledby="demo-sections-heading"
        >
          <SectionHeading
            eyebrow="Current canonical seed"
            title="Campground sections and subsections"
            id="demo-sections-heading"
            helpTopic="shell.workspaces"
            trailing={
              <span className="build-chip">
                {demoCampgroundSummary.sections} sections
              </span>
            }
          />
          <div className="workspace-grid">
            {demoCampgroundCatalogue.sections.map((section) => (
              <article className="workspace-card" key={section.id}>
                <span className="workspace-card__audience">{section.code}</span>
                <strong>{section.name}</strong>
                <p>
                  {section.subsections.map((item) => item.name).join(" · ")}
                </p>
                <span className="workspace-card__link">
                  {section.subsections.length} subsection
                  {section.subsections.length === 1 ? "" : "s"}
                </span>
              </article>
            ))}
          </div>
        </section>

        <section
          className="content-panel"
          aria-labelledby="demo-safety-heading"
        >
          <SectionHeading
            eyebrow="Safety boundary"
            title="Prototype inventory is intentionally not production schema"
            id="demo-safety-heading"
            helpTopic="it.analysis"
          />
          <p>
            Build 016 seeds only the existing organization, campground, section
            and subsection tables. Site, cottage and asset examples stay in the
            fixture catalogue until their roadmap-owned canonical models arrive.
          </p>
        </section>
      </div>
    </AppShell>
  );
}
