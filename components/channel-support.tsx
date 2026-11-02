import {
  channelLabels,
  supportLabels,
  type ChannelKey,
  type ChannelSupport,
} from "@/lib/channels";

const channelOrder: readonly ChannelKey[] = ["web", "ivr", "sms"];

export function ChannelSupportSummary({
  support,
}: Readonly<{
  support: Readonly<ChannelSupport>;
}>) {
  return (
    <dl className="channel-grid">
      {channelOrder.map((channel) => (
        <div className="channel-card" key={channel}>
          <dt>{channelLabels[channel]}</dt>
          <dd>{supportLabels[support[channel]]}</dd>
        </div>
      ))}
      {support.note ? (
        <div className="channel-note">
          <dt>Channel note</dt>
          <dd>{support.note}</dd>
        </div>
      ) : null}
    </dl>
  );
}
