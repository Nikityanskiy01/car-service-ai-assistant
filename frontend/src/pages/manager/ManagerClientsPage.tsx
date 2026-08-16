import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { CalendarPlus, Copy, Mail, Phone, RefreshCw, Send } from 'lucide-react';
import { toast } from 'sonner';
import {
  getClientDossier,
  getGuestDossier,
  listClients,
  type ManagerClientFilter,
  type ManagerClientRow,
  type ManagerClientSort,
} from '../../api/dashboard';
import { managerZonePaths } from '../../config/managerPaths';
import { prefillBookingFromConsultation } from '../../features/services/prefill';
import { useDebouncedValue } from '../../hooks/useDebouncedValue';
import { useMediaQuery } from '../../hooks/useMediaQuery';
import { usePageMeta } from '../../hooks/usePageMeta';
import { copyText } from '../../lib/clipboard';
import { formatRequestNumber, SERVICE_REQUEST_STATUS_LABELS } from '../../lib/labels';
import { Alert, AlertDescription, AlertTitle } from '../../components/console/ui/alert';
import { Badge } from '../../components/console/ui/badge';
import { Button } from '../../components/console/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/console/ui/card';
import { Input } from '../../components/console/ui/input';
import { ScrollArea } from '../../components/console/ui/scroll-area';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../../components/console/ui/select';
import { Separator } from '../../components/console/ui/separator';
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from '../../components/console/ui/sheet';
import { Skeleton } from '../../components/console/ui/skeleton';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../../components/console/ui/tabs';
import type { ClientDossier, GuestDossier } from '../../types/dashboard';

type ClientTab = 'history' | 'bookings' | 'consultations' | 'timeline';

const PAGE_SIZE = 20;
const ACTIVE_STATUSES = ['NEW', 'IN_PROGRESS', 'SCHEDULED'];

const currency = new Intl.NumberFormat('ru-RU', {
  style: 'currency',
  currency: 'RUB',
  maximumFractionDigits: 0,
});

function statusLabel(status: string) {
  return SERVICE_REQUEST_STATUS_LABELS[status as keyof typeof SERVICE_REQUEST_STATUS_LABELS] || status;
}

function statusVariant(status: string): 'default' | 'secondary' | 'destructive' | 'success' | 'warning' {
  if (status === 'COMPLETED' || status === 'CONFIRMED') return 'success';
  if (status === 'CANCELLED' || status === 'NO_SHOW') return 'destructive';
  if (ACTIVE_STATUSES.includes(status) || status === 'PENDING') return 'warning';
  return 'secondary';
}

