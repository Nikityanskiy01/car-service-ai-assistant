import { Headphones, UserRound } from 'lucide-react';
import type { FollowUpMessage } from '../../api/dashboard';
import { MessageAttachmentList } from '../requests/MessageAttachmentList';

function formatMessageTime(value: string) {
  return new Date(value).toLocaleString('ru-RU', {
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  });
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
    ? viewerRole === 'CLIENT'
      ? 'Вы'
      : 'Вы'
    : message.author?.fullName || (viewerRole === 'CLIENT' ? 'Менеджер' : 'Клиент');

  return (
    <article
      className={`chat-bubble ${isOwn ? 'chat-bubble-user' : 'chat-bubble-assistant'}`}
      aria-label={`Сообщение: ${name}`}
    >
      <header>
        {isOwn ? <UserRound size={14} aria-hidden /> : <Headphones size={14} aria-hidden />}
        <span>{name}</span>
        <time dateTime={message.createdAt}>{formatMessageTime(message.createdAt)}</time>
      </header>
      {message.body ? <p className="chat-bubble-text">{message.body}</p> : null}
      <MessageAttachmentList attachments={message.attachments} />
    </article>
  );
}
