import { useEffect, useRef } from 'react';
import type { ConsultationMessage } from '../../types/consultation';
import { AssistantMessage } from './AssistantMessage';
import { UserMessage } from './UserMessage';
import { TypingIndicator } from './TypingIndicator';

const WELCOME_FALLBACK =
  'Здравствуйте! Я виртуальный консультант автосервиса. Напишите марку, модель, пробег и опишите запрос (неисправность или плановую работу) — можно по отдельности сообщениями; я задам только недостающие уточнения.';

export function ConsultationChat({
  messages,
  isTyping,
  assistantName = 'ИИ-ассистент',
}: {
  messages: ConsultationMessage[];
  isTyping: boolean;
  assistantName?: string;
}) {
  const chatRef = useRef<HTMLElement>(null);

  useEffect(() => {
    const el = chatRef.current;
    if (!el) return;
    el.scrollTop = el.scrollHeight;
  }, [messages, isTyping]);

  return (
    <section ref={chatRef} className="consultation-chat" aria-label="Диалог консультации">
      {messages.length === 0 ? (
        <div className="chat-bubble chat-bubble-assistant welcome-bubble">
          <header>{assistantName}</header>
          <p>{WELCOME_FALLBACK}</p>
        </div>
      ) : null}
      {messages.map((message) =>
        message.sender === 'ASSISTANT' || message.sender === 'SYSTEM' ? (
          <AssistantMessage key={message.id} message={message} assistantName={assistantName} />
        ) : (
          <UserMessage key={message.id} message={message} />
        ),
      )}
      <TypingIndicator visible={isTyping} />
    </section>
  );
}
