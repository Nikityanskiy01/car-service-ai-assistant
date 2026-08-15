import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AlertTriangle, CheckCircle2, Info, X } from 'lucide-react';
import {
  ToastContext,
  type ToastApi,
  type ToastOptions,
  type ToastTone,
} from './toastContext';

type ToastRecord = {
  id: string;
  message: string;
  description?: string;
  tone: ToastTone;
  action?: { label: string; onClick: () => void };
  duration: number;
};

const TONE_ICONS = {
  success: CheckCircle2,
  error: AlertTriangle,
  info: Info,
} as const;

const DEFAULT_DURATION = 4200;
const MAX_VISIBLE = 4;

/**
 * Timers keep running while the tab is hidden by default, so a manager who
 * switches to a phone call comes back to an empty stack. Pausing keeps the
 * confirmation visible until they actually look at it.
 */
function useDocumentVisible() {
  const [visible, setVisible] = useState(() =>
    typeof document === 'undefined' ? true : document.visibilityState === 'visible',
  );
  useEffect(() => {
    function onChange() {
      setVisible(document.visibilityState === 'visible');
    }
    document.addEventListener('visibilitychange', onChange);
    return () => document.removeEventListener('visibilitychange', onChange);
  }, []);
  return visible;
}

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<ToastRecord[]>([]);
  const [paused, setPaused] = useState(false);
  const counter = useRef(0);
  const documentVisible = useDocumentVisible();

  const dismiss = useCallback((id: string) => {
    setToasts((prev) => prev.filter((item) => item.id !== id));
  }, []);

  const push = useCallback((message: string, options?: ToastOptions) => {
    counter.current += 1;
    const id = `toast-${counter.current}`;
    const record: ToastRecord = {
      id,
      message,
      description: options?.description,
      tone: options?.tone ?? 'info',
      action: options?.action,
      duration: options?.duration ?? DEFAULT_DURATION,
    };
    setToasts((prev) => [...prev.slice(-(MAX_VISIBLE - 1)), record]);
    return id;
  }, []);

  const api = useMemo<ToastApi>(
    () => ({
      toast: push,
      success: (message, options) => push(message, { ...options, tone: 'success' }),
      error: (message, options) => push(message, { ...options, tone: 'error', duration: options?.duration ?? 6000 }),
      dismiss,
    }),
    [push, dismiss],
  );

  const frozen = paused || !documentVisible;

  useEffect(() => {
    if (frozen || !toasts.length) return;
    const timers = toasts
      .filter((item) => item.duration > 0)
      .map((item) => window.setTimeout(() => dismiss(item.id), item.duration));
    return () => timers.forEach((timer) => window.clearTimeout(timer));
  }, [toasts, frozen, dismiss]);

  return (
    <ToastContext.Provider value={api}>
      {children}
      {toasts.length ? (
        <div
          className="toast-viewport"
          role="region"
          aria-label="Уведомления"
          onMouseEnter={() => setPaused(true)}
          onMouseLeave={() => setPaused(false)}
          onFocus={() => setPaused(true)}
          onBlur={() => setPaused(false)}
        >
          {toasts.map((item) => {
            const Icon = TONE_ICONS[item.tone];
            return (
              <output
                key={item.id}
                className={`toast-item toast-${item.tone}`}
                aria-live={item.tone === 'error' ? 'assertive' : 'polite'}
              >
                <Icon size={16} className="toast-item-icon" aria-hidden />
                <div className="toast-item-body">
                  <strong>{item.message}</strong>
                  {item.description ? <span>{item.description}</span> : null}
                </div>
                {item.action ? (
                  <button
                    type="button"
                    className="toast-item-action"
                    onClick={() => {
                      item.action?.onClick();
                      dismiss(item.id);
                    }}
                  >
                    {item.action.label}
                  </button>
                ) : null}
                <button
                  type="button"
                  className="toast-item-close"
                  onClick={() => dismiss(item.id)}
                  aria-label="Закрыть уведомление"
                >
                  <X size={14} aria-hidden />
                </button>
              </output>
            );
          })}
        </div>
      ) : null}
    </ToastContext.Provider>
  );
}
