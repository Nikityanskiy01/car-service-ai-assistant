import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { getClientDossier, getGuestDossier, listServiceRequests } from '../../api/dashboard';
import { prefillBookingFromConsultation } from '../../features/services/prefill';
import { PageHeader } from '../../components/layout/dashboard/PageHeader';
import { Button } from '../../components/ui/Button';
import { Card } from '../../components/ui/Card';
import { EmptyState } from '../../components/ui/EmptyState';
import { ErrorState } from '../../components/ui/ErrorState';
import { Loader } from '../../components/ui/Loader';
import { StatusBadge } from '../../components/ui/StatusBadge';
import { Tabs } from '../../components/ui/Tabs';
import { usePageMeta } from '../../hooks/usePageMeta';
import type { ClientDossier, GuestDossier } from '../../types/dashboard';

type ClientFilter = 'all' | 'active' | 'guests';
type ClientSort = 'activity' | 'name';
type ClientTab = 'history' | 'bookings' | 'consultations';

type ClientRow = {
  key: string;
  name: string;
  phone: string;
  email?: string;
  clientId?: string;
  guestPhone?: string;
  activeRequests: number;
  isGuest: boolean;
};

type ManagerClientsPageProps = {
  adminZone?: boolean;
};

export function ManagerClientsPage({ adminZone = false }: ManagerClientsPageProps) {
  usePageMeta({
    title: adminZone ? 'Клиенты — операции' : 'Клиенты',
    description: 'Карточки клиентов и история обращений.',
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [clients, setClients] = useState<ClientRow[]>([]);
  const [search, setSearch] = useState('');
  const [selectedKey, setSelectedKey] = useState<string | null>(null);
  const [dossier, setDossier] = useState<ClientDossier | null>(null);
  const [guestDossier, setGuestDossier] = useState<GuestDossier | null>(null);
  const [dossierLoading, setDossierLoading] = useState(false);
  const [clientFilter, setClientFilter] = useState<ClientFilter>('all');
  const [clientSort, setClientSort] = useState<ClientSort>('activity');
  const [clientTab, setClientTab] = useState<ClientTab>('history');
  const navigate = useNavigate();

  useEffect(() => {
    void listServiceRequests({ pageSize: 200 })
      .then((data) => {
        const map = new Map<string, ClientRow>();
        for (const r of data.items) {
          const phone = r.client?.phone || r.guestPhone || '';
          const key = r.clientId || `guest:${phone || r.guestName || r.id}`;
          const existing = map.get(key);
          const active = ['NEW', 'IN_PROGRESS', 'SCHEDULED'].includes(r.status) ? 1 : 0;
          if (existing) {
            existing.activeRequests += active;
          } else {
            map.set(key, {
              key,
              name: r.client?.fullName || r.guestName || 'Гость',
              phone: phone || '—',
              email: r.client?.email || undefined,
              clientId: r.clientId || undefined,
              guestPhone: !r.clientId && phone ? phone : undefined,
              activeRequests: active,
              isGuest: !r.clientId,
            });
          }
        }
        setClients(Array.from(map.values()));
      })
      .catch((e) => setError(e instanceof Error ? e.message : 'Ошибка загрузки'))
      .finally(() => setLoading(false));
  }, []);

  const filteredClients = useMemo(() => {
    const q = search.trim().toLowerCase();
    let list = [...clients];
    if (clientFilter === 'active') list = list.filter((c) => c.activeRequests > 0);
    if (clientFilter === 'guests') list = list.filter((c) => c.isGuest);
    list.sort((a, b) =>
      clientSort === 'name'
        ? a.name.localeCompare(b.name)
        : b.activeRequests - a.activeRequests || a.name.localeCompare(b.name),
    );
    if (!q) return list;
    return list.filter(
      (c) =>
        c.name.toLowerCase().includes(q) ||
        c.phone.toLowerCase().includes(q) ||
        (c.email || '').toLowerCase().includes(q),
    );
  }, [clients, search, clientFilter, clientSort]);

  async function openClient(client: ClientRow) {
    setSelectedKey(client.key);
    setDossierLoading(true);
    setDossier(null);
    setGuestDossier(null);
    try {
      if (client.clientId) {
        const data = await getClientDossier(client.clientId);
        setDossier(data);
      } else if (client.guestPhone) {
        const data = await getGuestDossier(client.guestPhone);
        setGuestDossier(data);
      }
    } catch {
      setDossier(null);
      setGuestDossier(null);
    } finally {
      setDossierLoading(false);
    }
  }

  if (loading) return <Loader />;
  if (error) return <ErrorState message={error} />;

  const profile = dossier?.profile || guestDossier?.profile;

  const timeline = useMemo(() => {
    if (!adminZone || !profile) return [];
    const items: Array<{ at: string; type: string; title: string; meta?: string }> = [];
    for (const r of dossier?.requests || guestDossier?.requests || []) {
      items.push({
        at: r.createdAt,
        type: 'request',
        title: 'Заявка',
        meta: r.status,
      });
    }
    for (const b of dossier?.bookings || guestDossier?.bookings || []) {
      items.push({
        at: b.preferredAt,
        type: 'booking',
        title: 'Запись',
        meta: b.status,
      });
    }
    for (const c of dossier?.consultations || []) {
      items.push({
        at: c.createdAt,
        type: 'consultation',
        title: 'Консультация ИИ',
        meta: c.status,
      });
    }
    for (const c of guestDossier?.contacts || []) {
      items.push({
        at: c.createdAt,
        type: 'contact',
        title: 'Обращение с сайта',
        meta: c.status,
      });
    }
    return items.sort((a, b) => b.at.localeCompare(a.at));
  }, [adminZone, dossier, guestDossier, profile]);

  return (
    <div className="stack dashboard-page">
      <PageHeader
        title="Клиенты"
        description="Контакты, автомобили и активные заявки."
        breadcrumbs={
          adminZone
            ? [
                { label: 'Пульт', to: '/dashboard/admin' },
                { label: 'Операции' },
                { label: 'Клиенты' },
              ]
            : [
                { label: 'Рабочий стол', to: '/dashboard/manager' },
                { label: 'Клиенты' },
              ]
        }
      />

      <div className="grid two">
        <Card>
          <h2>Список клиентов</h2>
          <div className="filter-bar-row client-filters">
            <Tabs
              value={clientFilter}
              onChange={(v) => setClientFilter(v as ClientFilter)}
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
              aria-label="Сортировка"
            >
              <option value="activity">По активности</option>
              <option value="name">По имени</option>
            </select>
          </div>
          <input
            type="search"
            className="client-search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Поиск по имени или телефону"
            aria-label="Поиск клиентов"
          />
          {!filteredClients.length ? (
            <EmptyState title="Клиентов не найдено" description="Попробуйте другой запрос." />
          ) : (
            <ul className="client-list">
              {filteredClients.map((c) => (
                <li key={c.key}>
                  <button
                    type="button"
                    className={selectedKey === c.key ? 'active' : ''}
                    onClick={() => void openClient(c)}
                  >
                    <strong>{c.name}</strong>
                    <span>{c.phone}</span>
                    {c.isGuest ? <em className="guest-tag">гость</em> : null}
                    {c.activeRequests ? <em>{c.activeRequests} активн.</em> : null}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </Card>

        <Card>
          <h2>Карточка клиента</h2>
          {dossierLoading ? <Loader /> : null}
          {!selectedKey || !profile ? (
            <EmptyState title="Выберите клиента" description="Нажмите на строку в списке слева." />
          ) : (
            <div className="stack">
              <p>
                <strong>{profile.fullName}</strong>
                {'isGuest' in profile && profile.isGuest ? (
                  <span className="guest-tag"> · гость</span>
                ) : null}
              </p>
              <p>
                Телефон:{' '}
                {profile.phone ? (
                  <a href={`tel:${profile.phone}`} className="contact-link">
                    {profile.phone}
                  </a>
                ) : (
                  '—'
                )}
              </p>
              {'email' in profile && profile.email ? <p>Email: {profile.email}</p> : null}
              {'createdAt' in profile && profile.createdAt ? (
                <p className="muted">
                  Клиент с {new Date(profile.createdAt).toLocaleDateString('ru-RU')}
                </p>
              ) : null}

              {(dossier?.vehicles || []).length ? (
                <>
                  <h3>Автомобили</h3>
                  <ul className="simple-list">
                    {dossier!.vehicles.map((v, i) => (
                      <li key={`${v.make}-${v.model}-${i}`}>
                        {[v.make, v.model, v.year].filter(Boolean).join(' ')}
                      </li>
                    ))}
                  </ul>
                </>
              ) : null}

              {(dossier?.metrics || guestDossier?.metrics) ? (
                <div className="client-metrics-row">
                  <div>
                    <span className="muted">Заявок</span>
                    <strong>{(dossier?.metrics || guestDossier?.metrics)?.requestsTotal ?? 0}</strong>
                  </div>
                  <div>
                    <span className="muted">Завершено</span>
                    <strong>{(dossier?.metrics || guestDossier?.metrics)?.completedRequests ?? 0}</strong>
                  </div>
                  <div>
                    <span className="muted">LTV</span>
                    <strong>
                      {new Intl.NumberFormat('ru-RU', {
                        style: 'currency',
                        currency: 'RUB',
                        maximumFractionDigits: 0,
                      }).format(((dossier?.metrics || guestDossier?.metrics)?.ltvMinor ?? 0) / 100)}
                    </strong>
                  </div>
                </div>
              ) : null}

              <Tabs
                value={clientTab}
                onChange={(v) => setClientTab(v as ClientTab)}
                items={[
                  { id: 'history', label: 'История' },
                  { id: 'bookings', label: 'Записи' },
                  { id: 'consultations', label: 'Консультации' },
                ]}
              />

              {clientTab === 'history' ? (
                <>
                  <h3>Заявки</h3>
                  <ul className="simple-list">
                    {(dossier?.requests || guestDossier?.requests || []).map((r) => (
                      <li key={r.id}>
                        <Link
                          to={
                            adminZone
                              ? `/dashboard/admin/operations/requests/${r.id}`
                              : `/dashboard/manager/requests/${r.id}`
                          }
                        >
                          <StatusBadge status={r.status} />
                          <span>{new Date(r.createdAt).toLocaleDateString('ru-RU')}</span>
                          {'snapshotMake' in r && (r.snapshotMake || r.snapshotModel) ? (
                            <span className="muted">
                              {[r.snapshotMake, r.snapshotModel].filter(Boolean).join(' ')}
                            </span>
                          ) : null}
                        </Link>
                      </li>
                    ))}
                  </ul>
                </>
              ) : null}

              {clientTab === 'bookings' ? (
                <>
                  <h3>Записи</h3>
                  {(dossier?.bookings || guestDossier?.bookings || []).length ? (
                    <ul className="simple-list">
                      {(dossier?.bookings || guestDossier?.bookings || []).map((b) => (
                        <li key={b.id}>
                          <span>{new Date(b.preferredAt).toLocaleString('ru-RU')}</span>
                          <StatusBadge status={b.status} />
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className="muted">Записей нет.</p>
                  )}
                </>
              ) : null}

              {clientTab === 'consultations' ? (
                <>
                  <h3>Консультации ИИ</h3>
                  {dossier?.consultations?.length ? (
                    <ul className="simple-list">
                      {dossier.consultations.map((c) => (
                        <li key={c.id}>
                          <span>{new Date(c.createdAt).toLocaleString('ru-RU')}</span>
                          <StatusBadge status={c.status} />
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className="muted">Консультаций нет (для гостей история в заявках).</p>
                  )}
                </>
              ) : null}

              {guestDossier?.contacts?.length ? (
                <>
                  <h3>Обращения с сайта</h3>
                  <ul className="simple-list">
                    {guestDossier.contacts.map((c) => (
                      <li key={c.id}>
                        <span>{c.fullName}</span>
                        <span className="muted">{c.message?.slice(0, 40) || '—'}</span>
                      </li>
                    ))}
                  </ul>
                </>
              ) : null}

              {adminZone && timeline.length ? (
                <>
                  <h3>Таймлайн взаимодействий</h3>
                  <ul className="client-timeline">
                    {timeline.map((item, index) => (
                      <li key={`${item.type}-${item.at}-${index}`}>
                        <time>{new Date(item.at).toLocaleString('ru-RU')}</time>
                        <strong>{item.title}</strong>
                        {item.meta ? <StatusBadge status={item.meta} /> : null}
                      </li>
                    ))}
                  </ul>
                </>
              ) : null}

              <div className="client-action-row">
                {profile.phone ? (
                  <a href={`tel:${profile.phone}`}>
                    <Button variant="secondary">Позвонить</Button>
                  </a>
                ) : null}
                {'email' in profile && profile.email ? (
                  <a href={`mailto:${profile.email}`}>
                    <Button variant="ghost">Написать</Button>
                  </a>
                ) : profile.phone ? (
                  <a href={`sms:${profile.phone}`}>
                    <Button variant="ghost">Написать</Button>
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
                  Создать запись
                </Button>
              </div>
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}
