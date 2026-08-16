import { CalendarPlus, Copy, Phone, RefreshCw, Send, UserCheck } from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from '../../components/console/ui/alert';
import { Button } from '../../components/console/ui/button';
import { ManagerPicker } from '../../components/manager/ManagerPicker';
import { RequestStatusSelector } from '../../components/requests/RequestStatusSelector';
import { formatRequestNumber } from '../../lib/labels';
import { copyText } from '../../lib/clipboard';
import { formatDateTime } from '../../lib/clientMeta';
import { formatMileageKm } from '../../lib/managerRequestHelpers';
import { toast } from '../../lib/toast';
import type { LoadedManagerRequest } from './useManagerRequestDetail';

export function ManagerRequestChrome({ d }: { d: LoadedManagerRequest }) {
  const { request } = d;
  const extracted = request.consultationSession?.extracted;
  const year = extracted && typeof extracted === 'object' ? extracted.year : null;
  const mileage = extracted && typeof extracted === 'object' ? extracted.mileage : null;
  const carMissing = !d.car || d.car === 'Не указан';
  const carLine = carMissing ? 'Не указано' : [d.car, year].filter(Boolean).join(', ');
  const facts = [
    { kicker: 'Клиент', value: d.owner },
    { kicker: 'Авто', value: carLine },
    mileage && !carMissing ? { kicker: 'Пробег', value: formatMileageKm(mileage) } : null,
    { kicker: 'Создана', value: formatDateTime(request.createdAt) },
  ].filter(Boolean) as Array<{ kicker: string; value: string }>;

  async function copyPhone() {
    if (!d.phone) return;
    const ok = await copyText(d.phone);
    if (ok) toast.success('Телефон скопирован');
    else toast.error('Не удалось скопировать номер');
  }

  return (
    <header className="request-chrome">
      <div className="request-chrome-mast">
        <p className="request-chrome-kicker">Обращение</p>
        <h1>Заявка №{formatRequestNumber(request.id)}</h1>
        <ul className="request-chrome-facts">
          {facts.map((fact) => (
            <li key={fact.kicker}>
              <small>{fact.kicker}</small>
              <span>{fact.value}</span>
            </li>
          ))}
        </ul>
      </div>

      <div className="request-chrome-dock">
        <div className="request-chrome-ops">
          <RequestStatusSelector value={request.status} onChange={(next) => void d.changeStatus(next)} />
          <ManagerPicker
            value={d.assignManagerId || request.assignedManagerId || ''}
            onChange={d.setAssignManagerId}
            allowEmpty
            placeholder="Не назначен"
            disabled={d.assigning}
          />
          {d.assignManagerId && d.assignManagerId !== request.assignedManagerId ? (
            <Button type="button" variant="secondary" size="sm" disabled={d.assigning} onClick={() => void d.handleAssignManager()}>
              Назначить
            </Button>
          ) : (
            <Button type="button" variant="ghost" size="sm" disabled={d.assigning} onClick={() => void d.handleAssignToMe()}>
              <UserCheck />
              На себя
            </Button>
          )}
        </div>

        <div className="request-chrome-actions">
          {d.phone ? (
            <span className="request-call-group">
              <Button asChild className="request-call no-underline">
                <a href={`tel:${d.phone}`}>
                  Позвонить
                  <span className="request-call-mark" aria-hidden="true">
                    <Phone />
                  </span>
                </a>
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="request-icon-btn"
                aria-label="Скопировать номер"
                onClick={() => void copyPhone()}
              >
                <Copy />
              </Button>
            </span>
          ) : null}
          <Button type="button" variant="outline" size="sm" onClick={() => d.openBooking()}>
            <CalendarPlus />
            {request.bookings?.length ? 'Ещё запись' : 'Назначить запись'}
          </Button>
          {d.exportableConnections.length ? (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => {
                d.setExportConnectionId(
                  d.exportableConnections.length === 1 ? d.exportableConnections[0].id : '',
                );
                d.setExportOpen(true);
              }}
            >
              <Send />
              В учёт
            </Button>
          ) : null}
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="request-icon-btn"
            onClick={() => void d.load()}
            aria-label="Обновить данные заявки"
          >
            <RefreshCw />
          </Button>
        </div>
      </div>

      {d.actionError ? (
        <Alert variant="destructive" className="request-chrome-error">
          <AlertTitle>Действие не выполнено</AlertTitle>
          <AlertDescription className="flex flex-col gap-2">
            <span>{d.actionError}</span>
            <Button type="button" variant="outline" size="sm" className="w-fit" onClick={() => d.setActionError(null)}>
              Скрыть
            </Button>
          </AlertDescription>
        </Alert>
      ) : null}
    </header>
  );
}
