import { Link } from 'react-router-dom';
import { formatRequestNumber } from '../../lib/labels';
import { formatMileageKm } from '../../lib/managerRequestHelpers';
import {
  clientCurrency,
  formatDay,
  formatDayTime,
  statusLabel,
  statusVariant,
  vehicleLine,
  vehicleTitle,
  type ClientDossierView,
} from '../../lib/managerClientDossier';
import { Badge } from '../console/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../console/ui/tabs';

type ClientTab = 'history' | 'bookings' | 'consultations' | 'book' | 'timeline';

type ClientDossierFeedProps = {
  view: ClientDossierView;
  tab: ClientTab;
  onTab: (tab: ClientTab) => void;
  requestBasePath: string;
};

function requestTitle(item: ClientDossierView['requests'][number]) {
  const car = vehicleTitle({ make: item.snapshotMake, model: item.snapshotModel });
  const number = `№${formatRequestNumber(item.id)}`;
  if (car && item.snapshotSymptoms) return `${number} · ${car} · ${item.snapshotSymptoms}`;
  if (car) return `${number} · ${car}`;
  if (item.snapshotSymptoms) return `${number} · ${item.snapshotSymptoms}`;
  return number;
}

function bookingTitle(item: ClientDossierView['bookings'][number]) {
  if (item.vehicle) {
    const car = vehicleLine(item.vehicle);
    if (car) return car;
  }
  return item.notes?.trim() || 'Запись';
}

function consultationTitle(item: ClientDossierView['consultations'][number]) {
  const name = item.serviceCategory?.name;
  if (name && item.progressPercent != null) return `${name} · ${item.progressPercent}%`;
  if (name) return name;
  if (item.progressPercent != null) return `Консультация · ${item.progressPercent}%`;
  return 'Консультация';
}

function recordTitle(item: ClientDossierView['serviceRecords'][number]) {
  const car = item.vehicle ? vehicleLine(item.vehicle) : '';
  const amount = item.amountMinor != null ? clientCurrency.format(item.amountMinor / 100) : '';
  return [item.title, car, amount].filter(Boolean).join(' · ');
}

function timeline(view: ClientDossierView) {
  return [
    ...view.requests.map((item) => ({
      at: item.createdAt,
      title: requestTitle(item),
      meta: item.status,
      href: null as string | null,
    })),
    ...view.bookings.map((item) => ({
      at: item.preferredAt,
      title: bookingTitle(item),
      meta: item.status,
      href: null,
    })),
    ...view.consultations.map((item) => ({
      at: item.createdAt,
      title: consultationTitle(item),
      meta: item.status,
      href: null,
    })),
    ...view.contacts.map((item) => ({
      at: item.createdAt,
      title: item.message?.slice(0, 80) || 'Сообщение с сайта',
      meta: item.status,
      href: null,
    })),
    ...view.serviceRecords.map((item) => ({
      at: item.performedAt,
      title: recordTitle(item),
      meta: item.category,
      href: null,
    })),
  ].sort((a, b) => b.at.localeCompare(a.at));
}

export function ClientDossierFeed({ view, tab, onTab, requestBasePath }: ClientDossierFeedProps) {
  const events = timeline(view);

  return (
    <Tabs value={tab} onValueChange={(value) => onTab(value as ClientTab)}>
      <TabsList className="h-auto w-full flex-wrap">
        <TabsTrigger value="history">Заявки ({view.requests.length})</TabsTrigger>
        <TabsTrigger value="bookings">Записи ({view.bookings.length})</TabsTrigger>
        <TabsTrigger value="consultations">Консультации ({view.consultations.length})</TabsTrigger>
        <TabsTrigger value="book">Книжка ({view.serviceRecords.length})</TabsTrigger>
        <TabsTrigger value="timeline">События ({events.length})</TabsTrigger>
      </TabsList>

      <TabsContent value="history">
        {view.requests.length ? (
          <div className="manager-dossier-feed">
            {view.requests.map((request) => (
              <Link
                key={request.id}
                to={`${requestBasePath}/${request.id}`}
                className="manager-dossier-feed-item"
              >
                <time>{formatDay(request.createdAt)}</time>
                <span>
                  {requestTitle(request)}
                  {request.assignedManager?.fullName ? (
                    <em> · {request.assignedManager.fullName}</em>
                  ) : null}
                </span>
                <Badge variant={statusVariant(request.status)}>{statusLabel(request.status)}</Badge>
              </Link>
            ))}
          </div>
        ) : (
          <p className="manager-dossier-empty">Заявок пока нет.</p>
        )}
      </TabsContent>

      <TabsContent value="bookings">
        {view.bookings.length ? (
          <div className="manager-dossier-feed">
            {view.bookings.map((booking) => (
              <div key={booking.id} className="manager-dossier-feed-item">
                <time>{formatDayTime(booking.preferredAt)}</time>
                <span>{bookingTitle(booking)}</span>
                <Badge variant={statusVariant(booking.status)}>{statusLabel(booking.status)}</Badge>
              </div>
            ))}
          </div>
        ) : (
          <p className="manager-dossier-empty">Записей нет.</p>
        )}
      </TabsContent>

      <TabsContent value="consultations">
        {view.consultations.length ? (
          <div className="manager-dossier-feed">
            {view.consultations.map((consultation) => (
              <div key={consultation.id} className="manager-dossier-feed-item">
                <time>{formatDayTime(consultation.createdAt)}</time>
                <span>{consultationTitle(consultation)}</span>
                <Badge variant={statusVariant(consultation.status)}>{statusLabel(consultation.status)}</Badge>
              </div>
            ))}
          </div>
        ) : (
          <p className="manager-dossier-empty">Консультаций нет.</p>
        )}
      </TabsContent>

      <TabsContent value="book">
        {view.serviceRecords.length ? (
          <div className="manager-dossier-feed">
            {view.serviceRecords.map((record) => (
              <div key={record.id} className="manager-dossier-feed-item">
                <time>{formatDay(record.performedAt)}</time>
                <span>
                  {recordTitle(record)}
                  {record.mileageKm != null ? ` · ${formatMileageKm(record.mileageKm)}` : ''}
                </span>
                <Badge variant="secondary">{record.category}</Badge>
              </div>
            ))}
          </div>
        ) : (
          <p className="manager-dossier-empty">Сервисная книжка пустая.</p>
        )}
      </TabsContent>

      <TabsContent value="timeline">
        {events.length ? (
          <div className="manager-dossier-feed">
            {events.map((item, index) => (
              <div key={`${item.title}-${item.at}-${index}`} className="manager-dossier-feed-item">
                <time>{formatDayTime(item.at)}</time>
                <span>{item.title}</span>
                {item.meta ? <Badge variant={statusVariant(item.meta)}>{statusLabel(item.meta)}</Badge> : null}
              </div>
            ))}
          </div>
        ) : (
          <p className="manager-dossier-empty">Событий пока нет.</p>
        )}
      </TabsContent>
    </Tabs>
  );
}
