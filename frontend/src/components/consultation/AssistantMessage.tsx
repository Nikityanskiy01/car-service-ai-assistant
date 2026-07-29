import { Bot } from 'lucide-react';
import type { ConsultationMessage } from '../../types/consultation';

export function AssistantMessage({
  message,
  assistantName = 'ИИ-ассистент',
}: {
  message: ConsultationMessage;
  assistantName?: string;
}) {
  return (
    <article className="chat-bubble chat-bubble-assistant" aria-label="Сообщение ассистента">
      <header>
        <Bot size={14} aria-hidden="true" />
        <span>{assistantName}</span>
      </header>
      <p className="chat-bubble-text">{message.content}</p>
    </article>
  );
}
