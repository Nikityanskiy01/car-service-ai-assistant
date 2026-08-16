import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AuthProvider } from '../../auth/AuthProvider';
import { ProductConfigProvider } from '../../config/ProductConfigProvider';
import { ToastProvider } from '../../components/ui/ToastProvider';
import { AppRuntimeProvider } from './AppRuntimeProvider';
import { ThemeProvider } from '../../theme/ThemeProvider';
import { I18nProvider } from '../../i18n/I18nProvider';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: { staleTime: 30_000, retry: 1, refetchOnWindowFocus: false },
  },
});

export function AppProviders({ children }: { children: React.ReactNode }) {
  return (
    <I18nProvider>
      <QueryClientProvider client={queryClient}>
        <ProductConfigProvider>
          <ThemeProvider>
            <AppRuntimeProvider>
              <AuthProvider>
                <ToastProvider>{children}</ToastProvider>
              </AuthProvider>
            </AppRuntimeProvider>
          </ThemeProvider>
        </ProductConfigProvider>
      </QueryClientProvider>
    </I18nProvider>
  );
}
