import { Send } from 'lucide-react';
import { useCallback, useEffect, useRef } from 'react';
import { MessageAttachmentInput, type PendingAttachment } from '../requests/MessageAttachmentInput';

type Template = {
  id: string;
  label: string;
  body: string;
};

type Props = {
  value: string;
  onChange: (value: string) => void;
  onSubmit: () => void | Promise<void>;
  disabled?: boolean;
  sending?: boolean;
  placeholder?: string;
  attachments?: PendingAttachment[];
  onAttachmentsChange?: (files: PendingAttachment[]) => void;
  templates?: Template[];
  closedMessage?: string;
  error?: string | null;
};

export function FollowUpChatComposer({
  value,
  onChange,
  onSubmit,
  disabled = false,
  sending = false,
  placeholder = 'Сообщение...',
  attachments = [],
  onAttachmentsChange,
  templates,
  closedMessage,
  error,
}: Props) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const resizeTextarea = useCallback(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = `${Math.min(el.scrollHeight, 128)}px`;
  }, []);

  useEffect(() => {
    resizeTextarea();
  }, [value, resizeTextarea]);

  const canSend =
    Boolean(value.trim() || attachments.length) && !disabled && !sending && !closedMessage;

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (!canSend) return;
    await onSubmit();
    requestAnimationFrame(() => {
      const el = textareaRef.current;
      if (!el) return;
      el.style.height = 'auto';
      el.focus();
    });
  }

  function handleKeyDown(event: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (event.key !== 'Enter' || event.shiftKey || event.nativeEvent.isComposing) return;
    event.preventDefault();
    if (!canSend) return;
    void handleSubmit(event);
  }

  function applyTemplate(body: string) {
    onChange(body);
    requestAnimationFrame(() => {
      const el = textareaRef.current;
      if (!el) return;
      el.focus();
      const len = body.length;
      el.setSelectionRange(len, len);
    });
  }

  if (closedMessage) {
    return <p className="follow-up-chat-closed muted-text">{closedMessage}</p>;
  }

  return (
    <form className="chat-composer follow-up-chat-composer" onSubmit={(e) => void handleSubmit(e)}>
      {templates?.length ? (
        <div className="quick-replies follow-up-chat-templates" role="group" aria-label="Быстрые ответы">
          <div className="quick-replies-list">
            {templates.map((template) => (
              <button
                key={template.id}
                type="button"
                disabled={disabled || sending}
                onClick={() => applyTemplate(template.body)}
              >
                {template.label}
              </button>
            ))}
          </div>
        </div>
      ) : null}

      {onAttachmentsChange && attachments.length > 0 ? (
        <MessageAttachmentInput
          variant="preview"
          files={attachments}
          onChange={onAttachmentsChange}
          disabled={disabled || sending}
        />
      ) : null}

      <div className="chat-composer-bar">
        {onAttachmentsChange ? (
          <MessageAttachmentInput
            variant="icon"
            files={attachments}
            onChange={onAttachmentsChange}
            disabled={disabled || sending}
          />
        ) : null}
        <textarea
          ref={textareaRef}
          className="chat-composer-input"
          placeholder={placeholder}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onKeyDown={handleKeyDown}
          maxLength={4000}
          rows={1}
          aria-label={placeholder}
          disabled={disabled || sending}
        />
        <button
          type="submit"
          className="chat-composer-send"
          disabled={!canSend}
          aria-label={sending ? 'Отправка...' : 'Отправить'}
        >
          <Send size={16} aria-hidden />
        </button>
      </div>

      {error ? <p className="form-error">{error}</p> : null}
      <p className="chat-composer-hint">Enter — отправить, Shift+Enter — новая строка</p>
    </form>
  );
}
