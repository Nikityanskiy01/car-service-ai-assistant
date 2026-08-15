import { createContext, useContext } from 'react';

export type ToastTone = 'success' | 'error' | 'info';

export type ToastAction = {
  label: string;
  onClick: () => void;
};

export type ToastOptions = {
  tone?: ToastTone;
  description?: string;
  action?: ToastAction;
  /** Milliseconds before auto dismiss. Pass 0 to keep the toast until dismissed. */
  duration?: number;
};

export type ToastApi = {
  toast: (message: string, options?: ToastOptions) => string;
  success: (message: string, options?: Omit<ToastOptions, 'tone'>) => string;
  error: (message: string, options?: Omit<ToastOptions, 'tone'>) => string;
  dismiss: (id: string) => void;
};

const noop: ToastApi = {
  toast: () => '',
  success: () => '',
  error: () => '',
  dismiss: () => {},
};

export const ToastContext = createContext<ToastApi>(noop);

export function useToast() {
  return useContext(ToastContext);
}
