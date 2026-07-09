import { Moon, Sun } from 'lucide-react';
import { useTheme } from '../../theme/ThemeProvider';

export function ThemeToggle() {
  const { mode, toggleMode } = useTheme();
  return (
    <button
      type="button"
      className="theme-toggle"
      onClick={toggleMode}
      aria-label={mode === 'dark' ? 'Переключить на светлую тему' : 'Переключить на тёмную тему'}
      title={mode === 'dark' ? 'Светлая тема' : 'Тёмная тема'}
    >
      {mode === 'dark' ? <Sun size={16} /> : <Moon size={16} />}
    </button>
  );
}
