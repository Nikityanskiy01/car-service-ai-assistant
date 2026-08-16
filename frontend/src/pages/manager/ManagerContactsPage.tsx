import { useCallback, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { RefreshCw } from 'lucide-react';
import { toast } from '../../lib/toast';
import { prefillConsultationGuest } from '../../features/services/prefill';
import { convertContactToRequest, listContacts, patchContactStatus } from '../../api/dashboard';
import { ContactInboxItem } from '../../components/manager/ContactInboxItem';
import { Alert, AlertDescription, AlertTitle } from '../../components/console/ui/alert';
import { Button } from '../../components/console/ui/button';
import { managerZonePaths } from '../../config/managerPaths';
import { HintTooltip } from '../../components/manager/help/HintLabel';
import { usePageMeta } from '../../hooks/usePageMeta';
import type { ContactSubmission } from '../../types/dashboard';

type ManagerContactsPageProps = {
  adminZone?: boolean;
};

type StatusTab = 'NEW' | 'IN_PROGRESS' | 'CONVERTED' | 'CLOSED' | 'all';

const STATUS_TABS: { id: StatusTab; label: string; hint?: string }[] = [
  { id: 'NEW', label: 'Новые', hint: 'Клиент написал с формы. Позвоните.' },
  { id: 'IN_PROGRESS', label: 'В работе', hint: 'Вы занялись, коллеги не дублируют звонок.' },
  { id: 'CONVERTED', label: 'Заявки', hint: 'Уже создали обращение в очереди.' },
  { id: 'CLOSED', label: 'Закрыты', hint: 'Без заявки: спам, ошибка или клиент передумал.' },
  { id: 'all', label: 'Все' },
];

function emptyCopy(tab: StatusTab) {
  if (tab === 'NEW') {
    return {
      title: 'Новых нет',
      description: 'Как клиент отправит форму, сообщение появится здесь.',
    };
  }
  if (tab === 'IN_PROGRESS') {
    return {
      title: 'Никто не на звонке',
      description: 'На «Новых» нажмите «В работу», чтобы коллеги видели, что вы занялись.',
    };
  }
  if (tab === 'CONVERTED') {
    return {
      title: 'Заявок из сообщений нет',
      description: 'Когда клиент готов, «Создать заявку» откроет очередь.',
    };
  }
  if (tab === 'CLOSED') {
    return {
      title: 'Закрытых нет',
      description: 'Сюда попадают сообщения, которые закрыли без заявки.',
    };
  }
  return {
    title: 'Пока тихо',
    description: 'С формы приходят имя, телефон и текст.',
  };
}

function pulseUnit(count: number) {
  const mod10 = count % 10;
  const mod100 = count % 100;
  if (mod10 === 1 && mod100 !== 11) return 'новое';
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) return 'новых';
  return 'новых';
}

