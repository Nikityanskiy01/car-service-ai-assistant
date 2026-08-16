import { useCallback, useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Copy, MessagesSquare, Phone, RefreshCw } from 'lucide-react';
import { toast } from 'sonner';
import { prefillConsultationGuest } from '../../features/services/prefill';
import { convertContactToRequest, listContacts, patchContactStatus } from '../../api/dashboard';
import { copyText } from '../../lib/clipboard';
import { Alert, AlertDescription, AlertTitle } from '../../components/console/ui/alert';
import { Badge } from '../../components/console/ui/badge';
import { Button } from '../../components/console/ui/button';
import { Card, CardContent } from '../../components/console/ui/card';
import { Skeleton } from '../../components/console/ui/skeleton';
import { Tabs, TabsList, TabsTrigger } from '../../components/console/ui/tabs';
import { managerZonePaths } from '../../config/managerPaths';
import { CONTACT_STATUS_LABELS, CONTACT_SOURCE_LABELS } from '../../lib/labels';
import { formatRelativeTime } from '../../lib/managerRequestHelpers';
import { useDashboardPolling } from '../../hooks/useDashboardPolling';
import { usePageMeta } from '../../hooks/usePageMeta';
import type { ContactSubmission } from '../../types/dashboard';

type ManagerContactsPageProps = {
  adminZone?: boolean;
};

function contactStatusVariant(status: string): 'default' | 'secondary' | 'destructive' | 'success' | 'warning' {
  if (status === 'CONVERTED') return 'success';
  if (status === 'CLOSED') return 'secondary';
  if (status === 'NEW') return 'warning';
  return 'default';
}

