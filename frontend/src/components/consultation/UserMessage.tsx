import { UserRound } from 'lucide-react';
import type { ConsultationMessage } from '../../types/consultation';

export function UserMessage({ message }: { message: ConsultationMessage }) {
  return (
    <article className="chat-bubble chat-bubble-user" aria-label="Сообщение пользователя">
      <header>
        <UserRound size={14} />
        <span>Клиент</span>
      </header>
      <p>{message.content}</p>
    </article>
  );
}
