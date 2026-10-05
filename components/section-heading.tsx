import { HelpInfo } from "@/components/help-info";
import type { HelpTopicId } from "@/lib/help/topics";

export function SectionHeading({
  eyebrow,
  title,
  id,
  helpTopic,
  trailing,
}: Readonly<{
  eyebrow: string;
  title: string;
  id: string;
  helpTopic: HelpTopicId;
  trailing?: React.ReactNode;
}>) {
  return (
    <div className="section-heading">
      <div>
        <p className="eyebrow">{eyebrow}</p>
        <div className="section-heading__title-row">
          <h2 id={id}>{title}</h2>
          <HelpInfo topicId={helpTopic} />
        </div>
      </div>
      {trailing}
    </div>
  );
}
