import { formatRequestNumber } from '../../lib/labels';
import { formatMileageKm } from '../../lib/managerRequestHelpers';
import {
  clientCurrency,
  formatDay,
  formatDayTime,
  vehicleLine,
  vehicleTitle,
  type ClientDossierView,
} from '../../lib/managerClientDossier';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../console/ui/tabs';
import { DossierFeedRow } from './DossierFeedRow';

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
  return car ? `${number} · ${car}` : number;
}

function bookingTitle(item: ClientDossierView['bookings'][number]) {
  if (item.vehicle) {
    const car = vehicleLine(item.vehicle);
    if (car) return car;
  }
  return item.notes?.trim() || 'Запись';
}

function consultationTitle(item: ClientDossierView['consultations'][number]) {
  return item.serviceCategory?.name || 'Консультация';
}

function consultationDetail(item: ClientDossierView['consultations'][number]) {
  return item.progressPercent != null ? `${item.progressPercent}%` : null;
}

function recordTitle(item: ClientDossierView['serviceRecords'][number]) {
  return item.title;
}

function recordDetail(item: ClientDossierView['serviceRecords'][number]) {
  const car = item.vehicle ? vehicleLine(item.vehicle) : '';
  const amount = item.amountMinor != null ? clientCurrency.format(item.amountMinor / 100) : '';
  const mileage = item.mileageKm != null ? formatMileageKm(item.mileageKm) : '';
  return [car, amount, mileage].filter(Boolean).join(' · ') || null;
}

function timeline(view: ClientDossierView) {
  return [
    ...view.requests.map((item) => ({
      at: item.createdAt,
      title: requestTitle(item),
      detail: item.snapshotSymptoms || null,
      owner: item.assignedManager?.fullName || null,
      meta: item.status,
    })),
    ...view.bookings.map((item) => ({
      at: item.preferredAt,
      title: bookingTitle(item),
      detail: null as string | null,
      owner: null as string | null,
      meta: item.status,
    })),
    ...view.consultations.map((item) => ({
      at: item.createdAt,
      title: consultationTitle(item),
      detail: consultationDetail(item),
      owner: null,
      meta: item.status,
    })),
    ...view.contacts.map((item) => ({
      at: item.createdAt,
      title: item.message?.slice(0, 80) || 'Сообщение с сайта',
      detail: null,
      owner: null,
      meta: item.status,
    })),
    ...view.serviceRecords.map((item) => ({
      at: item.performedAt,
      title: recordTitle(item),
      detail: recordDetail(item),
      owner: null,
      meta: item.category,
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
              <DossierFeedRow
                key={request.id}
                href={`${requestBasePath}/${request.id}`}
                when={formatDay(request.createdAt)}
                title={requestTitle(request)}
                detail={request.snapshotSymptoms}
                owner={request.assignedManager?.fullName}
                status={request.status}
              />
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
              <DossierFeedRow
                key={booking.id}
                when={formatDayTime(booking.preferredAt)}
                title={bookingTitle(booking)}
                status={booking.status}
              />
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
              <DossierFeedRow
                key={consultation.id}
                when={formatDayTime(consultation.createdAt)}
                title={consultationTitle(consultation)}
                detail={consultationDetail(consultation)}
                status={consultation.status}
              />
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
              <DossierFeedRow
                key={record.id}
                when={formatDay(record.performedAt)}
                title={recordTitle(record)}
                detail={recordDetail(record)}
                status={record.category}
              />
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
              <DossierFeedRow
                key={`${item.title}-${item.at}-${index}`}
                when={formatDayTime(item.at)}
                title={item.title}
                detail={item.detail}
                owner={item.owner}
                status={item.meta}
              />
            ))}
          </div>
        ) : (
          <p className="manager-dossier-empty">Событий пока нет.</p>
        )}
      </TabsContent>
    </Tabs>
  );
}
