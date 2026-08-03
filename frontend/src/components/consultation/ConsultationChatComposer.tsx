import { AlertTriangle, Send } from 'lucide-react';
import { useCallback, useEffect, useRef } from 'react';
import { PhotoAttachment } from './PhotoAttachment';

type ConsultationChatComposerProps = {
  message: string;
  onMessageChange: (value: string) => void;
  onSubmit: () => void | Promise<void>;
  disabled?: boolean;
  isSending?: boolean;
  sessionId: string;
  guestToken?: string | null;
  onPhotoAnalyzed: () => void;
  onPhotoError: (message: string) => void;
};

export function ConsultationChatComposer({
  message,
  onMessageChange,
  onSubmit,
  disabled,
  isSending,
  sessionId,
  guestToken,
  onPhotoAnalyzed,
  onPhotoError,
}: ConsultationChatComposerProps) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const resizeTextarea = useCallback(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = `${Math.min(el.scrollHeight, 128)}px`;
  }, []);

  useEffect(() => {
    resizeTextarea();
  }, [message, resizeTextarea]);

  const canSend = Boolean(message.trim()) && !disabled && !isSending;

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (!canSend) return;
    await onSubmit();
    requestAnimationFrame(() => {
      const el = textareaRef.current;
      if (!el) return;
      el.style.height = 'auto';
    });
  }

  function handleKeyDown(event: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (event.key !== 'Enter' || event.shiftKey || event.nativeEvent.isComposing) return;
    event.preventDefault();
    if (!canSend) return;
    void handleSubmit(event);
  }

  return (
    <form className="chat-composer" onSubmit={(e) => void handleSubmit(e)}>
      <div className="chat-composer-bar">
        <PhotoAttachment
          sessionId={sessionId}
          guestToken={guestToken}
          disabled={disabled || isSending}
          variant="icon"
          onAnalyzed={onPhotoAnalyzed}
          onError={onPhotoError}
        />
        <textarea
          ref={textareaRef}
          id="consultMessage"
          className="chat-composer-input"
          placeholder="Сообщение..."
          value={message}
          onChange={(e) => onMessageChange(e.target.value)}
          onKeyDown={handleKeyDown}
          maxLength={4000}
          rows={1}
          aria-label="Сообщение ассистенту"
          disabled={disabled || isSending}
        />
        <button
          type="submit"
          className="chat-composer-send"
          disabled={!canSend}
          aria-label={isSending ? 'Отправка...' : 'Отправить'}
        >
          <Send size={18} aria-hidden="true" />
        </button>
      </div>
      <p className="chat-composer-hint">
        Enter — отправить, Shift+Enter — новая строка. Фото дополняет диагноз, но не заменяет описание.
      </p>
      <p className="consult-disclaimer consult-disclaimer-inline" role="note">
        <AlertTriangle size={15} aria-hidden="true" />
        <span>
          Ответ ассистента носит информационный характер и не заменяет очную диагностику в сервисе.
        </span>
      </p>
    </form>
  );
}
