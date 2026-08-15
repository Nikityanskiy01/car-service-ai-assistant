import {
  ArrowRight,
  CalendarDays,
  Car,
  ChevronDown,
  ChevronRight,
  MessageSquare,
  Sparkles,
  Wrench,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { useId, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import type { OverviewFocusItem } from '../../features/client-cases/resolveClientOverviewFocus';
import { STORAGE_KEYS } from '../../lib/storageKeys';

const COLLAPSED_REPLY_COUNT = 3;

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
  return (
    <li className="client-overview-focus-secondary-row">
      <button
        type="button"
        className={`client-overview-focus-secondary-item is-accent-${item.accent}`}
        onClick={onAction}
      >
        <span className="client-overview-focus-secondary-copy">
          <strong>{compactReplyTitle(item.title)}</strong>
          <span>{item.description}</span>
        </span>
        <ChevronRight size={16} className="client-overview-focus-secondary-chevron" aria-hidden />
      </button>
    </li>
  );
}

function compactReplyTitle(title: string) {
  return title
    .replace(/^Ответ по\s+/i, '')
    .replace(/^\d+\s+новых?\s+сообщени[яй]\s+[—-]\s+/i, '');
}

function replyCountLabel(count: number) {
  const mod10 = count % 10;
  const mod100 = count % 100;
  if (mod10 === 1 && mod100 !== 11) return `${count} обращение`;
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) return `${count} обращения`;
  return `${count} обращений`;
}

function FocusSecondaryGroup({
  items,
  onAction,
}: {
  items: OverviewFocusItem[];
  onAction: (item: OverviewFocusItem) => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const listId = useId();
  const canExpand = items.length > COLLAPSED_REPLY_COUNT;
  const visibleItems = expanded ? items : items.slice(0, COLLAPSED_REPLY_COUNT);
  const hiddenCount = items.length - COLLAPSED_REPLY_COUNT;

  return (
    <section className="client-overview-focus-replies" aria-labelledby={`${listId}-title`}>
      <header className="client-overview-focus-replies-head">
        <span className="client-overview-focus-replies-icon" aria-hidden>
          <MessageSquare size={18} strokeWidth={2} />
        </span>
        <div className="client-overview-focus-replies-heading">
          <h3 id={`${listId}-title`}>Ответы сервиса</h3>
          <p>{replyCountLabel(items.length)} с новыми сообщениями</p>
        </div>
        <span className="client-overview-focus-replies-count" aria-label={replyCountLabel(items.length)}>
          {items.length}
        </span>
      </header>

      <ul className="client-overview-focus-secondary" id={listId}>
        {visibleItems.map((item) => (
          <FocusSecondaryItem key={item.id} item={item} onAction={() => onAction(item)} />
        ))}
      </ul>

      {canExpand ? (
        <button
          type="button"
          className="client-overview-focus-replies-toggle"
          aria-expanded={expanded}
          aria-controls={listId}
          onClick={() => setExpanded((value) => !value)}
        >
          {expanded ? 'Свернуть' : `Показать ещё ${hiddenCount}`}
          <ChevronDown size={15} aria-hidden />
        </button>
      ) : null}
    </section>
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
        <FocusSecondaryGroup items={secondary} onAction={(item) => navigateToFocus(navigate, item)} />
      ) : null}
    </section>
  );
}
