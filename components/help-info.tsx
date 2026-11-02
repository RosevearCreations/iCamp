import Link from "next/link";

import { getHelpTopicById, type HelpTopicId } from "@/lib/help/topics";

export function HelpInfo({
  topicId,
  label,
}: Readonly<{
  topicId: HelpTopicId;
  label?: string;
}>) {
  const topic = getHelpTopicById(topicId);

  if (!topic) {
    return null;
  }

  return (
    <details className="help-info">
      <summary
        aria-label={label ?? `Help: ${topic.title}`}
        title={label ?? `Help: ${topic.title}`}
      >
        <span aria-hidden="true">i</span>
      </summary>
      <div className="help-info__panel">
        <strong>{topic.title}</strong>
        <p>{topic.summary}</p>
        <Link href={`/help/${topic.slug}`}>Open full help →</Link>
      </div>
    </details>
  );
}
