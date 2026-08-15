import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { CalendarPlus, Phone, RefreshCw, Send } from 'lucide-react';
import { getClientDossier, getGuestDossier, listServiceRequests } from '../../api/dashboard';
import { prefillBookingFromConsultation } from '../../features/services/prefill';
import { managerZonePaths } from '../../config/managerPaths';
import { PageHeader } from '../../components/layout/dashboard/PageHeader';
import { Button } from '../../components/ui/Button';
import { Card } from '../../components/ui/Card';
import { CopyPhoneButton } from '../../components/ui/CopyPhoneButton';
import { EmptyState } from '../../components/ui/EmptyState';
import { ErrorState } from '../../components/ui/ErrorState';
import { Loader } from '../../components/ui/Loader';
import { Skeleton } from '../../components/ui/Skeleton';
import { StatusBadge } from '../../components/ui/StatusBadge';
import { Tabs } from '../../components/ui/Tabs';
import { useDebouncedValue } from '../../hooks/useDebouncedValue';
import { usePageMeta } from '../../hooks/usePageMeta';
import { formatRequestNumber } from '../../lib/labels';
import type { ClientDossier, GuestDossier } from '../../types/dashboard';

type ClientFilter = 'all' | 'active' | 'guests';
type ClientSort = 'activity' | 'recent' | 'name';
type ClientTab = 'history' | 'bookings' | 'consultations' | 'timeline';

type ClientRow = {
  key: string;
  name: string;
  phone: string;
  email?: string;
  clientId?: string;
  guestPhone?: string;
  activeRequests: number;
  totalRequests: number;
  lastActivityAt: string;
  isGuest: boolean;
};

type TimelineEntry = {
  at: string;
  type: string;
  title: string;
  meta?: string;
};

type ManagerClientsPageProps = {
  adminZone?: boolean;
};

const ACTIVE_STATUSES = ['NEW', 'IN_PROGRESS', 'SCHEDULED'];

const currency = new Intl.NumberFormat('ru-RU', {
  style: 'currency',
  currency: 'RUB',
  maximumFractionDigits: 0,
});

