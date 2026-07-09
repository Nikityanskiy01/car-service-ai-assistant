import { FlaskConical } from 'lucide-react';

export function DemoModeBanner({ enabled }: { enabled: boolean }) {
  if (!enabled) return null;
  return (
    <div className="demo-banner" role="status" aria-live="polite">
      <FlaskConical size={16} />
      <span>Демонстрационная версия: часть операций может быть ограничена.</span>
    </div>
  );
}
