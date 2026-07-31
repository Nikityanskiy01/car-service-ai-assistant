import {
  CalendarCheck2,
  CalendarClock,
  CalendarX2,
  CarFront,
  CircleCheck,
  CircleHelp,
  CircleOff,
  CircleX,
  ClipboardList,
  Hourglass,
  Sparkles,
  Wrench,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Modal } from '../ui/Modal';
import {
  CLIENT_BOOKING_STATUS_LEGEND,
  CLIENT_REQUEST_STATUS_LEGEND,
  CLIENT_STATUS_HELP_BUTTON,
  CLIENT_STATUS_HELP_INTRO,
  CLIENT_STATUS_HELP_TITLE,
  type ClientStatusLegendItem,
  type ClientStatusTone,
} from '../../lib/clientStatusLegend';

const STATUS_HELP_TABS = [
  { id: 'requests', label: 'Обращения', icon: ClipboardList },
  { id: 'bookings', label: 'Визиты', icon: CalendarCheck2 },
] as const;

const TONE_ICONS: Record<ClientStatusTone, LucideIcon> = {
  new: Sparkles,
  active: Wrench,
  scheduled: CalendarClock,
  done: CircleCheck,
  muted: CircleOff,
  waiting: Hourglass,
  confirmed: CalendarCheck2,
  arrived: CarFront,
  missed: CalendarX2,
  cancelled: CircleX,
};

function StatusHelpList({ items }: { items: ClientStatusLegendItem[] }) {
  return (
    <ul className="client-status-help-list">
      {items.map((item) => {
        const Icon = TONE_ICONS[item.tone];
        return (
          <li key={item.status} className={`client-status-help-item is-tone-${item.tone}`}>
            <span className="client-status-help-icon" aria-hidden>
              <Icon size={17} strokeWidth={2.2} />
            </span>
            <div className="client-status-help-body">
              <span className={`client-status-badge is-tone-${item.tone}`}>{item.label}</span>
              <p>{item.description}</p>
            </div>
          </li>
        );
      })}
    </ul>
  );
}

export function ClientStatusHelpModal({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const [tab, setTab] = useState<(typeof STATUS_HELP_TABS)[number]['id']>('requests');
  const items = tab === 'requests' ? CLIENT_REQUEST_STATUS_LEGEND : CLIENT_BOOKING_STATUS_LEGEND;
  const intro =
    tab === 'requests' ? CLIENT_STATUS_HELP_INTRO.requests : CLIENT_STATUS_HELP_INTRO.bookings;

  useEffect(() => {
    if (open) setTab('requests');
  }, [open]);

  return (
    <Modal open={open} title={CLIENT_STATUS_HELP_TITLE} onClose={onClose} className="modal-status-help">
      <div className="client-status-help">
        <div className="client-status-help-segments" role="tablist" aria-label="Раздел справки">
          {STATUS_HELP_TABS.map((item) => {
            const selected = tab === item.id;
            const TabIcon = item.icon;
            return (
              <button
                key={item.id}
                type="button"
                role="tab"
                id={`tab-${item.id}`}
                aria-selected={selected}
                aria-controls={`tabpanel-${item.id}`}
                className={`client-status-help-segment${selected ? ' is-active' : ''}`}
                onClick={() => setTab(item.id)}
              >
                <TabIcon size={16} aria-hidden />
                {item.label}
              </button>
            );
          })}
        </div>

        <p className="client-status-help-lead">{intro}</p>

        <div
          className="client-status-help-panel"
          role="tabpanel"
          id={`tabpanel-${tab}`}
          aria-labelledby={`tab-${tab}`}
        >
          <StatusHelpList items={items} />
        </div>
      </div>
    </Modal>
  );
}

export function ClientStatusHelpButton({ className = '' }: { className?: string }) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        type="button"
        className={`client-status-help-trigger ${className}`.trim()}
        onClick={() => setOpen(true)}
        aria-haspopup="dialog"
        aria-label={CLIENT_STATUS_HELP_TITLE}
      >
        <span className="client-status-help-trigger-icon" aria-hidden>
          <CircleHelp size={15} strokeWidth={2.2} />
        </span>
        {CLIENT_STATUS_HELP_BUTTON}
      </button>
      <ClientStatusHelpModal open={open} onClose={() => setOpen(false)} />
    </>
  );
}
