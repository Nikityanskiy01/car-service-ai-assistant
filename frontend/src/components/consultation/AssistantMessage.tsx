import { Bot } from 'lucide-react';
import type { ConsultationMessage } from '../../types/consultation';

export function AssistantMessage({ message }: { message: ConsultationMessage }) {
  return (
    <article className="chat-bubble chat-bubble-assistant" aria-label="Сообщение ассистента">
      <header>
        <Bot size={14} />
        <span>ИИ-ассистент</span>
      </header>
      <p>{message.content}</p>
    </article>
  );
}
