import type { Metadata } from "next";
import Link from "next/link";

import { AppShell } from "@/components/app-shell";
import { helpTopics } from "@/lib/help/topics";

export const metadata: Metadata = {
  title: "Help · iCamp",
  description: "iCamp contextual help centre.",
};

export default function HelpIndexPage() {
  return (
    <AppShell>
      <div className="page-stack">
        <section className="hero-panel">
          <p className="eyebrow">Help centre</p>
          <h1>Guidance should be available where you need it.</h1>
          <p className="hero-panel__lead">
            Use the circular information controls throughout iCamp for quick
            inline help, or browse fuller guidance here.
          </p>
        </section>

        <section
          className="content-panel"
          aria-labelledby="help-topics-heading"
        >
          <h2 id="help-topics-heading">Help topics</h2>
          <div className="help-topic-grid">
            {Object.values(helpTopics).map((topic) => (
              <Link
                className="help-topic-card"
                href={`/help/${topic.slug}`}
                key={topic.id}
              >
                <span>{topic.audience}</span>
                <strong>{topic.title}</strong>
                <p>{topic.summary}</p>
              </Link>
            ))}
          </div>
        </section>
      </div>
    </AppShell>
  );
}
