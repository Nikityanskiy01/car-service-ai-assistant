import { CalendarClock, Car, UserRound } from 'lucide-react';
import { formatRequestNumber } from '../../lib/labels';
import type { ServiceRequest } from '../../types/serviceRequest';
import { StatusBadge } from '../ui/StatusBadge';

export function ServiceRequestCard({
  request,
  extra,
}: {
  request: ServiceRequest;
  extra?: React.ReactNode;
}) {
  const owner = request.client?.fullName || request.guestName || 'Гостевое обращение';
  const car = `${request.snapshotMake || ''} ${request.snapshotModel || ''}`.trim() || 'Автомобиль не указан';
  return (
    <article className="request-card">
      <header>
        <div>
          <h4>Заявка №{formatRequestNumber(request.id)}</h4>
          <StatusBadge status={request.status} />
        </div>
        <small>{new Date(request.createdAt).toLocaleString()}</small>
      </header>
      <p className="request-symptoms">{request.snapshotSymptoms || 'Симптомы уточняются'}</p>
      <ul>
        <li>
          <UserRound size={14} />
          <span>{owner}</span>
        </li>
        <li>
          <Car size={14} />
          <span>{car}</span>
        </li>
        <li>
          <CalendarClock size={14} />
          <span>{new Date(request.createdAt).toLocaleDateString('ru-RU')}</span>
        </li>
      </ul>
      {extra}
    </article>
  );
}