export function ManagerContactsPage({ adminZone = false }: ManagerContactsPageProps) {
  usePageMeta({
    title: 'Сообщения с сайта',
    description: 'Пишут с формы на сайте. Позвоните, затем создайте заявку.',
  });

  const paths = managerZonePaths(adminZone);
  const navigate = useNavigate();
  const [statusTab, setStatusTab] = useState<StatusTab>('NEW');
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  const contactsQuery = useQuery({
    queryKey: ['manager-contacts'],
    queryFn: () => listContacts(),
    refetchInterval: 60_000,
    refetchIntervalInBackground: false,
  });
  const contacts = useMemo(() => contactsQuery.data ?? [], [contactsQuery.data]);
  const firstLoad = contactsQuery.isPending && !contactsQuery.data;
  const refreshing = contactsQuery.isFetching && !contactsQuery.isPending;
  const error = contactsQuery.error instanceof Error ? contactsQuery.error.message : null;

  const load = useCallback(async () => {
    await contactsQuery.refetch();
  }, [contactsQuery.refetch]);

  const counts = useMemo(() => {
    const next = { NEW: 0, IN_PROGRESS: 0, CONVERTED: 0, CLOSED: 0, all: contacts.length };
    for (const item of contacts) {
      const status = item.status || 'NEW';
      if (status in next) next[status as Exclude<StatusTab, 'all'>] += 1;
    }
    return next;
  }, [contacts]);

  const visible = useMemo(
    () => (statusTab === 'all' ? contacts : contacts.filter((item) => (item.status || 'NEW') === statusTab)),
    [contacts, statusTab],
  );

  async function handleStatus(contact: ContactSubmission, status: 'IN_PROGRESS' | 'CLOSED') {
    setActionLoading(contact.id);
    try {
      await patchContactStatus(contact.id, { status });
      await contactsQuery.refetch();
      toast.success(status === 'CLOSED' ? 'Закрыто без заявки' : 'В работе', {
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

  const empty = emptyCopy(statusTab);
  const newCount = counts.NEW;

  return (
    <div className="contacts-inbox">
      <header className="contacts-chrome">
        <div className="contacts-chrome-mast">
          <p className="contacts-chrome-kicker">С формы на сайте</p>
          <h1 className={`contacts-pulse${newCount > 0 ? ' is-hot' : ''}`}>
            <span className="tnum">{firstLoad ? '—' : newCount}</span>
            <span className="contacts-pulse-unit">{pulseUnit(newCount)}</span>
          </h1>
          <p className="contacts-chrome-note">Позвоните, затем создайте заявку в очередь.</p>
        </div>

        <div className="contacts-chrome-dock">
          <div className="contacts-tabs" role="tablist" aria-label="Статус сообщений">
            {STATUS_TABS.map((tab) => {
              const count = counts[tab.id];
              const selected = statusTab === tab.id;
              return (
                <HintTooltip key={tab.id} hint={tab.hint}>
                  <button
                    type="button"
                    role="tab"
                    aria-selected={selected}
                    className="contacts-tab"
                    onClick={() => setStatusTab(tab.id)}
                  >
                    {tab.label}
                    <span className={`tnum${tab.id === 'NEW' && count > 0 ? ' is-hot' : ''}`}>{count}</span>
                  </button>
                </HintTooltip>
              );
            })}
          </div>
          <Button type="button" variant="ghost" size="icon" onClick={() => void load()} disabled={refreshing} aria-label="Обновить">
            <RefreshCw className={refreshing ? 'is-spinning' : undefined} />
          </Button>
        </div>
      </header>

      {error ? (
        <Alert variant="destructive">
          <AlertTitle>Не удалось загрузить сообщения</AlertTitle>
          <AlertDescription className="flex flex-col gap-2">
            <span>Проверьте соединение и повторите попытку.</span>
            <Button type="button" variant="outline" size="sm" className="w-fit" onClick={() => void load()}>
              Повторить
            </Button>
          </AlertDescription>
        </Alert>
      ) : null}

      <div className="contacts-shell">
        {firstLoad ? (
          <div className="contacts-stack" aria-hidden>
            <div className="contacts-skel" />
            <div className="contacts-skel" />
            <div className="contacts-skel" />
          </div>
        ) : null}

        {!firstLoad && !error && !visible.length ? (
          <div className="contacts-empty" role="status">
            <strong>{empty.title}</strong>
            <p>{empty.description}</p>
          </div>
        ) : null}

        {!firstLoad && !error && visible.length ? (
          <div className="contacts-stack">
            {visible.map((item) => (
              <ContactInboxItem
                key={item.id}
                item={item}
                busy={actionLoading === item.id}
                showStatus={statusTab === 'all'}
                requestHref={item.convertedRequestId ? `${paths.requests}/${item.convertedRequestId}` : null}
                onTake={() => void handleStatus(item, 'IN_PROGRESS')}
                onConvert={() => void handleConvert(item)}
                onClose={() => void handleStatus(item, 'CLOSED')}
                onConsult={() => {
                  prefillConsultationGuest({ fullName: item.fullName, phone: item.phone });
                  void navigate('/consult');
                }}
              />
            ))}
          </div>
        ) : null}
      </div>
    </div>
  );
}