export function ManagerContactsPage({ adminZone = false }: ManagerContactsPageProps) {
  usePageMeta({
    title: adminZone ? 'Обращения — операции' : 'Входящие',
    description: 'Сообщения из формы обратной связи.',
  });

  const paths = managerZonePaths(adminZone);
  const navigate = useNavigate();
  const [firstLoad, setFirstLoad] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [contacts, setContacts] = useState<ContactSubmission[]>([]);
  const [statusTab, setStatusTab] = useState('NEW');
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  const load = useCallback(
    async (silent = false) => {
      if (!silent) setError(null);
      try {
        const status = statusTab === 'all' ? undefined : statusTab;
        setContacts(await listContacts(status));
        if (silent) setError(null);
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Не удалось загрузить обращения');
      } finally {
        setFirstLoad(false);
      }
    },
    [statusTab],
  );

  useEffect(() => {
    void load();
  }, [load]);

  useDashboardPolling(() => void load(true), 60_000);

  async function handleStatus(contact: ContactSubmission, status: 'IN_PROGRESS' | 'CLOSED') {
    setActionLoading(contact.id);
    try {
      await patchContactStatus(contact.id, { status });
      await load(true);
      toast.success(status === 'CLOSED' ? 'Обращение закрыто' : 'Обращение взято в работу', {
        description: contact.fullName,
      });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Не удалось обновить статус');
    } finally {
      setActionLoading(null);
    }
  }

  async function handleConvert(contact: ContactSubmission) {
    setActionLoading(contact.id);
    try {
      const out = await convertContactToRequest(contact.id);
      toast.success('Заявка создана', { description: contact.fullName });
      void navigate(`${paths.requests}/${out.requestId}`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Не удалось создать заявку');
      setActionLoading(null);
    }
  }

  async function copyPhone(phone: string) {
    const ok = await copyText(phone);
    if (ok) toast.success('Телефон скопирован');
    else toast.error('Не удалось скопировать номер');
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm text-muted-foreground">Контакты и вопросы с публичных страниц сайта.</p>
        <Button type="button" variant="ghost" size="sm" onClick={() => void load()}>
          <RefreshCw />
          Обновить
        </Button>
      </div>

      <Tabs value={statusTab} onValueChange={setStatusTab} className="gap-0">
        <TabsList>
          <TabsTrigger value="NEW">Новые</TabsTrigger>
          <TabsTrigger value="IN_PROGRESS">В работе</TabsTrigger>
          <TabsTrigger value="CONVERTED">Конвертированы</TabsTrigger>
          <TabsTrigger value="CLOSED">Закрыты</TabsTrigger>
          <TabsTrigger value="all">Все</TabsTrigger>
        </TabsList>
      </Tabs>

      {error ? (
        <Alert variant="destructive">
          <AlertTitle>Не удалось загрузить входящие</AlertTitle>
          <AlertDescription className="flex flex-col gap-2">
            <span>Проверьте соединение и повторите попытку.</span>
            <Button type="button" variant="outline" size="sm" className="w-fit" onClick={() => void load()}>
              Повторить
            </Button>
          </AlertDescription>
        </Alert>
      ) : null}

      {firstLoad ? (
        <div className="flex flex-col gap-2">
          <Skeleton className="h-24 w-full" />
          <Skeleton className="h-24 w-full" />
        </div>
      ) : null}

      {!firstLoad && !error && !contacts.length ? (
        <Card>
          <CardContent className="py-10 text-center text-sm text-muted-foreground">
            {statusTab === 'NEW' ? 'Все новые сообщения разобраны.' : 'В этом статусе пока пусто.'}
          </CardContent>
        </Card>
      ) : null}

      {!firstLoad && !error && contacts.length ? (
        <ul className="flex list-none flex-col gap-2">
          {contacts.map((item) => {
            const busy = actionLoading === item.id;
            const status = item.status || 'NEW';
            const open = status !== 'CONVERTED' && status !== 'CLOSED';
            return (
              <li key={item.id}>
                <Card className={busy ? 'opacity-70' : undefined}>
                  <CardContent className="flex flex-col gap-3 py-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <strong className="text-sm">{item.fullName}</strong>
                      <Badge variant={contactStatusVariant(status)}>{CONTACT_STATUS_LABELS[status]}</Badge>
                      {item.createdAt ? (
                        <span className="text-xs text-muted-foreground tabular-nums">
                          {formatRelativeTime(item.createdAt)}
                        </span>
                      ) : null}
                    </div>
                    <div className="flex min-w-0 items-center gap-2 text-sm tabular-nums">
                      <a href={`tel:${item.phone}`} className="min-w-0 truncate text-foreground">
                        {item.phone}
                      </a>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="size-7 shrink-0"
                        aria-label="Скопировать номер"
                        onClick={() => void copyPhone(item.phone)}
                      >
                        <Copy />
                      </Button>
                    </div>
                    <p className="text-sm">{item.message || 'Без текста'}</p>
                    <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                      {item.source ? <Badge variant="outline">{CONTACT_SOURCE_LABELS[item.source] || item.source}</Badge> : null}
                      {item.convertedRequestId ? (
                        <Link to={`${paths.requests}/${item.convertedRequestId}`} className="text-primary">
                          Открыть созданную заявку
                        </Link>
                      ) : null}
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                      <Button asChild variant="ghost" size="icon" className="size-8">
                        <a href={`tel:${item.phone}`} aria-label="Позвонить">
                          <Phone />
                        </a>
                      </Button>
                      {open ? (
                        <>
                          {status === 'NEW' ? (
                            <Button
                              type="button"
                              variant="secondary"
                              size="sm"
                              disabled={busy}
                              onClick={() => void handleStatus(item, 'IN_PROGRESS')}
                            >
                              В работу
                            </Button>
                          ) : null}
                          <Button type="button" size="sm" disabled={busy} onClick={() => void handleConvert(item)}>
                            Создать заявку
                          </Button>
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            disabled={busy}
                            onClick={() => {
                              prefillConsultationGuest({ fullName: item.fullName, phone: item.phone });
                              void navigate('/consult');
                            }}
                          >
                            <MessagesSquare />
                            Консультация
                          </Button>
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            disabled={busy}
                            onClick={() => void handleStatus(item, 'CLOSED')}
                          >
                            Закрыть
                          </Button>
                        </>
                      ) : null}
                    </div>
                  </CardContent>
                </Card>
              </li>
            );
          })}
        </ul>
      ) : null}
    </div>
  );
}
