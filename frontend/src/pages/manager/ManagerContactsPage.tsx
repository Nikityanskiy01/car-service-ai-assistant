import { useCallback, useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Phone } from 'lucide-react';
import { prefillConsultationGuest } from '../../features/services/prefill';
import {
  convertContactToRequest,
  listContacts,
  patchContactStatus,
} from '../../api/dashboard';
import { PageHeader } from '../../components/layout/dashboard/PageHeader';
import { Button } from '../../components/ui/Button';
import { Card } from '../../components/ui/Card';
import { EmptyState } from '../../components/ui/EmptyState';
import { ErrorState } from '../../components/ui/ErrorState';
import { Loader } from '../../components/ui/Loader';
import { Tabs } from '../../components/ui/Tabs';
import { CONTACT_STATUS_LABELS, CONTACT_SOURCE_LABELS } from '../../lib/labels';
import { usePageMeta } from '../../hooks/usePageMeta';
import type { ContactSubmission } from '../../types/dashboard';

type ManagerContactsPageProps = {
  adminZone?: boolean;
};

const STATUS_TABS = [
  { id: 'all', label: 'Все' },
  { id: 'NEW', label: 'Новые' },
  { id: 'IN_PROGRESS', label: 'В работе' },
  { id: 'CONVERTED', label: 'Конвертированы' },
  { id: 'CLOSED', label: 'Закрыты' },
];

export function ManagerContactsPage({ adminZone = false }: ManagerContactsPageProps) {
  usePageMeta({
    title: adminZone ? 'Обращения — операции' : 'Входящие',
    description: 'Сообщения из формы обратной связи.',
  });
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [contacts, setContacts] = useState<ContactSubmission[]>([]);
  const [statusTab, setStatusTab] = useState('NEW');
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const status = statusTab === 'all' ? undefined : statusTab;
      setContacts(await listContacts(status));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Ошибка загрузки');
    } finally {
      setLoading(false);
    }
  }, [statusTab]);

  useEffect(() => {
    void load();
  }, [load]);

  async function handleStatus(contactId: string, status: 'IN_PROGRESS' | 'CLOSED') {
    setActionLoading(contactId);
    try {
      await patchContactStatus(contactId, { status });
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Не удалось обновить статус');
    } finally {
      setActionLoading(null);
    }
  }

  async function handleConvert(contactId: string) {
    setActionLoading(contactId);
    try {
      const out = await convertContactToRequest(contactId);
      await load();
      void navigate(`/dashboard/manager/requests/${out.requestId}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Не удалось создать заявку');
    } finally {
      setActionLoading(null);
    }
  }

  if (loading) return <Loader />;
  if (error) return <ErrorState message={error} onRetry={() => void load()} />;

  return (
    <div className="stack dashboard-page">
      <PageHeader
        title={adminZone ? 'Обращения' : 'Входящие'}
        description="Новые контакты и вопросы с публичных страниц."
        breadcrumbs={
          adminZone
            ? [
                { label: 'Пульт', to: '/dashboard/admin' },
                { label: 'Операции' },
                { label: 'Обращения' },
              ]
            : [
                { label: 'Рабочий стол', to: '/dashboard/manager' },
                { label: 'Входящие' },
              ]
        }
      />

      <Tabs value={statusTab} onChange={setStatusTab} items={STATUS_TABS} />

      <Card>
        {!contacts.length ? (
          <EmptyState title="Обращений нет" description="Все сообщения в этом статусе обработаны." />
        ) : (
          <ul className="contact-workflow-list">
            {contacts.map((item) => (
              <li key={item.id} className="contact-workflow-item">
                <div className="contact-workflow-body">
                  <header>
                    <strong>{item.fullName}</strong>
                    <span className={`contact-status contact-status-${(item.status || 'NEW').toLowerCase()}`}>
                      {CONTACT_STATUS_LABELS[item.status || 'NEW']}
                    </span>
                  </header>
                  <a href={`tel:${item.phone}`} className="contact-link">
                    {item.phone}
                  </a>
                  <p>{item.message || 'Без текста'}</p>
                  {item.source ? (
                    <span className="contact-source-tag">
                      {CONTACT_SOURCE_LABELS[item.source] || item.source}
                    </span>
                  ) : null}
                  {item.createdAt ? (
                    <small className="muted">{new Date(item.createdAt).toLocaleString('ru-RU')}</small>
                  ) : null}
                  {item.convertedRequestId ? (
                    <Link to={`/dashboard/manager/requests/${item.convertedRequestId}`} className="muted">
                      Заявка создана →
                    </Link>
                  ) : null}
                </div>
                <div className="contact-workflow-actions">
                  <a href={`tel:${item.phone}`} className="btn btn-ghost btn-icon" aria-label="Позвонить">
                    <Phone size={16} />
                  </a>
                  {item.status !== 'CONVERTED' && item.status !== 'CLOSED' ? (
                    <>
                      {item.status === 'NEW' ? (
                        <Button
                          variant="secondary"
                          disabled={actionLoading === item.id}
                          onClick={() => void handleStatus(item.id, 'IN_PROGRESS')}
                        >
                          В работу
                        </Button>
                      ) : null}
                      <Button
                        disabled={actionLoading === item.id}
                        onClick={() => void handleConvert(item.id)}
                      >
                        Создать заявку
                      </Button>
                      <Button
                        variant="ghost"
                        disabled={actionLoading === item.id}
                        onClick={() => {
                          prefillConsultationGuest({ fullName: item.fullName, phone: item.phone });
                          void navigate('/consult');
                        }}
                      >
                        Запустить консультацию
                      </Button>
                      <Button
                        variant="ghost"
                        disabled={actionLoading === item.id}
                        onClick={() => void handleStatus(item.id, 'CLOSED')}
                      >
                        Закрыть
                      </Button>
                    </>
                  ) : null}
                </div>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}
