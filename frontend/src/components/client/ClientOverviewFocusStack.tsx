import {
  ArrowRight,
  CalendarDays,
  Car,
  ChevronRight,
  MessageSquare,
  Sparkles,
  Wrench,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';
import type { OverviewFocusItem } from '../../features/client-cases/resolveClientOverviewFocus';
import { STORAGE_KEYS } from '../../lib/storageKeys';

const FOCUS_ICONS: Record<OverviewFocusItem['kind'], LucideIcon> = {
  draft: MessageSquare,
  unread: MessageSquare,
  booking: CalendarDays,
  'new-request': Wrench,
  active: Car,
  idle: Sparkles,
};

function navigateToFocus(
  navigate: ReturnType<typeof useNavigate>,
  item: OverviewFocusItem,
) {
  if (item.ctaSessionId) {
    sessionStorage.setItem(STORAGE_KEYS.consultSessionId, item.ctaSessionId);
  }
  navigate(item.ctaTo);
}

function FocusPrimary({
  item,
  onAction,
}: {
  item: OverviewFocusItem;
  onAction: () => void;
}) {
  const Icon = FOCUS_ICONS[item.kind];

  return (
    <article className={`client-overview-focus-primary is-accent-${item.accent}`}>
      <div className="client-overview-focus-primary-inner">
        <div className="client-overview-focus-primary-head">
          <span className="client-overview-focus-primary-icon" aria-hidden>
            <Icon size={22} strokeWidth={2.1} />
          </span>
          <div className="client-overview-focus-primary-body">
            <span className="client-overview-focus-kicker">Сейчас важно</span>
            <h2>{item.title}</h2>
            <p>{item.description}</p>
          </div>
        </div>
        <div className="client-overview-focus-primary-actions">
          <button type="button" className="client-overview-focus-cta" onClick={onAction}>
            {item.ctaLabel}
            <ArrowRight size={15} aria-hidden />
          </button>
          {item.secondaryLabel && item.secondaryTo ? (
            <Link className="client-overview-focus-secondary-link" to={item.secondaryTo}>
              {item.secondaryLabel}
            </Link>
          ) : null}
        </div>
      </div>
    </article>
  );
}

function FocusSecondaryItem({
  item,
  onAction,
}: {
  item: OverviewFocusItem;
  onAction: () => void;
}) {
  const Icon = FOCUS_ICONS[item.kind];

  return (
    <li>
      <button
        type="button"
        className={`client-overview-focus-secondary-item is-accent-${item.accent}`}
        onClick={onAction}
      >
        <span className="client-overview-focus-secondary-icon" aria-hidden>
          <Icon size={16} strokeWidth={2.1} />
        </span>
        <span className="client-overview-focus-secondary-copy">
          <strong>{item.title}</strong>
          <span>{item.description}</span>
        </span>
        <ChevronRight size={16} className="client-overview-focus-secondary-chevron" aria-hidden />
      </button>
    </li>
  );
}

export function ClientOverviewFocusStack({
  primary,
  secondary,
}: {
  primary: OverviewFocusItem;
  secondary: OverviewFocusItem[];
}) {
  const navigate = useNavigate();

  return (
    <section className="client-overview-focus-stack" aria-label="Важное сейчас">
      <FocusPrimary item={primary} onAction={() => navigateToFocus(navigate, primary)} />
      {secondary.length > 0 ? (
        <ul className="client-overview-focus-secondary">
          {secondary.map((item) => (
            <FocusSecondaryItem
              key={item.id}
              item={item}
              onAction={() => navigateToFocus(navigate, item)}
            />
          ))}
        </ul>
      ) : null}
    </section>
  );
}
