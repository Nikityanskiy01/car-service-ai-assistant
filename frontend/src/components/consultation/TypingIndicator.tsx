export function TypingIndicator({ visible }: { visible: boolean }) {
  if (!visible) return null;
  return (
    <div className="typing-indicator" role="status" aria-live="polite">
      <span />
      <span />
      <span />
      <small>Ассистент формирует ответ…</small>
    </div>
  );
}
