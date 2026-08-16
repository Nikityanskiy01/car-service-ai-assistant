import { useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowUpRight, Copy, MessagesSquare, MoreHorizontal, Phone } from 'lucide-react';
import { toast } from '../../lib/toast';
import { copyText } from '../../lib/clipboard';
import { CONTACT_SOURCE_LABELS, CONTACT_STATUS_LABELS } from '../../lib/labels';
import { formatRelativeTime } from '../../lib/managerRequestHelpers';
import { digitsOnly, formatPhoneDisplay } from '../../lib/phone';
import type { ContactSubmission } from '../../types/dashboard';
import { Button } from '../console/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '../console/ui/dropdown-menu';

type ContactInboxItemProps = {
  item: ContactSubmission;
  busy: boolean;
  showStatus: boolean;
  requestHref: string | null;
  onTake: () => void;
  onConvert: () => void;
  onClose: () => void;
  onConsult: () => void;
};

function telHref(phone: string) {
  const digits = digitsOnly(phone);
  return digits ? `tel:+${digits}` : undefined;
}

function statusClass(status: string) {
  if (status === 'IN_PROGRESS') return 'is-progress';
  if (status === 'CONVERTED') return 'is-converted';
  if (status === 'CLOSED') return 'is-closed';
  return 'is-new';
}

export function ContactInboxItem({
  item,
  busy,
  showStatus,
  requestHref,
  onTake,
  onConvert,
  onClose,
  onConsult,
}: ContactInboxItemProps) {
  const status = item.status || 'NEW';
  const open = status !== 'CONVERTED' && status !== 'CLOSED';
  const message = item.message?.trim() || '';
  const longMessage = message.length > 140;
  const [expanded, setExpanded] = useState(false);
  const phoneLabel = formatPhoneDisplay(item.phone);
  const callHref = telHref(item.phone);
  const sourceLabel = item.source ? CONTACT_SOURCE_LABELS[item.source] || item.source : null;

  async function copyPhone() {
    const ok = await copyText(item.phone);
    if (ok) toast.success('Телефон скопирован');
    else toast.error('Не удалось скопировать номер');
  }

  return (
    <article className={`contacts-item ${statusClass(status)}${busy ? ' is-busy' : ''}`} aria-busy={busy}>
      <header className="contacts-item-head">
        <div className="contacts-item-who">
          <strong className="contacts-item-name">{item.fullName}</strong>
          {showStatus ? (
            <span className={`contacts-item-status ${statusClass(status)}`}>{CONTACT_STATUS_LABELS[status]}</span>
          ) : null}
        </div>
        <div className="contacts-item-meta">
          {item.createdAt ? (
            <time className="tnum" dateTime={item.createdAt} title={new Date(item.createdAt).toLocaleString('ru-RU')}>
              {formatRelativeTime(item.createdAt)}
            </time>
          ) : null}
          {sourceLabel ? <span>{sourceLabel}</span> : null}
        </div>
      </header>

      <div className="contacts-item-call">
        {callHref ? (
          <Button asChild variant="secondary" className="contacts-call">
            <a href={callHref}>
              Позвонить
              <span className="contacts-call-mark" aria-hidden="true">
                <Phone />
              </span>
            </a>
          </Button>
        ) : null}
        <span className="contacts-item-number tnum">{phoneLabel}</span>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="contacts-icon-btn"
          aria-label="Скопировать номер"
          onClick={() => void copyPhone()}
        >
          <Copy />
        </Button>
      </div>

      {longMessage ? (
        <button
          type="button"
          className={`contacts-item-quote${expanded ? ' is-open' : ''}`}
          onClick={() => setExpanded((value) => !value)}
          aria-expanded={expanded}
          aria-label={expanded ? 'Свернуть текст' : 'Показать весь текст'}
        >
          {message}
        </button>
      ) : (
        <p className="contacts-item-quote">{message || 'Без текста'}</p>
      )}

      <div className="contacts-item-dock">
        {requestHref ? (
          <Button asChild size="sm" className="contacts-go">
            <Link to={requestHref}>
              Открыть заявку
              <span className="contacts-go-mark" aria-hidden="true">
                <ArrowUpRight />
              </span>
            </Link>
          </Button>
        ) : null}

        {open ? (
          <>
            {status === 'NEW' ? (
              <Button type="button" variant="outline" size="sm" disabled={busy} onClick={onTake}>
                В работу
              </Button>
            ) : (
              <span className="contacts-item-held">В работе</span>
            )}
            <Button type="button" size="sm" className="contacts-go" disabled={busy} onClick={onConvert}>
              Создать заявку
              <span className="contacts-go-mark" aria-hidden="true">
                <ArrowUpRight />
              </span>
            </Button>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button type="button" variant="ghost" size="icon" className="contacts-icon-btn" aria-label="Ещё действия" disabled={busy}>
                  <MoreHorizontal />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem
                  onSelect={() => {
                    onConsult();
                  }}
                >
                  <MessagesSquare />
                  ИИ-диагностика
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem variant="destructive" onSelect={onClose}>
                  Закрыть без заявки
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </>
        ) : null}

        {status === 'CLOSED' && !requestHref ? <span className="contacts-item-held">Закрыто без заявки</span> : null}
      </div>
    </article>
  );
}
