import { CalendarPlus, Mail, Phone, Send } from 'lucide-react';
import { Link } from 'react-router-dom';
import { formatRequestNumber } from '../../lib/labels';
import {
  activeRequestsOf,
  formatDay,
  formatLtv,
  preferredContactLabel,
  statusLabel,
  statusVariant,
  telHref,
  telegramHref,
  upcomingBookingsOf,
  vehicleTitle,
  type ClientDossierView,
} from '../../lib/managerClientDossier';
import { formatPhoneDisplay } from '../../lib/phone';
import { Alert, AlertDescription, AlertTitle } from '../console/ui/alert';
import { Badge } from '../console/ui/badge';
import { Button } from '../console/ui/button';
import { ClientDossierFeed } from './ClientDossierFeed';
import { ClientDossierGarage } from './ClientDossierGarage';

export type ClientDossierTab = 'history' | 'bookings' | 'consultations' | 'book' | 'timeline';

type ClientDossierPanelProps = {
  view: ClientDossierView | null;
  loading: boolean;
  error: string | null;
  tab: ClientDossierTab;
  requestBasePath: string;
  onTab: (tab: ClientDossierTab) => void;
  onBack: () => void;
  onCopyPhone: (phone: string) => void;
  onBook: () => void;
};

export function ClientDossierPanel({
  view,
  loading,
  error,
  tab,
  requestBasePath,
  onTab,
  onBack,
  onCopyPhone,
  onBook,
}: ClientDossierPanelProps) {
  if (loading) {
    return (
      <div className="manager-dossier" aria-busy="true">
        <button type="button" className="manager-dossier-back" onClick={onBack}>
          К списку
        </button>
        <div className="manager-clients-skel" />
        <div className="manager-clients-skel" />
        <div className="manager-clients-skel" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="manager-dossier">
        <button type="button" className="manager-dossier-back" onClick={onBack}>
          К списку
        </button>
        <Alert variant="destructive">
          <AlertTitle>Не удалось открыть карточку</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      </div>
    );
  }

  if (!view) {
    return (
      <div className="manager-dossier is-empty">
        <p className="manager-dossier-empty-kicker">Досье</p>
        <strong>Клиент не выбран</strong>
        <p>Слева видно, кто в работе и на чём ездит. Здесь откроются гараж, VIN и история.</p>
      </div>
    );
  }

  const callLink = view.phone ? telHref(view.phone) : undefined;
  const since = formatDay(view.createdAt);
  const preferred = preferredContactLabel(view.preferredContact);
  const active = activeRequestsOf(view);
  const upcoming = upcomingBookingsOf(view);
  const nextVisit = view.metrics?.nextBookingAt || upcoming[0]?.preferredAt || null;
  const ltv = formatLtv(view.metrics?.ltvMinor);
  const facts = [
    view.phone ? { kicker: 'Телефон', value: formatPhoneDisplay(view.phone), copy: true } : { kicker: 'Телефон', value: 'не указан' },
    view.city ? { kicker: 'Город', value: view.city } : null,
    preferred ? { kicker: 'Пишет', value: preferred } : null,
    since ? { kicker: 'С нами', value: since } : null,
  ].filter(Boolean) as Array<{ kicker: string; value: string; copy?: boolean }>;

  return (
    <div className="manager-dossier">
      <button type="button" className="manager-dossier-back" onClick={onBack}>
        К списку
      </button>

      <header className="manager-dossier-head">
        <div className="manager-dossier-mast">
          <p className="manager-dossier-kicker">{view.isGuest ? 'Гость' : 'Клиент'}</p>
          <h2>{view.name}</h2>
          <ul className="manager-dossier-facts">
            {facts.map((fact) => (
              <li key={fact.kicker}>
                <span>{fact.kicker}</span>
                {fact.copy && view.phone ? (
                  <button type="button" className="manager-dossier-copy" onClick={() => void onCopyPhone(view.phone)}>
                    {fact.value}
                  </button>
                ) : (
                  fact.value
                )}
              </li>
            ))}
          </ul>
        </div>

        <div className="manager-dossier-dock">
          {callLink ? (
            <span className="request-call-group">
              <Button asChild className="request-call no-underline">
                <a href={callLink}>
                  Позвонить
                  <span className="request-call-mark" aria-hidden="true">
                    <Phone />
                  </span>
                </a>
              </Button>
            </span>
          ) : null}
          {view.telegram ? (
            <Button asChild variant="outline" size="sm">
              <a href={telegramHref(view.telegram)} target="_blank" rel="noreferrer">
                <Send />
                Telegram
              </a>
            </Button>
          ) : null}
          {view.email ? (
            <Button asChild variant="outline" size="sm">
              <a href={`mailto:${view.email}`}>
                <Mail />
                Почта
              </a>
            </Button>
          ) : view.phone ? (
            <Button asChild variant="outline" size="sm">
              <a href={`sms:${view.phone}`}>
                <Send />
                SMS
              </a>
            </Button>
          ) : null}
          <Button type="button" variant="outline" size="sm" onClick={onBook}>
            <CalendarPlus />
            Запись
          </Button>
        </div>
      </header>

      {view.metrics ? (
        <dl className="manager-dossier-kpis">
          <div>
            <dt>В работе</dt>
            <dd className={active.length ? 'is-hot' : undefined}>{active.length}</dd>
          </div>
          <div>
            <dt>Заявок</dt>
            <dd>{view.metrics.requestsTotal}</dd>
          </div>
          <div>
            <dt>LTV</dt>
            <dd>{ltv || '—'}</dd>
          </div>
          <div>
            <dt>Авто</dt>
            <dd>{view.metrics.vehiclesCount ?? view.vehicles.length}</dd>
          </div>
          <div>
            <dt>Запись</dt>
            <dd>{nextVisit ? formatDay(nextVisit) : 'нет'}</dd>
          </div>
        </dl>
      ) : null}

      {active.length || upcoming.length ? (
        <section className="manager-dossier-now" aria-labelledby="manager-dossier-now">
          <h3 id="manager-dossier-now">Сейчас в работе</h3>
          <div className="manager-dossier-feed">
            {active.map((request) => (
              <Link key={request.id} to={`${requestBasePath}/${request.id}`} className="manager-dossier-feed-item">
                <time>{formatDay(request.createdAt)}</time>
                <span>
                  №{formatRequestNumber(request.id)}
                  {request.snapshotSymptoms ? ` · ${request.snapshotSymptoms}` : ''}
                  {request.snapshotMake || request.snapshotModel
                    ? ` · ${vehicleTitle({ make: request.snapshotMake, model: request.snapshotModel })}`
                    : ''}
                </span>
                <Badge variant={statusVariant(request.status)}>{statusLabel(request.status)}</Badge>
              </Link>
            ))}
            {upcoming.map((booking) => (
              <div key={booking.id} className="manager-dossier-feed-item">
                <time>{formatDay(booking.preferredAt)}</time>
                <span>Запись {booking.vehicle ? vehicleTitle(booking.vehicle) : ''}</span>
                <Badge variant={statusVariant(booking.status)}>{statusLabel(booking.status)}</Badge>
              </div>
            ))}
          </div>
        </section>
      ) : null}

      <ClientDossierGarage vehicles={view.vehicles} isGuest={view.isGuest} />

      <ClientDossierFeed view={view} tab={tab} onTab={onTab} requestBasePath={requestBasePath} />
    </div>
  );
}
