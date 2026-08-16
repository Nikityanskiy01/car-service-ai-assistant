import { createPortal } from 'react-dom';
import { Toaster as Sonner, type ToasterProps } from 'sonner';
import { useTheme } from '@/theme/ThemeProvider';

const MOBILE_BOTTOM_OFFSET = 'calc(5.25rem + env(safe-area-inset-bottom, 0px))';

function Toaster(props: ToasterProps) {
  const { mode } = useTheme();
  const toaster = (
    <Sonner
      {...props}
      theme={mode}
      className="console-toaster"
      position="bottom-right"
      dir="ltr"
      closeButton={false}
      offset={{ bottom: 24, right: 24, left: 24, top: 24 }}
      mobileOffset={{ bottom: MOBILE_BOTTOM_OFFSET, right: 16, left: 16, top: 16 }}
      gap={10}
      visibleToasts={3}
      containerAriaLabel="Уведомления"
      style={{ listStyle: 'none', padding: 0, margin: 0 }}
      toastOptions={{
        unstyled: true,
        duration: 4000,
      }}
    />
  );

  if (typeof document === 'undefined') return toaster;
  return createPortal(toaster, document.body);
}

export { Toaster };
