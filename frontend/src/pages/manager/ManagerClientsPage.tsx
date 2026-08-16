import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { RefreshCw, Search } from 'lucide-react';
import { toast } from 'sonner';
import {
  getClientDossier,
  getGuestDossier,
  listClients,
  type ManagerClientCounts,
  type ManagerClientFilter,
  type ManagerClientRow,
  type ManagerClientSort,
} from '../../api/dashboard';
import { ClientDirectoryItem } from '../../components/manager/ClientDirectoryItem';
import { ClientDossierPanel, type ClientDossierTab } from '../../components/manager/ClientDossierPanel';
import { managerZonePaths } from '../../config/managerPaths';
import { prefillBookingFromConsultation } from '../../features/services/prefill';
import { useDebouncedValue } from '../../hooks/useDebouncedValue';
import { usePageMeta } from '../../hooks/usePageMeta';
import { copyText } from '../../lib/clipboard';
import { buildClientDossierView } from '../../lib/managerClientDossier';
import { Alert, AlertDescription, AlertTitle } from '../../components/console/ui/alert';
import { Button } from '../../components/console/ui/button';
import { Input } from '../../components/console/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../../components/console/ui/select';
import type { ClientDossier, GuestDossier } from '../../types/dashboard';

const PAGE_SIZE = 20;
const FILTERS: { id: ManagerClientFilter; label: string }[] = [
  { id: 'all', label: 'Все' },
  { id: 'active', label: 'Активные' },
  { id: 'guests', label: 'Гости' },
];

function emptyCopy(search: string) {
  if (search) {
    return {
      title: 'Никого не нашли',
      description: 'Уточните имя, телефон, марку или госномер.',
    };
  }
  return {
    title: 'Пока пусто',
    description: 'Клиенты появятся после первых обращений с сайта, записи или заявки.',
  };
}

