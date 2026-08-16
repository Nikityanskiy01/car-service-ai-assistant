import { toast as sonnerToast } from 'sonner';
import { ConsoleToastCard, type ConsoleToastType } from '../components/console/ConsoleToastCard';

type ToastOpts = {
  description?: string;
  duration?: number;
  id?: string | number;
};

function show(type: ConsoleToastType, title: string, opts?: ToastOpts) {
  return sonnerToast.custom(
    (id) => (
      <ConsoleToastCard
        type={type}
        title={title}
        description={opts?.description}
        onClose={() => sonnerToast.dismiss(id)}
      />
    ),
    { duration: opts?.duration ?? 4000, id: opts?.id },
  );
}

export const toast = {
  success: (title: string, opts?: ToastOpts) => show('success', title, opts),
  error: (title: string, opts?: ToastOpts) => show('error', title, opts),
  info: (title: string, opts?: ToastOpts) => show('info', title, opts),
  warning: (title: string, opts?: ToastOpts) => show('warning', title, opts),
  dismiss: sonnerToast.dismiss,
};
