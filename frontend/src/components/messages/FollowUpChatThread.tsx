import { useEffect, useRef } from 'react';
import type { FollowUpMessage } from '../../api/dashboard';
import { EmptyState } from '../ui/EmptyState';
import { FollowUpMessageBubble } from './FollowUpMessageBubble';

type Props = {
  messages: FollowUpMessage[];
  viewerRole?: 'CLIENT' | 'MANAGER' | 'ADMINISTRATOR';
  emptyTitle?: string;
  emptyDescription?: string;
};

function dayKey(date: Date) {
  return `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`;
}

function formatDayLabel(value: string) {
  const date = new Date(value);
  const today = new Date();
  const yesterday = new Date();
  yesterday.setDate(today.getDate() - 1);

  const key = dayKey(date);
  if (key === dayKey(today)) return 'Сегодня';
  if (key === dayKey(yesterday)) return 'Вчера';

  return date.toLocaleDateString('ru-RU', {
    day: 'numeric',
    month: 'long',
  });
}

export function FollowUpChatThread({
  messages,
  viewerRole = 'CLIENT',
  emptyTitle = 'Сообщений пока нет',
  emptyDescription = 'Напишите первое сообщение — ответ появится здесь.',
}: Props) {
  const chatRef = useRef<HTMLElement>(null);

  useEffect(() => {
    const el = chatRef.current;
    if (!el) return;
    el.scrollTop = el.scrollHeight;
  }, [messages]);

  let lastDay = '';

  return (
    <section ref={chatRef} className="consultation-chat follow-up-chat-thread" aria-label="Переписка">
      {messages.length === 0 ? (
        <div className="follow-up-chat-empty">
          <EmptyState title={emptyTitle} description={emptyDescription} />
        </div>
      ) : (
        messages.map((message) => {
          const key = dayKey(new Date(message.createdAt));
          const showDay = key !== lastDay;
          lastDay = key;
          return (
            <div key={message.id} className="follow-up-chat-item">
              {showDay ? (
                <div className="follow-up-day-sep" role="separator">
                  <span>{formatDayLabel(message.createdAt)}</span>
                </div>
              ) : null}
              <FollowUpMessageBubble message={message} viewerRole={viewerRole} />
            </div>
          );
        })
      )}
    </section>
  );
}
