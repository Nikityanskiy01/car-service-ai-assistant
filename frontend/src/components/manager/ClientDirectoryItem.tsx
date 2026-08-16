import { Copy, Phone } from 'lucide-react';
import { toast } from 'sonner';
import { copyText } from '../../lib/clipboard';
import {
  clientInitials,
  formatDay,
  formatLtv,
  rosterVehicleSummary,
  telHref,
} from '../../lib/managerClientDossier';
import { formatRelativeTime } from '../../lib/managerRequestHelpers';
import { formatPhoneDisplay } from '../../lib/phone';
import type { ManagerClientRow } from '../../api/dashboard';
import { Button } from '../console/ui/button';

type ClientDirectoryItemProps = {
  client: ManagerClientRow;
  open: boolean;
  onOpen: () => void;
};

function displayName(client: ManagerClientRow) {
  if (!client.isGuest) return client.name;
  return client.name.replace(/^Гость\s+/i, '').trim() || client.name;
}

function activityCopy(client: ManagerClientRow) {
  if (client.activeRequests) return `${client.activeRequests} в работе`;
  if (client.nextBookingAt) return `запись ${formatDay(client.nextBookingAt)}`;
  if (client.totalRequests) return `${client.totalRequests} заявок`;
  return null;
}

export function ClientDirectoryItem({ client, open, onOpen }: ClientDirectoryItemProps) {
  const callHref = telHref(client.phone);
  const when = client.lastActivityAt ? formatRelativeTime(client.lastActivityAt) : null;
  const cars = rosterVehicleSummary(client);
  const activity = activityCopy(client);
  const ltv = formatLtv(client.ltvMinor);
  const name = displayName(client);

  async function copyPhone() {
    if (!client.phone) return;
    const ok = await copyText(client.phone);
    if (ok) toast.success('Телефон скопирован');
    else toast.error('Не удалось скопировать номер');
  }

  return (
    <article
      className={`manager-clients-row${client.activeRequests ? ' is-progress' : ''}${open ? ' is-open' : ''}`}
    >
      <button type="button" className="manager-clients-row-main" onClick={onOpen} aria-current={open ? 'true' : undefined}>
        <span className="manager-clients-mark" aria-hidden="true">
          {clientInitials(name)}
        </span>
        <span className="manager-clients-row-body">
          <span className="manager-clients-row-name">
            <strong>{name}</strong>
            {client.isGuest ? <span className="manager-clients-guest">гость</span> : null}
          </span>
          <span className="manager-clients-row-meta">
            <span className="manager-clients-row-phone">{formatPhoneDisplay(client.phone)}</span>
            {cars ? <span className="manager-clients-row-cars">{cars}</span> : null}
          </span>
          <span className="manager-clients-row-signals">
            {activity ? (
              <span className={`manager-clients-chip${client.activeRequests ? ' is-hot' : ''}`}>{activity}</span>
            ) : null}
            {ltv ? <span className="manager-clients-chip is-money">{ltv}</span> : null}
            {when ? (
              <time className="manager-clients-row-when" dateTime={client.lastActivityAt || undefined}>
                {when}
              </time>
            ) : null}
          </span>
        </span>
      </button>
      <div className="manager-clients-row-tools">
        {client.phone ? (
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="size-8"
            aria-label="Скопировать номер"
            onClick={() => void copyPhone()}
          >
            <Copy />
          </Button>
        ) : null}
        {callHref ? (
          <Button asChild size="icon" className="manager-clients-call size-8">
            <a href={callHref} aria-label="Позвонить">
              <Phone />
            </a>
          </Button>
        ) : null}
      </div>
    </article>
  );
}
