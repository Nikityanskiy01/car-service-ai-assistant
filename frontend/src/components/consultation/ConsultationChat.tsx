import type { ConsultationMessage } from '../../types/consultation';
import { AssistantMessage } from './AssistantMessage';
import { UserMessage } from './UserMessage';
import { TypingIndicator } from './TypingIndicator';

export function ConsultationChat({
  messages,
  isTyping,
}: {
  messages: ConsultationMessage[];
  isTyping: boolean;
}) {
  return (
    <section className="consultation-chat" aria-label="Диалог консультации">
      {messages.length === 0 ? (
        <div className="empty-chat-state">
          Опишите проблему автомобиля, и ассистент начнет уточнение симптомов.
        </div>
      ) : null}
      {messages.map((message) =>
        message.sender === 'ASSISTANT' || message.sender === 'SYSTEM' ? (
          <AssistantMessage key={message.id} message={message} />
        ) : (
          <UserMessage key={message.id} message={message} />
        ),
      )}
      <TypingIndicator visible={isTyping} />
    </section>
  );
}
