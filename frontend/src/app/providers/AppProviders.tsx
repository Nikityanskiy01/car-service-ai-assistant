import { AuthProvider } from '../../auth/AuthProvider';
import { ProductConfigProvider } from '../../config/ProductConfigProvider';
import { ToastProvider } from '../../components/ui/ToastProvider';
import { AppRuntimeProvider } from './AppRuntimeProvider';
import { ThemeProvider } from '../../theme/ThemeProvider';

export function AppProviders({ children }: { children: React.ReactNode }) {
  return (
    <ProductConfigProvider>
      <ThemeProvider>
        <AppRuntimeProvider>
          <AuthProvider>
            <ToastProvider>{children}</ToastProvider>
          </AuthProvider>
        </AppRuntimeProvider>
      </ThemeProvider>
    </ProductConfigProvider>
  );
}
