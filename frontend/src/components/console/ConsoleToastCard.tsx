import { Check, CircleAlert, Info, X } from 'lucide-react';

export type ConsoleToastType = 'success' | 'error' | 'info' | 'warning';

export function ConsoleToastCard({
  type,
  title,
  description,
  onClose,
}: {
  type: ConsoleToastType;
  title: string;
  description?: string;
  onClose: () => void;
}) {
  const Icon = type === 'error' || type === 'warning' ? CircleAlert : type === 'info' ? Info : Check;

  return (
    <div className="console-toast-card" data-type={type} role="status">
      <span className="console-toast-card-icon" aria-hidden>
        <Icon strokeWidth={2.25} />
      </span>
      <div className="console-toast-card-copy">
        <p className="console-toast-card-title">{title}</p>
        {description ? <p className="console-toast-card-desc">{description}</p> : null}
      </div>
      <button type="button" className="console-toast-card-close" aria-label="Закрыть уведомление" onClick={onClose}>
        <X strokeWidth={2.25} />
      </button>
    </div>
  );
}
