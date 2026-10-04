import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { AppShell } from "@/components/app-shell";
import { getHelpTopicBySlug, helpTopics } from "@/lib/help/topics";

export function generateStaticParams() {
  return Object.values(helpTopics).map((topic) => ({ topic: topic.slug }));
}

export async function generateMetadata({
  params,
}: Readonly<{
  params: Promise<{ topic: string }>;
}>): Promise<Metadata> {
  const { topic: slug } = await params;
  const topic = getHelpTopicBySlug(slug);

  if (!topic) {
    return { title: "Help topic not found · iCamp" };
  }

  return {
    title: `${topic.title} · iCamp Help`,
    description: topic.summary,
  };
}

export default async function HelpTopicPage({
  params,
}: Readonly<{
  params: Promise<{ topic: string }>;
}>) {
  const { topic: slug } = await params;
  const topic = getHelpTopicBySlug(slug);

  if (!topic) {
    notFound();
  }

  return (
    <AppShell>
      <div className="page-stack">
        <nav className="breadcrumbs" aria-label="Breadcrumb">
          <Link href="/">iCamp</Link>
          <span aria-hidden="true">/</span>
          <Link href="/help">Help</Link>
          <span aria-hidden="true">/</span>
          <span>{topic.title}</span>
        </nav>

        <section className="hero-panel">
          <p className="eyebrow">Help · {topic.audience}</p>
          <h1>{topic.title}</h1>
          <p className="hero-panel__lead">{topic.summary}</p>
        </section>

        <section className="content-panel" aria-labelledby="guidance-heading">
          <h2 id="guidance-heading">Guidance</h2>
          <ul className="help-guidance-list">
            {topic.details.map((detail) => (
              <li key={detail}>{detail}</li>
            ))}
          </ul>
        </section>
      </div>
    </AppShell>
  );
}