export function ManagerClientsPage({ adminZone = false }: { adminZone?: boolean }) {
  usePageMeta({
    title: adminZone ? 'Клиенты — операции' : 'Клиенты',
    description: 'Гараж, заявки, записи и история клиента в одном кабинете.',
  });
  const paths = managerZonePaths(adminZone);
  const navigate = useNavigate();
  const dossierSeq = useRef(0);

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [clients, setClients] = useState<ManagerClientRow[]>([]);
  const [total, setTotal] = useState(0);
  const [counts, setCounts] = useState<ManagerClientCounts>({ all: 0, active: 0, guests: 0 });
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<ManagerClientFilter>('all');
  const [sort, setSort] = useState<ManagerClientSort>('activity');
  const [selectedKey, setSelectedKey] = useState<string | null>(null);
  const [dossier, setDossier] = useState<ClientDossier | null>(null);
  const [guestDossier, setGuestDossier] = useState<GuestDossier | null>(null);
  const [dossierLoading, setDossierLoading] = useState(false);
  const [dossierError, setDossierError] = useState<string | null>(null);
  const [clientTab, setClientTab] = useState<ClientDossierTab>('history');

  const debouncedSearch = useDebouncedValue(search, 200);

  const load = useCallback(
    async (silent = false) => {
      if (silent) setRefreshing(true);
      else {
        setLoading(true);
        setError(null);
      }
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
        setCounts(data.counts || { all: data.total, active: 0, guests: 0 });
        if (silent) setError(null);
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Не удалось загрузить клиентов');
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [debouncedSearch, filter, sort, page],
  );

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    setPage(1);
  }, [debouncedSearch, filter, sort]);

  const selected = clients.find((item) => item.key === selectedKey) || null;
  const view = useMemo(
    () => buildClientDossierView(selected, dossier, guestDossier),
    [selected, dossier, guestDossier],
  );

  const openClient = useCallback(async (client: ManagerClientRow) => {
    const seq = ++dossierSeq.current;
    setSelectedKey(client.key);
    setDossierLoading(true);
    setDossierError(null);
    setDossier(null);
    setGuestDossier(null);
    setClientTab('history');
    try {
      if (client.clientId) {
        const next = await getClientDossier(client.clientId);
        if (seq !== dossierSeq.current) return;
        setDossier(next);
      } else if (client.guestPhone) {
        const next = await getGuestDossier(client.guestPhone);
        if (seq !== dossierSeq.current) return;
        setGuestDossier(next);
      } else {
        if (seq !== dossierSeq.current) return;
        setDossierError('У гостя нет телефона, историю подтянуть не из чего.');
      }
    } catch (e) {
      if (seq !== dossierSeq.current) return;
      setDossierError(e instanceof Error ? e.message : 'Не удалось загрузить карточку клиента');
    } finally {
      if (seq === dossierSeq.current) setDossierLoading(false);
    }
  }, []);

  function closeDossier() {
    dossierSeq.current += 1;
    setSelectedKey(null);
    setDossier(null);
    setGuestDossier(null);
    setDossierError(null);
    setDossierLoading(false);
  }

  async function copyPhone(phone: string) {
    const ok = await copyText(phone);
    if (ok) toast.success('Телефон скопирован');
    else toast.error('Не удалось скопировать номер');
  }

  const pageCount = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const empty = emptyCopy(search);
  const dossierOpen = Boolean(selectedKey);
  const pulseActive = counts.active;

  return (
    <div className="manager-clients">
      <header className="manager-clients-chrome">
        <div className="manager-clients-mast">
          <p className="manager-clients-kicker">База</p>
          <h1 className={`manager-clients-pulse${pulseActive > 0 ? ' is-hot' : ''}`}>
            <span className="tnum">{loading && !clients.length ? '—' : pulseActive}</span>
            <span className="manager-clients-pulse-unit">в работе</span>
          </h1>
          <p className="manager-clients-note">
            {counts.all} в базе{search.trim() ? ' по поиску' : ''}. Звонок из строки, досье — по клику.
          </p>
        </div>
        <div className="manager-clients-dock">
          <div className="manager-clients-filters" role="tablist" aria-label="Фильтр клиентов">
            {FILTERS.map((item) => (
              <button
                key={item.id}
                type="button"
                role="tab"
                aria-selected={filter === item.id}
                className="manager-clients-filter"
                onClick={() => setFilter(item.id)}
              >
                {item.label}
                <span className={`tnum${item.id === 'active' && counts[item.id] > 0 ? ' is-hot' : ''}`}>
                  {counts[item.id]}
                </span>
              </button>
            ))}
          </div>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            onClick={() => void load(true)}
            disabled={refreshing}
            aria-label="Обновить список клиентов"
          >
            <RefreshCw className={refreshing ? 'is-spinning' : undefined} />
          </Button>
        </div>
      </header>

      <div className="manager-clients-toolbar">
        <div className="manager-clients-search">
          <Search className="manager-clients-search-icon" size={16} aria-hidden="true" />
          <Input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Имя, телефон, марка, номер"
            aria-label="Поиск клиентов"
            className="manager-clients-search-input"
          />
        </div>
        <Select value={sort} onValueChange={(value) => setSort(value as ManagerClientSort)}>
          <SelectTrigger className="manager-clients-sort" aria-label="Сортировка клиентов">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="activity">Сначала активные</SelectItem>
            <SelectItem value="recent">Сначала новые</SelectItem>
            <SelectItem value="name">По имени</SelectItem>
            <SelectItem value="ltv">По LTV</SelectItem>
          </SelectContent>
        </Select>
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
      ) : null}

      <div className={`manager-clients-cabin${dossierOpen ? ' is-open' : ''}`}>
        <div className="manager-clients-roster">
          {loading ? (
            <div aria-hidden>
              <div className="manager-clients-skel" />
              <div className="manager-clients-skel" />
              <div className="manager-clients-skel" />
            </div>
          ) : null}

          {!loading && !error && !clients.length ? (
            <div className="manager-clients-empty" role="status">
              <strong>{empty.title}</strong>
              <p>{empty.description}</p>
            </div>
          ) : null}

          {!loading && !error && clients.length ? (
            <>
              {clients.map((client) => (
                <ClientDirectoryItem
                  key={client.key}
                  client={client}
                  open={selectedKey === client.key}
                  onOpen={() => void openClient(client)}
                />
              ))}
              {pageCount > 1 ? (
                <div className="manager-clients-pager">
                  <Button type="button" variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>
                    Назад
                  </Button>
                  <span className="tabular-nums">
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
            </>
          ) : null}
        </div>

        <ClientDossierPanel
          view={dossierOpen ? view : null}
          loading={dossierOpen && dossierLoading}
          error={dossierOpen ? dossierError : null}
          tab={clientTab}
          requestBasePath={paths.requests}
          onTab={setClientTab}
          onBack={closeDossier}
          onCopyPhone={(phone) => void copyPhone(phone)}
          onBook={() => {
            prefillBookingFromConsultation({
              detail: null,
              fullName: view?.name,
              phone: view?.phone || undefined,
            });
            void navigate('/booking');
          }}
        />
      </div>
    </div>
  );
}