function telegramHref(value: string) {
  const handle = value.replace(/^@/, '').replace(/^https?:\/\/t\.me\//i, '');
  return `https://t.me/${handle}`;
}

function formatActivity(iso: string | null) {
  if (!iso) return 'Нет обращений';
  return new Date(iso).toLocaleDateString('ru-RU', { day: 'numeric', month: 'short' });
}

export function ManagerClientsPage({ adminZone = false }: { adminZone?: boolean }) {
  usePageMeta({
    title: adminZone ? 'Клиенты — операции' : 'Клиенты',
    description: 'Карточки клиентов и история обращений.',
  });
  const paths = managerZonePaths(adminZone);
  const navigate = useNavigate();
  const isDesktop = useMediaQuery('(min-width: 1024px)');

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [clients, setClients] = useState<ManagerClientRow[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<ManagerClientFilter>('all');
  const [sort, setSort] = useState<ManagerClientSort>('activity');
  const [selectedKey, setSelectedKey] = useState<string | null>(null);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [dossier, setDossier] = useState<ClientDossier | null>(null);
  const [guestDossier, setGuestDossier] = useState<GuestDossier | null>(null);
  const [dossierLoading, setDossierLoading] = useState(false);
  const [dossierError, setDossierError] = useState<string | null>(null);
  const [clientTab, setClientTab] = useState<ClientTab>('history');

  const debouncedSearch = useDebouncedValue(search, 200);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await listClients({
        q: debouncedSearch,
        filter,
        sort,
        page,
        pageSize: PAGE_SIZE,
      });
      setClients(data.items);
      setTotal(data.total);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Не удалось загрузить клиентов');
    } finally {
      setLoading(false);
    }
  }, [debouncedSearch, filter, sort, page]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    setPage(1);
  }, [debouncedSearch, filter, sort]);

  const selected = clients.find((item) => item.key === selectedKey) || null;
  const profile = dossier?.profile || guestDossier?.profile;
  const requests = useMemo(() => dossier?.requests || guestDossier?.requests || [], [dossier, guestDossier]);
  const bookings = useMemo(() => dossier?.bookings || guestDossier?.bookings || [], [dossier, guestDossier]);
  const metrics = dossier?.metrics || guestDossier?.metrics;
  const telegram = dossier?.profile?.telegram || '';

  const timeline = useMemo(() => {
    if (!profile) return [];
    const items = [
      ...requests.map((item) => ({ at: item.createdAt, type: 'request', title: 'Заявка', meta: item.status })),
      ...bookings.map((item) => ({ at: item.preferredAt, type: 'booking', title: 'Запись', meta: item.status })),
      ...(dossier?.consultations || []).map((item) => ({
        at: item.createdAt,
        type: 'consultation',
        title: 'Консультация ИИ',
        meta: item.status,
      })),
      ...(guestDossier?.contacts || []).map((item) => ({
        at: item.createdAt,
        type: 'contact',
        title: 'Обращение с сайта',
        meta: item.status,
      })),
    ];
    return items.sort((a, b) => b.at.localeCompare(a.at));
  }, [profile, requests, bookings, dossier, guestDossier]);

  const openClient = useCallback(
    async (client: ManagerClientRow) => {
      setSelectedKey(client.key);
      if (!isDesktop) setSheetOpen(true);
      setDossierLoading(true);
      setDossierError(null);
      setDossier(null);
      setGuestDossier(null);
      setClientTab('history');
      try {
        if (client.clientId) {
          setDossier(await getClientDossier(client.clientId));
        } else if (client.guestPhone) {
          setGuestDossier(await getGuestDossier(client.guestPhone));
        } else {
          setDossierError('У гостя нет телефона, историю подтянуть не из чего.');
        }
      } catch (e) {
        setDossierError(e instanceof Error ? e.message : 'Не удалось загрузить карточку клиента');
      } finally {
        setDossierLoading(false);
      }
    },
    [isDesktop],
  );

  async function copyPhone(phone: string) {
    const ok = await copyText(phone);
    if (ok) toast.success('Телефон скопирован');
    else toast.error('Не удалось скопировать номер');
  }

  const pageCount = Math.max(1, Math.ceil(total / PAGE_SIZE));

  const dossierBody = (
    <>
      {dossierLoading ? (
        <div className="flex flex-col gap-3">
          <Skeleton className="h-7 w-48" />
          <Skeleton className="h-4 w-40" />
          <Skeleton className="h-16 w-full" />
          <Skeleton className="h-32 w-full" />
        </div>
      ) : null}
      {!dossierLoading && dossierError ? (
        <Alert variant="destructive">
          <AlertTitle>Не удалось открыть карточку</AlertTitle>
          <AlertDescription>{dossierError}</AlertDescription>
        </Alert>
      ) : null}
      {!dossierLoading && !dossierError && !profile ? (
        <p className="text-sm text-muted-foreground">Выберите клиента в списке слева.</p>
      ) : null}
      {!dossierLoading && profile ? (
        <div className="flex flex-col gap-4">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h3 className="text-lg font-semibold tracking-tight">{profile.fullName}</h3>
              {'isGuest' in profile && profile.isGuest ? <Badge variant="secondary">гость</Badge> : null}
            </div>
            <div className="mt-2 flex flex-col gap-1 text-sm">
              {profile.phone ? (
                <span className="flex flex-wrap items-center gap-2">
                  <a href={`tel:${profile.phone}`} className="tabular-nums text-foreground no-underline hover:underline">
                    {profile.phone}
                  </a>
                  <Button type="button" variant="ghost" size="sm" onClick={() => void copyPhone(profile.phone as string)}>
                    <Copy />
                    Копировать
                  </Button>
                </span>
              ) : (
                <span className="text-muted-foreground">Телефон не указан</span>
              )}
              {'email' in profile && profile.email ? (
                <a href={`mailto:${profile.email}`} className="text-muted-foreground no-underline hover:underline">
                  {profile.email}
                </a>
              ) : null}
              {'createdAt' in profile && profile.createdAt ? (
                <span className="text-muted-foreground">
                  Клиент с {new Date(profile.createdAt).toLocaleDateString('ru-RU')}
                </span>
              ) : null}
            </div>
          </div>

          {metrics ? (
            <div className="flex gap-3">
              {[
                { label: 'Заявки', value: String(metrics.requestsTotal ?? 0) },
                { label: 'Завершено', value: String(metrics.completedRequests ?? 0) },
                { label: 'LTV', value: currency.format((metrics.ltvMinor ?? 0) / 100) },
              ].map((item) => (
                <div key={item.label} className="min-w-0 flex-1 rounded-lg border border-border bg-muted/40 px-3 py-2">
                  <div className="text-xs text-muted-foreground">{item.label}</div>
                  <div className="text-base font-semibold tabular-nums">{item.value}</div>
                </div>
              ))}
            </div>
          ) : null}

          {(dossier?.vehicles || []).length ? (
            <div>
              <h4 className="mb-2 text-sm font-medium">Автомобили</h4>
              <ul className="flex flex-col gap-1 text-sm">
                {dossier!.vehicles.map((vehicle, index) => (
                  <li key={`${vehicle.make}-${vehicle.model}-${index}`}>
                    {[vehicle.make, vehicle.model, vehicle.year].filter(Boolean).join(' ')}
                  </li>
                ))}
              </ul>
            </div>
          ) : null}

          <Tabs value={clientTab} onValueChange={(value) => setClientTab(value as ClientTab)}>
            <TabsList>
              <TabsTrigger value="history">Заявки ({requests.length})</TabsTrigger>
              <TabsTrigger value="bookings">Записи ({bookings.length})</TabsTrigger>
              <TabsTrigger value="consultations">Консультации</TabsTrigger>
              <TabsTrigger value="timeline">Таймлайн</TabsTrigger>
            </TabsList>
            <TabsContent value="history">
              {requests.length ? (
                <ul className="flex flex-col gap-1">
                  {requests.map((request) => (
                    <li key={request.id}>
                      <Link
                        to={`${paths.requests}/${request.id}`}
                        className="flex flex-wrap items-center gap-2 rounded-md px-2 py-2 text-sm no-underline hover:bg-accent"
                      >
                        <span className="font-medium tabular-nums">№{formatRequestNumber(request.id)}</span>
                        <Badge variant={statusVariant(request.status)}>{statusLabel(request.status)}</Badge>
                        <span className="text-muted-foreground tabular-nums">
                          {new Date(request.createdAt).toLocaleDateString('ru-RU')}
                        </span>
                        {'snapshotMake' in request && (request.snapshotMake || request.snapshotModel) ? (
                          <span className="text-muted-foreground">
                            {[request.snapshotMake, request.snapshotModel].filter(Boolean).join(' ')}
                          </span>
                        ) : null}
                      </Link>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-sm text-muted-foreground">Заявок пока нет.</p>
              )}
            </TabsContent>
            <TabsContent value="bookings">
              {bookings.length ? (
                <ul className="flex flex-col gap-2 text-sm">
                  {bookings.map((booking) => (
                    <li key={booking.id} className="flex flex-wrap items-center gap-2">
                      <span className="tabular-nums">{new Date(booking.preferredAt).toLocaleString('ru-RU')}</span>
                      <Badge variant={statusVariant(booking.status)}>{statusLabel(booking.status)}</Badge>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-sm text-muted-foreground">Записей нет.</p>
              )}
            </TabsContent>
            <TabsContent value="consultations">
              {dossier?.consultations?.length ? (
                <ul className="flex flex-col gap-2 text-sm">
                  {dossier.consultations.map((consultation) => (
                    <li key={consultation.id} className="flex flex-wrap items-center gap-2">
                      <span className="tabular-nums">{new Date(consultation.createdAt).toLocaleString('ru-RU')}</span>
                      <Badge variant={statusVariant(consultation.status)}>{statusLabel(consultation.status)}</Badge>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-sm text-muted-foreground">Консультаций нет. У гостей история собрана в заявках.</p>
              )}
            </TabsContent>
            <TabsContent value="timeline">
              {timeline.length ? (
                <ul className="flex flex-col gap-2 text-sm">
                  {timeline.map((item, index) => (
                    <li key={`${item.type}-${item.at}-${index}`} className="flex flex-wrap items-center gap-2">
                      <time className="text-muted-foreground tabular-nums">
                        {new Date(item.at).toLocaleString('ru-RU')}
                      </time>
                      <strong className="font-medium">{item.title}</strong>
                      {item.meta ? <Badge variant={statusVariant(item.meta)}>{statusLabel(item.meta)}</Badge> : null}
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-sm text-muted-foreground">Событий пока нет.</p>
              )}
            </TabsContent>
          </Tabs>

          {guestDossier?.contacts?.length ? (
            <div>
              <h4 className="mb-2 text-sm font-medium">Обращения с сайта</h4>
              <ul className="flex flex-col gap-2 text-sm">
                {guestDossier.contacts.map((contact) => (
                  <li key={contact.id}>
                    <span>{contact.fullName}</span>
                    <span className="ml-2 text-muted-foreground">{contact.message?.slice(0, 60) || 'Без текста'}</span>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}

          <Separator />
          <div className="flex flex-wrap gap-2">
            {profile.phone ? (
              <Button asChild size="sm">
                <a href={`tel:${profile.phone}`}>
                  <Phone />
                  Позвонить
                </a>
              </Button>
            ) : null}
            {telegram ? (
              <Button asChild variant="outline" size="sm">
                <a href={telegramHref(telegram)} target="_blank" rel="noreferrer">
                  <Send />
                  Telegram
                </a>
              </Button>
            ) : null}
            {'email' in profile && profile.email ? (
              <Button asChild variant="outline" size="sm">
                <a href={`mailto:${profile.email}`}>
                  <Mail />
                  Почта
                </a>
              </Button>
            ) : profile.phone ? (
              <Button asChild variant="outline" size="sm">
                <a href={`sms:${profile.phone}`}>
                  <Send />
                  SMS
                </a>
              </Button>
            ) : null}
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => {
                prefillBookingFromConsultation({
                  detail: null,
                  fullName: profile.fullName,
                  phone: profile.phone || undefined,
                });
                void navigate('/booking');
              }}
            >
              <CalendarPlus />
              Создать запись
            </Button>
          </div>
        </div>
      ) : null}
    </>
  );

  const listCard = (
    <Card className="min-w-0 flex-1 xl:max-w-md">
      <CardHeader>
        <CardTitle>Список клиентов</CardTitle>
        <span className="text-sm text-muted-foreground tabular-nums">
          {clients.length} из {total}
        </span>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        <Tabs
          value={filter}
          onValueChange={(value) => setFilter(value as ManagerClientFilter)}
        >
          <TabsList>
            <TabsTrigger value="all">Все</TabsTrigger>
            <TabsTrigger value="active">Активные</TabsTrigger>
            <TabsTrigger value="guests">Гости</TabsTrigger>
          </TabsList>
        </Tabs>
        <div className="flex gap-2">
          <Input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Имя, телефон или email"
            aria-label="Поиск клиентов"
          />
          <Select value={sort} onValueChange={(value) => setSort(value as ManagerClientSort)}>
            <SelectTrigger className="w-44 shrink-0" aria-label="Сортировка клиентов">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="activity">По активности</SelectItem>
              <SelectItem value="recent">По дате обращения</SelectItem>
              <SelectItem value="name">По имени</SelectItem>
            </SelectContent>
          </Select>
        </div>
        {loading ? (
          <div className="flex flex-col gap-2">
            <Skeleton className="h-14 w-full" />
            <Skeleton className="h-14 w-full" />
            <Skeleton className="h-14 w-full" />
          </div>
        ) : !clients.length ? (
          <p className="py-8 text-center text-sm text-muted-foreground">
            {search ? 'Уточните запрос или сбросьте фильтр.' : 'Клиенты появятся здесь после первых обращений.'}
          </p>
        ) : (
          <ScrollArea className="h-[min(28rem,55vh)]">
            <ul className="flex list-none flex-col">
              {clients.map((client) => {
                const active = selectedKey === client.key;
                return (
                  <li key={client.key}>
                    <button
                      type="button"
                      className={`flex w-full cursor-pointer flex-col items-start gap-1 rounded-lg px-3 py-2.5 text-left transition-[background-color,transform] duration-150 ease-[cubic-bezier(0.23,1,0.32,1)] hover:bg-accent active:scale-[0.99] ${active ? 'bg-primary/10' : ''}`}
                      aria-current={active ? 'true' : undefined}
                      onClick={() => void openClient(client)}
                    >
                      <span className="flex w-full items-center gap-2">
                        <strong className="min-w-0 flex-1 truncate text-sm font-medium">{client.name}</strong>
                        {client.isGuest ? <Badge variant="secondary">гость</Badge> : null}
                      </span>
                      <span className="text-xs text-muted-foreground tabular-nums">
                        {client.phone || 'Телефон не указан'} · {formatActivity(client.lastActivityAt)}
                      </span>
                      {client.activeRequests ? (
                        <Badge variant="default">{client.activeRequests} в работе</Badge>
                      ) : null}
                    </button>
                  </li>
                );
              })}
            </ul>
          </ScrollArea>
        )}
        {pageCount > 1 ? (
          <div className="flex items-center justify-between text-sm">
            <Button type="button" variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>
              Назад
            </Button>
            <span className="tabular-nums text-muted-foreground">
              {page} / {pageCount}
            </span>
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={page >= pageCount}
              onClick={() => setPage((p) => p + 1)}
            >
              Дальше
            </Button>
          </div>
        ) : null}
      </CardContent>
    </Card>
  );

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm text-muted-foreground">Контакты, автомобили и активные заявки.</p>
        <Button type="button" variant="outline" size="sm" onClick={() => void load()}>
          <RefreshCw />
          Обновить
        </Button>
      </div>

      {error ? (
        <Alert variant="destructive">
          <AlertTitle>Не удалось загрузить клиентов</AlertTitle>
          <AlertDescription className="flex flex-col gap-2">
            <span>Проверьте соединение и повторите попытку.</span>
            <Button type="button" variant="outline" size="sm" className="w-fit" onClick={() => void load()}>
              Повторить
            </Button>
          </AlertDescription>
        </Alert>
      ) : (
        <div className="flex flex-col gap-4 xl:flex-row xl:items-start">
          {listCard}
          {isDesktop ? (
            <Card className="min-w-0 flex-1">
              <CardHeader>
                <CardTitle>Карточка клиента</CardTitle>
              </CardHeader>
              <CardContent>{dossierBody}</CardContent>
            </Card>
          ) : (
            <Sheet open={sheetOpen} onOpenChange={setSheetOpen}>
              <SheetContent className="overflow-y-auto">
                <SheetHeader>
                  <SheetTitle>{profile?.fullName || selected?.name || 'Клиент'}</SheetTitle>
                  <SheetDescription>История обращений, записи и контакты.</SheetDescription>
                </SheetHeader>
                <div className="px-4 pb-6">{dossierBody}</div>
              </SheetContent>
            </Sheet>
          )}
        </div>
      )}
    </div>
  );
}
