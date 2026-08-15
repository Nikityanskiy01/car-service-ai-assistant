import { useCallback, useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { MessagesSquare, Phone, RefreshCw } from 'lucide-react';
import { prefillConsultationGuest } from '../../features/services/prefill';
import { convertContactToRequest, listContacts, patchContactStatus } from '../../api/dashboard';
import { PageHeader } from '../../components/layout/dashboard/PageHeader';
import { Button } from '../../components/ui/Button';
import { Card } from '../../components/ui/Card';
import { CopyPhoneButton } from '../../components/ui/CopyPhoneButton';
import { EmptyState } from '../../components/ui/EmptyState';
import { ErrorState } from '../../components/ui/ErrorState';
import { Skeleton } from '../../components/ui/Skeleton';
import { Tabs } from '../../components/ui/Tabs';
import { useToast } from '../../components/ui/toastContext';
import { managerZonePaths } from '../../config/managerPaths';
import { CONTACT_STATUS_LABELS, CONTACT_SOURCE_LABELS } from '../../lib/labels';
import { formatRelativeTime } from '../../lib/managerRequestHelpers';
import { useDashboardPolling } from '../../hooks/useDashboardPolling';
import { usePageMeta } from '../../hooks/usePageMeta';
import type { ContactSubmission } from '../../types/dashboard';

type ManagerContactsPageProps = {
  adminZone?: boolean;
};

const STATUS_TABS = [
  { id: 'NEW', label: 'Новые' },
  { id: 'IN_PROGRESS', label: 'В работе' },
  { id: 'CONVERTED', label: 'Конвертированы' },
  { id: 'CLOSED', label: 'Закрыты' },
  { id: 'all', label: 'Все' },
];

export function ManagerContactsPage({ adminZone = false }: ManagerContactsPageProps) {
  usePageMeta({
    title: adminZone ? 'Обращения — операции' : 'Входящие',
    description: 'Сообщения из формы обратной связи.',
  });

  const paths = managerZonePaths(adminZone);
  const navigate = useNavigate();
  const { success, error: toastError } = useToast();

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
      success(status === 'CLOSED' ? 'Обращение закрыто' : 'Обращение взято в работу', {
        description: contact.fullName,
      });
    } catch (e) {
      toastError(e instanceof Error ? e.message : 'Не удалось обновить статус');
    } finally {
      setActionLoading(null);
    }
  }

  async function handleConvert(contact: ContactSubmission) {
    setActionLoading(contact.id);
    try {
      const out = await convertContactToRequest(contact.id);
      success('Заявка создана', { description: contact.fullName });
      void navigate(`${paths.requests}/${out.requestId}`);
    } catch (e) {
      toastError(e instanceof Error ? e.message : 'Не удалось создать заявку');
      setActionLoading(null);
    }
  }

  return (
    <div className="stack dashboard-page manager-contacts-page">
      <PageHeader
        title={adminZone ? 'Обращения' : 'Входящие'}
        description="Контакты и вопросы с публичных страниц сайта."
        breadcrumbs={adminZone ? undefined : [
                { label: 'Рабочий стол', to: paths.root },
                { label: 'Входящие' },
              ]
        }
        actions={
          <Button variant="ghost" onClick={() => void load()}>
            <RefreshCw size={16} aria-hidden />
            Обновить
          </Button>
        }
      />

      <Tabs value={statusTab} onChange={setStatusTab} items={STATUS_TABS} />

      {error ? <ErrorState message={error} onRetry={() => void load()} /> : null}

      {firstLoad ? (
        <Card>
          <Skeleton className="skeleton-row" />
          <Skeleton className="skeleton-row" />
          <Skeleton className="skeleton-row" />
        </Card>
      ) : null}

      {!firstLoad && !error ? (
        <Card>
          {!contacts.length ? (
            <EmptyState
              title="Обращений нет"
              description={
                statusTab === 'NEW'
                  ? 'Все новые сообщения разобраны. Хорошая работа.'
                  : 'В этом статусе пока пусто.'
              }
            />
          ) : (
            <ul className="contact-workflow-list">
              {contacts.map((item) => {
                const busy = actionLoading === item.id;
                const status = item.status || 'NEW';
                const open = status !== 'CONVERTED' && status !== 'CLOSED';
                return (
                  <li key={item.id} className={`contact-workflow-item${busy ? ' is-busy' : ''}`}>
                    <div className="contact-workflow-body">
                      <header>
                        <strong>{item.fullName}</strong>
                        <span className={`contact-status contact-status-${status.toLowerCase()}`}>
                          {CONTACT_STATUS_LABELS[status]}
                        </span>
                        {item.createdAt ? (
                          <small className="muted tnum" title={new Date(item.createdAt).toLocaleString('ru-RU')}>
                            {formatRelativeTime(item.createdAt)}
                          </small>
                        ) : null}
                      </header>
                      <div className="contact-phone-row">
                        <a href={`tel:${item.phone}`} className="contact-link tnum">
                          {item.phone}
                        </a>
                        <CopyPhoneButton phone={item.phone} label="" />
                      </div>
                      <p>{item.message || 'Без текста'}</p>
                      <div className="contact-meta-row">
                        {item.source ? (
                          <span className="contact-source-tag">
                            {CONTACT_SOURCE_LABELS[item.source] || item.source}
                          </span>
                        ) : null}
                        {item.convertedRequestId ? (
                          <Link to={`${paths.requests}/${item.convertedRequestId}`}>
                            Открыть созданную заявку
                          </Link>
                        ) : null}
                      </div>
                    </div>
                    <div className="contact-workflow-actions">
                      <a href={`tel:${item.phone}`} className="btn btn-ghost btn-icon" aria-label="Позвонить">
                        <Phone size={16} aria-hidden />
                      </a>
                      {open ? (
                        <>
                          {status === 'NEW' ? (
                            <Button
                              variant="secondary"
                              disabled={busy}
                              onClick={() => void handleStatus(item, 'IN_PROGRESS')}
                            >
                              В работу
                            </Button>
                          ) : null}
                          <Button disabled={busy} onClick={() => void handleConvert(item)}>
                            Создать заявку
                          </Button>
                          <Button
                            variant="ghost"
                            disabled={busy}
                            onClick={() => {
                              prefillConsultationGuest({ fullName: item.fullName, phone: item.phone });
                              void navigate('/consult');
                            }}
                            title="Открыть ИИ-консультацию с данными клиента"
                          >
                            <MessagesSquare size={16} aria-hidden />
                            Консультация
                          </Button>
                          <Button
                            variant="ghost"
                            disabled={busy}
                            onClick={() => void handleStatus(item, 'CLOSED')}
                          >
                            Закрыть
                          </Button>
                        </>
                      ) : null}
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </Card>
      ) : null}
    </div>
  );
}
