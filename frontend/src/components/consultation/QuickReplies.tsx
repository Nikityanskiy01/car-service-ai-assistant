const DEFAULT_REPLIES = [
  'Появился посторонний стук при проезде неровностей',
  'Затруднённый запуск холодного двигателя',
  'Вибрация при торможении на скорости',
  'Нестабильные обороты на холостом ходу',
];

export function QuickReplies({
  replies = DEFAULT_REPLIES,
  onSelect,
  disabled = false,
}: {
  replies?: string[];
  onSelect: (text: string) => void;
  disabled?: boolean;
}) {
  return (
    <div className="quick-replies" role="group" aria-label="Примеры симптомов">
      <p className="quick-replies-label">Популярные запросы</p>
      <div className="quick-replies-list">
        {replies.map((reply) => (
          <button key={reply} type="button" disabled={disabled} onClick={() => onSelect(reply)}>
            {reply}
          </button>
        ))}
      </div>
    </div>
  );
}