export function ManagerClientsPage({ adminZone = false }: ManagerClientsPageProps) {
  usePageMeta({
    title: adminZone ? 'Клиенты — операции' : 'Клиенты',
    description: 'Карточки клиентов и история обращений.',
  });
  const paths = managerZonePaths(adminZone);
  const navigate = useNavigate();

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [clients, setClients] = useState<ClientRow[]>([]);
  const [search, setSearch] = useState('');
  const [selectedKey, setSelectedKey] = useState<string | null>(null);
  const [dossier, setDossier] = useState<ClientDossier | null>(null);
  const [guestDossier, setGuestDossier] = useState<GuestDossier | null>(null);
  const [dossierLoading, setDossierLoading] = useState(false);
  const [dossierError, setDossierError] = useState<string | null>(null);
  const [clientFilter, setClientFilter] = useState<ClientFilter>('all');
  const [clientSort, setClientSort] = useState<ClientSort>('activity');
  const [clientTab, setClientTab] = useState<ClientTab>('history');

  const debouncedSearch = useDebouncedValue(search, 200);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await listServiceRequests({ pageSize: 200, sort: 'createdAt', dir: 'desc' });
      const map = new Map<string, ClientRow>();
      for (const request of data.items) {
        const phone = request.client?.phone || request.guestPhone || '';
        const key = request.clientId || `guest:${phone || request.guestName || request.id}`;
        const isActive = ACTIVE_STATUSES.includes(request.status);
        const existing = map.get(key);
        if (existing) {
          existing.activeRequests += isActive ? 1 : 0;
          existing.totalRequests += 1;
          if (request.createdAt > existing.lastActivityAt) existing.lastActivityAt = request.createdAt;
          continue;
        }
        map.set(key, {
          key,
          name: request.client?.fullName || request.guestName || 'Гость',
          phone: phone || '',
          email: request.client?.email || undefined,
          clientId: request.clientId || undefined,
          guestPhone: !request.clientId && phone ? phone : undefined,
          activeRequests: isActive ? 1 : 0,
          totalRequests: 1,
          lastActivityAt: request.createdAt,
          isGuest: !request.clientId,
        });
      }
      setClients(Array.from(map.values()));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Не удалось загрузить клиентов');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const filteredClients = useMemo(() => {
    const query = debouncedSearch.trim().toLowerCase();
    let list = clients;
    if (clientFilter === 'active') list = list.filter((item) => item.activeRequests > 0);
    if (clientFilter === 'guests') list = list.filter((item) => item.isGuest);
    if (query) {
      list = list.filter(
        (item) =>
          item.name.toLowerCase().includes(query) ||
          item.phone.toLowerCase().includes(query) ||
          (item.email || '').toLowerCase().includes(query),
      );
    }
    return [...list].sort((a, b) => {
      if (clientSort === 'name') return a.name.localeCompare(b.name, 'ru');
      if (clientSort === 'recent') return b.lastActivityAt.localeCompare(a.lastActivityAt);
      return b.activeRequests - a.activeRequests || a.name.localeCompare(b.name, 'ru');
    });
  }, [clients, debouncedSearch, clientFilter, clientSort]);

  const profile = dossier?.profile || guestDossier?.profile;
  const requests = useMemo(
    () => dossier?.requests || guestDossier?.requests || [],
    [dossier, guestDossier],
  );
  const bookings = useMemo(
    () => dossier?.bookings || guestDossier?.bookings || [],
    [dossier, guestDossier],
  );
  const metrics = dossier?.metrics || guestDossier?.metrics;

  const timeline = useMemo<TimelineEntry[]>(() => {
    if (!profile) return [];
    const items: TimelineEntry[] = [];
    for (const item of requests) {
      items.push({ at: item.createdAt, type: 'request', title: 'Заявка', meta: item.status });
    }
    for (const item of bookings) {
      items.push({ at: item.preferredAt, type: 'booking', title: 'Запись', meta: item.status });
    }
    for (const item of dossier?.consultations || []) {
      items.push({ at: item.createdAt, type: 'consultation', title: 'Консультация ИИ', meta: item.status });
    }
    for (const item of guestDossier?.contacts || []) {
      items.push({ at: item.createdAt, type: 'contact', title: 'Обращение с сайта', meta: item.status });
    }
    return items.sort((a, b) => b.at.localeCompare(a.at));
  }, [profile, requests, bookings, dossier, guestDossier]);

  const openClient = useCallback(async (client: ClientRow) => {
    setSelectedKey(client.key);
    setDossierLoading(true);
    setDossierError(null);
    setDossier(null);
    setGuestDossier(null);
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
  }, []);

  if (loading) {
    return (
      <div className="stack dashboard-page">
        <PageHeader title="Клиенты" description="Контакты, автомобили и активные заявки." />
        <div className="grid two">
          <Card>
            <Skeleton className="skeleton-line skeleton-line-lg" />
            <Skeleton className="skeleton-line" />
            <Skeleton className="skeleton-line" />
            <Skeleton className="skeleton-line" />
          </Card>
          <Card>
            <Skeleton className="skeleton-line skeleton-line-lg" />
            <Skeleton className="skeleton-block" />
          </Card>
        </div>
      </div>
    );
  }

  if (error) return <ErrorState message={error} onRetry={() => void load()} />;

  return (
    <div className="stack dashboard-page manager-clients-page">
      <PageHeader
        title="Клиенты"
        description="Контакты, автомобили и активные заявки."
        breadcrumbs={adminZone ? undefined : [
                { label: 'Рабочий стол', to: paths.root },
                { label: 'Клиенты' },
              ]
        }
        actions={
          <Button variant="ghost" onClick={() => void load()}>
            <RefreshCw size={16} aria-hidden />
            Обновить
          </Button>
        }
      />

      <div className="grid two manager-clients-grid">
        <Card className="client-list-card">
          <header className="card-section-header">
            <h2>Список клиентов</h2>
            <span className="muted tnum">{filteredClients.length} из {clients.length}</span>
          </header>
          <div className="filter-bar-row client-filters">
            <Tabs
              value={clientFilter}
              onChange={(value) => setClientFilter(value as ClientFilter)}
              items={[
                { id: 'all', label: 'Все' },
                { id: 'active', label: 'Активные' },
                { id: 'guests', label: 'Гости' },
              ]}
            />
            <select
              className="select"
              value={clientSort}
              onChange={(e) => setClientSort(e.target.value as ClientSort)}
              aria-label="Сортировка клиентов"
            >
              <option value="activity">По активности</option>
              <option value="recent">По дате обращения</option>
              <option value="name">По имени</option>
            </select>
          </div>
          <input
            type="search"
            className="client-search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Имя, телефон или email"
            aria-label="Поиск клиентов"
          />
          {!filteredClients.length ? (
            <EmptyState
              title="Клиентов не найдено"
              description={
                search
                  ? 'Уточните запрос или сбросьте фильтр.'
                  : 'Клиенты появятся здесь после первых обращений.'
              }
            />
          ) : (
            <ul className="client-list">
              {filteredClients.map((client) => (
                <li key={client.key}>
                  <button
                    type="button"
                    className={selectedKey === client.key ? 'active' : ''}
                    aria-current={selectedKey === client.key ? 'true' : undefined}
                    onClick={() => void openClient(client)}
                  >
                    <strong>{client.name}</strong>
                    <span className="tnum">{client.phone || 'Телефон не указан'}</span>
                    {client.isGuest ? <em className="guest-tag">гость</em> : null}
                    {client.activeRequests ? (
                      <em className="client-active-tag tnum">{client.activeRequests} в работе</em>
                    ) : null}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </Card>

        <Card className="client-detail-card">
          <h2>Карточка клиента</h2>
          {dossierLoading ? <Loader label="Загружаем историю…" /> : null}
          {!dossierLoading && dossierError ? <div className="alert alert-error">{dossierError}</div> : null}
          {!dossierLoading && !dossierError && (!selectedKey || !profile) ? (
            <EmptyState title="Выберите клиента" description="Нажмите на строку в списке слева." />
          ) : null}
          {!dossierLoading && profile ? (
            <div className="stack">
              <div className="client-identity">
                <div>
                  <strong className="client-identity-name">{profile.fullName}</strong>
                  {'isGuest' in profile && profile.isGuest ? <span className="guest-tag">гость</span> : null}
                </div>
                <div className="client-identity-contacts">
                  {profile.phone ? (
                    <span className="client-contact-line">
                      <a href={`tel:${profile.phone}`} className="contact-link tnum">
                        {profile.phone}
                      </a>
                      <CopyPhoneButton phone={profile.phone} label="" />
                    </span>
                  ) : (
                    <span className="muted">Телефон не указан</span>
                  )}
                  {'email' in profile && profile.email ? (
                    <a href={`mailto:${profile.email}`} className="contact-link">
                      {profile.email}
                    </a>
                  ) : null}
                  {'createdAt' in profile && profile.createdAt ? (
                    <span className="muted">
                      Клиент с {new Date(profile.createdAt).toLocaleDateString('ru-RU')}
                    </span>
                  ) : null}
                </div>
              </div>

              {metrics ? (
                <div className="client-metrics-row">
                  <div>
                    <span className="muted">Заявок</span>
                    <strong className="tnum">{metrics.requestsTotal ?? 0}</strong>
                  </div>
                  <div>
                    <span className="muted">Завершено</span>
                    <strong className="tnum">{metrics.completedRequests ?? 0}</strong>
                  </div>
                  <div>
                    <span className="muted">LTV</span>
                    <strong className="tnum">{currency.format((metrics.ltvMinor ?? 0) / 100)}</strong>
                  </div>
                </div>
              ) : null}

              {(dossier?.vehicles || []).length ? (
                <section>
                  <h3>Автомобили</h3>
                  <ul className="client-vehicle-list">
                    {dossier!.vehicles.map((vehicle, index) => (
                      <li key={`${vehicle.make}-${vehicle.model}-${index}`}>
                        {[vehicle.make, vehicle.model, vehicle.year].filter(Boolean).join(' ')}
                      </li>
                    ))}
                  </ul>
                </section>
              ) : null}

              <Tabs
                value={clientTab}
                onChange={(value) => setClientTab(value as ClientTab)}
                items={[
                  { id: 'history', label: `Заявки (${requests.length})` },
                  { id: 'bookings', label: `Записи (${bookings.length})` },
                  { id: 'consultations', label: 'Консультации' },
                  { id: 'timeline', label: 'Таймлайн' },
                ]}
              />

              {clientTab === 'history' ? (
                requests.length ? (
                  <ul className="client-record-list">
                    {requests.map((request) => (
                      <li key={request.id}>
                        <Link to={`${paths.requests}/${request.id}`}>
                          <span className="tnum">№{formatRequestNumber(request.id)}</span>
                          <StatusBadge status={request.status} />
                          <span className="muted tnum">
                            {new Date(request.createdAt).toLocaleDateString('ru-RU')}
                          </span>
                          {'snapshotMake' in request && (request.snapshotMake || request.snapshotModel) ? (
                            <span className="muted">
                              {[request.snapshotMake, request.snapshotModel].filter(Boolean).join(' ')}
                            </span>
                          ) : null}
                        </Link>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="muted">Заявок пока нет.</p>
                )
              ) : null}

              {clientTab === 'bookings' ? (
                bookings.length ? (
                  <ul className="client-record-list">
                    {bookings.map((booking) => (
                      <li key={booking.id}>
                        <span className="tnum">{new Date(booking.preferredAt).toLocaleString('ru-RU')}</span>
                        <StatusBadge status={booking.status} />
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="muted">Записей нет.</p>
                )
              ) : null}

              {clientTab === 'consultations' ? (
                dossier?.consultations?.length ? (
                  <ul className="client-record-list">
                    {dossier.consultations.map((consultation) => (
                      <li key={consultation.id}>
                        <span className="tnum">
                          {new Date(consultation.createdAt).toLocaleString('ru-RU')}
                        </span>
                        <StatusBadge status={consultation.status} />
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="muted">Консультаций нет. У гостей история собрана в заявках.</p>
                )
              ) : null}

              {clientTab === 'timeline' ? (
                timeline.length ? (
                  <ul className="client-timeline">
                    {timeline.map((item, index) => (
                      <li key={`${item.type}-${item.at}-${index}`}>
                        <time className="tnum">{new Date(item.at).toLocaleString('ru-RU')}</time>
                        <strong>{item.title}</strong>
                        {item.meta ? <StatusBadge status={item.meta} /> : null}
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="muted">Событий пока нет.</p>
                )
              ) : null}

              {guestDossier?.contacts?.length ? (
                <section>
                  <h3>Обращения с сайта</h3>
                  <ul className="client-record-list">
                    {guestDossier.contacts.map((contact) => (
                      <li key={contact.id}>
                        <span>{contact.fullName}</span>
                        <span className="muted">{contact.message?.slice(0, 60) || 'Без текста'}</span>
                      </li>
                    ))}
                  </ul>
                </section>
              ) : null}

              <div className="client-action-row">
                {profile.phone ? (
                  <a href={`tel:${profile.phone}`} className="btn btn-secondary">
                    <Phone size={16} aria-hidden />
                    Позвонить
                  </a>
                ) : null}
                {'email' in profile && profile.email ? (
                  <a href={`mailto:${profile.email}`} className="btn btn-ghost">
                    <Send size={16} aria-hidden />
                    Написать на почту
                  </a>
                ) : profile.phone ? (
                  <a href={`sms:${profile.phone}`} className="btn btn-ghost">
                    <Send size={16} aria-hidden />
                    Написать SMS
                  </a>
                ) : null}
                <Button
                  variant="ghost"
                  onClick={() => {
                    prefillBookingFromConsultation({
                      detail: null,
                      fullName: profile.fullName,
                      phone: profile.phone || undefined,
                    });
                    void navigate('/booking');
                  }}
                >
                  <CalendarPlus size={16} aria-hidden />
                  Создать запись
                </Button>
              </div>
            </div>
          ) : null}
        </Card>
      </div>
    </div>
  );
}
