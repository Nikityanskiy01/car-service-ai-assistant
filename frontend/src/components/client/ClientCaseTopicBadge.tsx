import { CLIENT_CASE_TOPIC_META, type ClientCaseTopic } from '../../features/client-cases/clientCaseTopic';

export function ClientCaseTopicBadge({
  topic,
  compact = false,
}: {
  topic: ClientCaseTopic;
  compact?: boolean;
}) {
  const meta = CLIENT_CASE_TOPIC_META[topic];
  return (
    <span
      className={`client-case-topic-badge is-topic-${topic}${compact ? ' is-compact' : ''}`}
      data-tone={meta.tone}
    >
      {compact ? meta.shortLabel : meta.label}
    </span>
  );
}
