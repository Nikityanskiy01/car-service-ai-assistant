import type { FollowUpMessage } from '../../api/dashboard';
import type { PendingAttachment } from '../requests/MessageAttachmentInput';
import { Card } from '../ui/Card';
import { FollowUpChatComposer } from './FollowUpChatComposer';
import { FollowUpChatThread } from './FollowUpChatThread';

function messagesLabel(count: number) {
  const abs = Math.abs(count) % 100;
  const last = abs % 10;
  if (abs > 10 && abs < 20) return 'сообщений';
  if (last > 1 && last < 5) return 'сообщения';
  if (last === 1) return 'сообщение';
  return 'сообщений';
}

type Template = {
  id: string;
  label: string;
  body: string;
};

type Props = {
  messages: FollowUpMessage[];
  value: string;
  onChange: (value: string) => void;
  onSubmit: () => void | Promise<void>;
  disabled?: boolean;
  sending?: boolean;
  error?: string | null;
  placeholder?: string;
  attachments?: PendingAttachment[];
  onAttachmentsChange?: (files: PendingAttachment[]) => void;
  templates?: Template[];
  closedMessage?: string;
  viewerRole?: 'CLIENT' | 'MANAGER' | 'ADMINISTRATOR';
  emptyTitle?: string;
  emptyDescription?: string;
  title?: string;
  subtitle?: string;
};

export function FollowUpChatPanel({
  messages,
  value,
  onChange,
  onSubmit,
  disabled,
  sending,
  error,
  placeholder,
  attachments,
  onAttachmentsChange,
  templates,
  closedMessage,
  viewerRole = 'CLIENT',
  emptyTitle,
  emptyDescription,
  title,
  subtitle,
}: Props) {
  return (
    <Card className="consult-chat-card follow-up-chat-card">
      {title ? (
        <header className="follow-up-chat-head">
          <div>
            <h2>{title}</h2>
            {subtitle ? <p>{subtitle}</p> : null}
          </div>
          {messages.length > 0 ? (
            <span className="follow-up-chat-count">
              {messages.length} {messagesLabel(messages.length)}
            </span>
          ) : null}
        </header>
      ) : null}
      <div className="consult-chat-body">
        <FollowUpChatThread
          messages={messages}
          viewerRole={viewerRole}
          emptyTitle={emptyTitle}
          emptyDescription={emptyDescription}
        />
      </div>
      <FollowUpChatComposer
        value={value}
        onChange={onChange}
        onSubmit={onSubmit}
        disabled={disabled}
        sending={sending}
        error={error}
        placeholder={placeholder}
        attachments={attachments}
        onAttachmentsChange={onAttachmentsChange}
        templates={closedMessage ? undefined : templates}
        closedMessage={closedMessage}
      />
    </Card>
  );
}
