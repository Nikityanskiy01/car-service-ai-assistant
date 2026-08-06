import type { FollowUpMessage } from '../../api/dashboard';
import { MessageAttachmentList } from '../requests/MessageAttachmentList';

function formatMessageTime(value: string) {
  return new Date(value).toLocaleString('ru-RU', {
    hour: '2-digit',
    minute: '2-digit',
  });
}

function initials(name: string) {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? '')
    .join('');
}

type Props = {
  message: FollowUpMessage;
  viewerRole?: 'CLIENT' | 'MANAGER' | 'ADMINISTRATOR';
};

export function FollowUpMessageBubble({ message, viewerRole = 'CLIENT' }: Props) {
  const isOwn =
    viewerRole === 'CLIENT'
      ? message.author?.role === 'CLIENT'
      : message.author?.role !== 'CLIENT';
  const name = isOwn
    ? 'Вы'
    : message.author?.fullName || (viewerRole === 'CLIENT' ? 'Менеджер' : 'Клиент');

  return (
    <article
      className={`follow-up-bubble ${isOwn ? 'is-own' : 'is-peer'}`}
      aria-label={`Сообщение: ${name}`}
    >
      {!isOwn ? (
        <div className="follow-up-bubble-avatar" aria-hidden>
          {initials(name) || 'М'}
        </div>
      ) : null}
      <div className="follow-up-bubble-stack">
        {!isOwn ? <p className="follow-up-bubble-name">{name}</p> : null}
        <div className="follow-up-bubble-card">
          {message.body ? <p className="follow-up-bubble-text">{message.body}</p> : null}
          <MessageAttachmentList attachments={message.attachments} />
          <time dateTime={message.createdAt}>{formatMessageTime(message.createdAt)}</time>
        </div>
      </div>
    </article>
  );
}
