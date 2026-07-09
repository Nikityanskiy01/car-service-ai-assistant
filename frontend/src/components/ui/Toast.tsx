import { useEffect } from 'react';

export function Toast({
  message,
  open,
  onClose,
}: {
  message: string;
  open: boolean;
  onClose: () => void;
}) {
  useEffect(() => {
    if (!open) return;
    const timer = setTimeout(onClose, 3500);
    return () => clearTimeout(timer);
  }, [open, onClose]);

  if (!open) return null;
  return (
    <div className="toast" role="status" aria-live="polite">
      {message}
    </div>
  );
}
