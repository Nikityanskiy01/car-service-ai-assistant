import type { LucideIcon } from 'lucide-react';
import type { ReactNode } from 'react';

export function DashboardWelcomeHero({
  greeting,
  title,
  description,
  icon: Icon,
  actions,
}: {
  greeting?: string;
  title: string;
  description?: string;
  icon?: LucideIcon;
  actions?: ReactNode;
}) {
  return (
    <section className="desk-welcome-hero" aria-label="Приветствие">
      <div className="desk-welcome-hero-body">
        {greeting ? <p className="desk-welcome-greeting">{greeting}</p> : null}
        <h1 className="desk-welcome-title">{title}</h1>
        {description ? <p className="desk-welcome-desc">{description}</p> : null}
      </div>
      {Icon ? (
        <div className="desk-welcome-icon" aria-hidden>
          <Icon size={28} />
        </div>
      ) : null}
      {actions ? <div className="desk-welcome-actions">{actions}</div> : null}
    </section>
  );
}
