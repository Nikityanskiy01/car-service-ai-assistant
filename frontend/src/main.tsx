import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
// Cyrillic weights for UI; latin-400 covers numbers/emails without 4 extra latin files.
import '@fontsource/manrope/cyrillic-400.css';
import '@fontsource/manrope/cyrillic-500.css';
import '@fontsource/manrope/cyrillic-600.css';
import '@fontsource/manrope/cyrillic-700.css';
import '@fontsource/manrope/latin-400.css';
import { App } from './app/App';
import { AppErrorBoundary } from './app/AppErrorBoundary';
import { AppProviders } from './app/providers/AppProviders';
import './styles/main.css';
import './styles/site.css';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <AppErrorBoundary>
      <AppProviders>
        <App />
      </AppProviders>
    </AppErrorBoundary>
  </StrictMode>,
);
