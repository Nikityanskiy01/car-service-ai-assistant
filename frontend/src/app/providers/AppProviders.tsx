import { AuthProvider } from '../../auth/AuthProvider';
import { AppRuntimeProvider } from './AppRuntimeProvider';
import { ThemeProvider } from '../../theme/ThemeProvider';

export function AppProviders({ children }: { children: React.ReactNode }) {
  return (
    <ThemeProvider>
      <AppRuntimeProvider>
        <AuthProvider>{children}</AuthProvider>
      </AppRuntimeProvider>
    </ThemeProvider>
  );
}
