import { CalendarPlus, Copy, Phone, RefreshCw, Send, UserCheck } from 'lucide-react';
import type { ReactNode } from 'react';
import { Alert, AlertDescription, AlertTitle } from '../../components/console/ui/alert';
import { Badge } from '../../components/console/ui/badge';
import { Button } from '../../components/console/ui/button';
import { Card, CardContent } from '../../components/console/ui/card';
import { ManagerPicker } from '../../components/manager/ManagerPicker';
import { RequestStatusSelector } from '../../components/requests/RequestStatusSelector';
import { formatRequestNumber } from '../../lib/labels';
import { copyText } from '../../lib/clipboard';
import { toast } from 'sonner';
import type { LoadedManagerRequest } from './useManagerRequestDetail';

function urgencyVariant(urgency: string | null): 'secondary' | 'warning' | 'destructive' {
  if (urgency === 'critical' || urgency === 'high') return 'destructive';
  if (urgency === 'medium') return 'warning';
  return 'secondary';
}

function urgencyLabel(urgency: string) {
  if (urgency === 'critical') return 'Критическая';
  if (urgency === 'high') return 'Высокая';
  if (urgency === 'medium') return 'Средняя';
  return 'Низкая';
}

export function ManagerRequestChrome({ d }: { d: LoadedManagerRequest }) {
  const { request } = d;

  async function copyPhone() {
    if (!d.phone) return;
    const ok = await copyText(d.phone);
    if (ok) toast.success('Телефон скопирован');
    else toast.error('Не удалось скопировать номер');
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold tracking-tight tabular-nums">
            Заявка №{formatRequestNumber(request.id)}
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">{d.owner} · {d.car}</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {d.phone ? (
            <Button asChild size="sm">
              <a href={`tel:${d.phone}`}>
                <Phone />
                Позвонить
              </a>
            </Button>
          ) : null}
          <Button type="button" variant="outline" size="sm" onClick={() => d.openBooking()}>
            <CalendarPlus />
            Назначить запись
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
              В учётную систему
            </Button>
          ) : null}
          <Button type="button" variant="ghost" size="icon" className="size-8" onClick={() => void d.load()} aria-label="Обновить данные заявки">
            <RefreshCw />
          </Button>
        </div>
      </div>

      <Card>
        <CardContent className="flex flex-wrap gap-4 py-1">
          <Field label="Статус">
            <RequestStatusSelector value={request.status} onChange={(next) => void d.changeStatus(next)} />
          </Field>
          <Field label="Клиент">
            <strong className="text-sm">{d.owner}</strong>
            {d.phone ? (
              <span className="flex min-w-0 items-center gap-1 text-xs tabular-nums text-muted-foreground">
                <a href={`tel:${d.phone}`} className="min-w-0 truncate">
                  {d.phone}
                </a>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="size-6 shrink-0"
                  aria-label="Скопировать номер"
                  onClick={() => void copyPhone()}
                >
                  <Copy />
                </Button>
              </span>
            ) : null}
          </Field>
          <Field label="Автомобиль">
            <strong className="text-sm">{d.car}</strong>
          </Field>
          <Field label="Диагноз ИИ">
            <span className="flex items-center gap-1.5">
              {d.urgency ? <Badge variant={urgencyVariant(d.urgency)}>{urgencyLabel(d.urgency)}</Badge> : (
                <span className="text-sm text-muted-foreground">нет</span>
              )}
              {d.confidence != null ? (
                <span className="text-xs tabular-nums text-muted-foreground">{d.confidence}%</span>
              ) : null}
            </span>
          </Field>
          <Field label="Создана">
            <strong className="text-sm tabular-nums">{new Date(request.createdAt).toLocaleString('ru-RU')}</strong>
          </Field>
          <Field label="Ответственный">
            <div className="flex flex-wrap items-center gap-2">
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
          </Field>
        </CardContent>
      </Card>

      {d.actionError ? (
        <Alert variant="destructive">
          <AlertTitle>Действие не выполнено</AlertTitle>
          <AlertDescription className="flex flex-col gap-2">
            <span>{d.actionError}</span>
            <Button type="button" variant="outline" size="sm" className="w-fit" onClick={() => d.setActionError(null)}>
              Скрыть
            </Button>
          </AlertDescription>
        </Alert>
      ) : null}
    </div>
  );
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex min-w-[10rem] flex-1 flex-col gap-1">
      <span className="text-xs text-muted-foreground">{label}</span>
      {children}
    </div>
  );
}
