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

  return (
    <section ref={chatRef} className="consultation-chat follow-up-chat-thread" aria-label="Переписка">
      {messages.length === 0 ? (
        <div className="follow-up-chat-empty">
          <EmptyState title={emptyTitle} description={emptyDescription} />
        </div>
      ) : (
        messages.map((message) => (
          <FollowUpMessageBubble key={message.id} message={message} viewerRole={viewerRole} />
        ))
      )}
    </section>
  );
}
