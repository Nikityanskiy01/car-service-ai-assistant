export function Modal({
  open,
  title,
  onClose,
  children,
}: {
  open: boolean;
  title: string;
  onClose: () => void;
  children: React.ReactNode;
}) {
  if (!open) return null;
  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()} role="dialog" aria-modal="true" aria-label={title}>
        <header className="modal-header">
          <h3>{title}</h3>
          <button className="btn btn-ghost" onClick={onClose} type="button">
            Закрыть
          </button>
        </header>
        <div className="modal-content">{children}</div>
      </div>
    </div>
  );
}
