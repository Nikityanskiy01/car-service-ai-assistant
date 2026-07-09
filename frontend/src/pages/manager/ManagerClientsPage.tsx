import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { getClientDossier, listServiceRequests } from '../../api/dashboard';
import { PageHeader } from '../../components/layout/dashboard/PageHeader';
import { Card } from '../../components/ui/Card';
import { EmptyState } from '../../components/ui/EmptyState';
import { ErrorState } from '../../components/ui/ErrorState';
import { Loader } from '../../components/ui/Loader';
import { StatusBadge } from '../../components/ui/StatusBadge';
import { usePageMeta } from '../../hooks/usePageMeta';
import type { ClientDossier } from '../../types/dashboard';

type ClientRow = {
  key: string;
  name: string;
  phone: string;
  email?: string;
  clientId?: string;
  activeRequests: number;
};

export function ManagerClientsPage() {
  usePageMeta({ title: 'Клиенты', description: 'Карточки клиентов и история обращений.' });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [clients, setClients] = useState<ClientRow[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [dossier, setDossier] = useState<ClientDossier | null>(null);
  const [dossierLoading, setDossierLoading] = useState(false);

  useEffect(() => {
    void listServiceRequests({ pageSize: 200 })
      .then((data) => {
        const map = new Map<string, ClientRow>();
        for (const r of data.items) {
          const key = r.clientId || `guest:${r.guestPhone || r.guestName || r.id}`;
          const existing = map.get(key);
          const active = ['NEW', 'IN_PROGRESS', 'SCHEDULED'].includes(r.status) ? 1 : 0;
          if (existing) {
            existing.activeRequests += active;
          } else {
            map.set(key, {
              key,
              name: r.client?.fullName || r.guestName || 'Гость',
              phone: r.client?.phone || r.guestPhone || '—',
              email: r.client?.email || undefined,
              clientId: r.clientId || undefined,
              activeRequests: active,
            });
          }
        }
        setClients(Array.from(map.values()));
      })
      .catch((e) => setError(e instanceof Error ? e.message : 'Ошибка загрузки'))
      .finally(() => setLoading(false));
  }, []);

  const sortedClients = useMemo(
    () => [...clients].sort((a, b) => b.activeRequests - a.activeRequests || a.name.localeCompare(b.name)),
    [clients],
  );

  async function openDossier(clientId: string) {
    setSelectedId(clientId);
    setDossierLoading(true);
    try {
      const data = await getClientDossier(clientId);
      setDossier(data);
    } catch {
      setDossier(null);
    } finally {
      setDossierLoading(false);
    }
  }

  if (loading) return <Loader />;
  if (error) return <ErrorState message={error} />;

  return (
    <div className="stack dashboard-page">
      <PageHeader
        title="Клиенты"
        description="Контакты, автомобили и активные заявки."
        breadcrumbs={[
          { label: 'Рабочий стол', to: '/dashboard/manager' },
          { label: 'Клиенты' },
        ]}
      />

      <div className="grid two">
        <Card>
          <h2>Список клиентов</h2>
          {!sortedClients.length ? (
            <EmptyState title="Клиентов пока нет" description="Они появятся после первых заявок." />
          ) : (
            <ul className="client-list">
              {sortedClients.map((c) => (
                <li key={c.key}>
                  <button
                    type="button"
                    className={selectedId === c.clientId ? 'active' : ''}
                    onClick={() => (c.clientId ? void openDossier(c.clientId) : setSelectedId(null))}
                    disabled={!c.clientId}
                  >
                    <strong>{c.name}</strong>
                    <span>{c.phone}</span>
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
          {!selectedId || !dossier ? (
            <EmptyState
              title="Выберите клиента"
              description="Для гостевых обращений без регистрации досье недоступно."
            />
          ) : (
            <div className="stack">
              <p>
                <strong>{dossier.profile.fullName}</strong>
              </p>
              <p>Телефон: {dossier.profile.phone || '—'}</p>
              <p>Email: {dossier.profile.email}</p>
              <h3>Заявки</h3>
              <ul className="simple-list">
                {dossier.requests.map((r) => (
                  <li key={r.id}>
                    <Link to={`/dashboard/manager/requests/${r.id}`}>
                      <StatusBadge status={r.status} />
                      <span>{new Date(r.createdAt).toLocaleDateString('ru-RU')}</span>
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}
