import { Toaster as Sonner, type ToasterProps } from 'sonner';
import { useTheme } from '@/theme/ThemeProvider';

function Toaster(props: ToasterProps) {
  const { mode } = useTheme();
  return (
    <Sonner
      theme={mode}
      className="toaster group"
      position="bottom-right"
      closeButton
      toastOptions={{
        classNames: {
          toast: 'border-border bg-card text-card-foreground font-[family-name:var(--font-body)]',
        },
      }}
      {...props}
    />
  );
}

export { Toaster };
