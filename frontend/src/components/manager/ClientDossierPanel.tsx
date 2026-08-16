import { CalendarPlus, Mail, Phone, Send } from 'lucide-react';
import { formatRequestNumber } from '../../lib/labels';
import {
  activeRequestsOf,
  formatDay,
  formatLtv,
  preferredContactLabel,
  telHref,
  telegramHref,
  upcomingBookingsOf,
  vehicleTitle,
  visitParts,
  type ClientDossierView,
} from '../../lib/managerClientDossier';
import { formatPhoneDisplay } from '../../lib/phone';
import { Alert, AlertDescription, AlertTitle } from '../console/ui/alert';
import { ClientDossierFeed } from './ClientDossierFeed';
import { ClientDossierGarage } from './ClientDossierGarage';
import { DossierFeedRow } from './DossierFeedRow';
import { HintLabel } from './help/HintLabel';

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

function writeChannel(view: ClientDossierView) {
  if (view.telegram) {
    return { href: telegramHref(view.telegram), icon: Send, external: true as const };
  }
  if (view.email) {
    return { href: `mailto:${view.email}`, icon: Mail, external: false as const };
  }
  if (view.phone) {
    return { href: `sms:${view.phone}`, icon: Send, external: false as const };
  }
  return null;
}

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
  const write = writeChannel(view);
  const since = formatDay(view.createdAt);
  const preferred = preferredContactLabel(view.preferredContact);
  const active = activeRequestsOf(view);
  const upcoming = upcomingBookingsOf(view);
  const nextVisit = view.metrics?.nextBookingAt || upcoming[0]?.preferredAt || null;
  const visit = visitParts(nextVisit);
  const bookFirst = !visit;
  const ltv = formatLtv(view.metrics?.ltvMinor);
  const cars = view.metrics?.vehiclesCount ?? view.vehicles.length;
  const WriteIcon = write?.icon;

  return (
    <div className="manager-dossier">
      <button type="button" className="manager-dossier-back" onClick={onBack}>
        К списку
      </button>

      <header className="manager-dossier-head">
        <div className="manager-dossier-head-top">
          <div className="manager-dossier-mast">
            <p className="manager-dossier-kicker">
              {view.isGuest ? (
                <HintLabel hint="Оставил заявку или форму, не регистрируясь на сайте">Без кабинета</HintLabel>
              ) : (
                'Клиент'
              )}
            </p>
            <h2>{view.name}</h2>
            <p className="manager-dossier-meta">
              {view.phone ? (
                <button type="button" className="manager-dossier-copy" onClick={() => void onCopyPhone(view.phone)}>
                  {formatPhoneDisplay(view.phone)}
                </button>
              ) : (
                <span>телефон не указан</span>
              )}
              {since ? <span>с {since}</span> : null}
              {view.city ? <span>{view.city}</span> : null}
              {preferred ? <span>{preferred}</span> : null}
            </p>
          </div>

          <p className={`manager-dossier-visit${visit ? '' : ' is-empty'}`}>
            <span>Следующий визит</span>
            {visit ? (
              <>
                <strong>{visit.day}</strong>
                <small>
                  {visit.weekday} {visit.time}
                </small>
              </>
            ) : (
              <strong>нет записи</strong>
            )}
          </p>
        </div>

        <div className="manager-dossier-actions">
          {callLink ? (
            <a href={callLink} className={`manager-dossier-action${bookFirst ? '' : ' is-primary'}`}>
              Позвонить
              <span className="request-call-mark" aria-hidden="true">
                <Phone />
              </span>
            </a>
          ) : null}
          {write && WriteIcon ? (
            <a
              href={write.href}
              className="manager-dossier-action"
              target={write.external ? '_blank' : undefined}
              rel={write.external ? 'noreferrer' : undefined}
            >
              Написать
              <span className="request-call-mark" aria-hidden="true">
                <WriteIcon />
              </span>
            </a>
          ) : null}
          <button
            type="button"
            className={`manager-dossier-action${bookFirst ? ' is-primary' : ''}`}
            onClick={onBook}
          >
            Записать
            <span className="request-call-mark" aria-hidden="true">
              <CalendarPlus />
            </span>
          </button>
        </div>
      </header>

      {view.metrics ? (
        <ul className="manager-dossier-pulse">
          <li className={active.length ? 'is-hot' : undefined}>
            <strong>{active.length}</strong> в работе
          </li>
          <li>
            <strong>{view.metrics.requestsTotal}</strong> заявок
          </li>
          {ltv ? (
            <li>
              <HintLabel hint="Сумма закрытых работ по этому клиенту">
                <strong>{ltv}</strong> выручка
              </HintLabel>
            </li>
          ) : null}
          <li>
            <strong>{cars}</strong> авто
          </li>
        </ul>
      ) : null}

      {active.length || upcoming.length ? (
        <section className="manager-dossier-now" aria-labelledby="manager-dossier-now">
          <h3 id="manager-dossier-now">Сейчас в работе</h3>
          <div className="manager-dossier-feed">
            {active.map((request) => {
              const car = vehicleTitle({ make: request.snapshotMake, model: request.snapshotModel });
              return (
                <DossierFeedRow
                  key={request.id}
                  href={`${requestBasePath}/${request.id}`}
                  when={formatDay(request.createdAt)}
                  title={`№${formatRequestNumber(request.id)}${car ? ` · ${car}` : ''}`}
                  detail={request.snapshotSymptoms}
                  owner={request.assignedManager?.fullName}
                  status={request.status}
                />
              );
            })}
            {upcoming.map((booking) => (
              <DossierFeedRow
                key={booking.id}
                when={formatDay(booking.preferredAt)}
                title="Запись"
                detail={booking.vehicle ? vehicleTitle(booking.vehicle) : booking.notes}
                status={booking.status}
              />
            ))}
          </div>
        </section>
      ) : null}

      <ClientDossierGarage vehicles={view.vehicles} isGuest={view.isGuest} />

      <ClientDossierFeed view={view} tab={tab} onTab={onTab} requestBasePath={requestBasePath} />
    </div>
  );
}
