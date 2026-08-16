import { useEffect, useMemo, useRef, useState } from 'react';
import { Bookmark, RefreshCw, SlidersHorizontal, X } from 'lucide-react';
import { Button } from '../ui/Button';
import { SERVICE_REQUEST_STATUS_LABELS } from '../../lib/labels';
import { SLA_OVERDUE_LABEL } from '../../lib/requestSla';
import { QUEUE_STATUSES } from '../../lib/queueStatuses';
import { useDebouncedValue } from '../../hooks/useDebouncedValue';
import type { SavedQueueFilter } from '../../lib/savedQueueFilters';
import type { ServiceRequestStatus } from '../../types/serviceRequest';

const URGENCY_LABELS: Record<string, string> = {
  critical: 'Критическая',
  high: 'Высокая',
  medium: 'Средняя',
  low: 'Низкая',
};

const FEEDBACK_LABELS: Record<string, string> = {
  none: 'Без оценки',
  CORRECT: 'Диагноз верный',
  PARTIAL: 'Диагноз частично',
  INCORRECT: 'Диагноз неверный',
};

const SOURCE_LABELS: Record<string, string> = {
  registered: 'Зарегистрирован',
  guest: 'Гость',
  contact: 'Форма сайта',
};

const PERIOD_LABELS: Record<string, string> = {
  today: 'Сегодня',
  '7d': 'За 7 дней',
};

const DIAGNOSIS_LABELS: Record<string, string> = {
  true: 'Есть диагноз ИИ',
  false: 'Нет диагноза ИИ',
};

export type QueueFilterState = {
  q: string;
  scope: 'all' | 'mine';
  view: 'list' | 'kanban';
  statuses: ServiceRequestStatus[];
  urgency: string;
  feedback: string;
  sla: string;
  source: string;
  period: string;
  hasDiagnosis: string;
};

type Chip = { key: string; label: string; onRemove: () => void };

type Props = {
  state: QueueFilterState;
  total: number;
  refreshing?: boolean;
  lastUpdatedAt?: Date | null;
  savedFilters: SavedQueueFilter[];
  onPatch: (patch: Record<string, string | undefined>) => void;
  onStatusesChange: (statuses: ServiceRequestStatus[]) => void;
  onReset: () => void;
  onRefresh: () => void;
  onApplyPreset: (preset: SavedQueueFilter) => void;
  onSavePreset: (label: string) => void;
  onRemovePreset: (id: string) => void;
};

export function ManagerQueueFilters({
  state,
  total,
  refreshing,
  lastUpdatedAt,
  savedFilters,
  onPatch,
  onStatusesChange,
  onReset,
  onRefresh,
  onApplyPreset,
  onSavePreset,
  onRemovePreset,
}: Props) {
  const [searchInput, setSearchInput] = useState(state.q);
  const [advancedOpen, setAdvancedOpen] = useState(false);
  const [presetName, setPresetName] = useState('');
  const [presetFormOpen, setPresetFormOpen] = useState(false);
  const searchRef = useRef<HTMLInputElement>(null);
  const presetInputRef = useRef<HTMLInputElement>(null);
  const debouncedSearch = useDebouncedValue(searchInput, 350);

  useEffect(() => {
    setSearchInput(state.q);
  }, [state.q]);

  useEffect(() => {
    const next = debouncedSearch.trim();
    if (next === state.q) return;
    onPatch({ q: next || undefined, page: '1' });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [debouncedSearch]);

  useEffect(() => {
    if (presetFormOpen) presetInputRef.current?.focus();
  }, [presetFormOpen]);

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === '/' && !isTypingTarget(event.target)) {
        event.preventDefault();
        searchRef.current?.focus();
      }
    }
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, []);

  const advancedCount = useMemo(
    () =>
      [state.urgency, state.feedback, state.sla, state.source, state.period, state.hasDiagnosis].filter(Boolean)
        .length,
    [state],
  );

  const chips = useMemo<Chip[]>(() => {
    const list: Chip[] = [];
    if (state.q) {
      list.push({ key: 'q', label: `Поиск: ${state.q}`, onRemove: () => onPatch({ q: undefined, page: '1' }) });
    }
    for (const status of state.statuses) {
      list.push({
        key: `status-${status}`,
        label: SERVICE_REQUEST_STATUS_LABELS[status],
        onRemove: () => onStatusesChange(state.statuses.filter((item) => item !== status)),
      });
    }
    if (state.urgency) {
      list.push({
        key: 'urgency',
        label: `Срочность: ${URGENCY_LABELS[state.urgency] || state.urgency}`,
        onRemove: () => onPatch({ urgency: undefined, page: '1' }),
      });
    }
    if (state.feedback) {
      list.push({
        key: 'feedback',
        label: FEEDBACK_LABELS[state.feedback] || state.feedback,
        onRemove: () => onPatch({ feedback: undefined, page: '1' }),
      });
    }
    if (state.sla) {
      list.push({
        key: 'sla',
        label: SLA_OVERDUE_LABEL,
        onRemove: () => onPatch({ sla: undefined, page: '1' }),
      });
    }
    if (state.source) {
      list.push({
        key: 'source',
        label: `Источник: ${SOURCE_LABELS[state.source] || state.source}`,
        onRemove: () => onPatch({ source: undefined, page: '1' }),
      });
    }
    if (state.period) {
      list.push({
        key: 'period',
        label: PERIOD_LABELS[state.period] || state.period,
        onRemove: () => onPatch({ period: undefined, page: '1' }),
      });
    }
    if (state.hasDiagnosis) {
      list.push({
        key: 'hasDiagnosis',
        label: DIAGNOSIS_LABELS[state.hasDiagnosis] || state.hasDiagnosis,
        onRemove: () => onPatch({ hasDiagnosis: undefined, page: '1' }),
      });
    }
    return list;
  }, [state, onPatch, onStatusesChange]);

  function toggleStatus(status: ServiceRequestStatus) {
    const next = state.statuses.includes(status)
      ? state.statuses.filter((item) => item !== status)
      : [...state.statuses, status];
    onStatusesChange(next);
  }

  return (
    <section className="queue-filters" aria-label="Фильтры очереди">
      <div className="queue-filters-primary">
        <form
          className="queue-search"
          role="search"
          onSubmit={(event) => {
            event.preventDefault();
            onPatch({ q: searchInput.trim() || undefined, page: '1' });
          }}
        >
          <input
            ref={searchRef}
            className="input"
            type="search"
            value={searchInput}
            onChange={(event) => setSearchInput(event.target.value)}
            placeholder="Клиент, телефон или автомобиль"
            aria-label="Поиск заявок"
          />
          <kbd>/</kbd>
        </form>

        <button
          type="button"
          className={`queue-status-pill${state.scope === 'all' ? ' is-active' : ''}`}
          aria-pressed={state.scope === 'all'}
          onClick={() => onPatch({ scope: undefined, page: '1' })}
        >
          Все
        </button>
        <button
          type="button"
          className={`queue-status-pill${state.scope === 'mine' ? ' is-active' : ''}`}
          aria-pressed={state.scope === 'mine'}
          onClick={() => onPatch({ scope: 'mine', page: '1' })}
        >
          Мои
        </button>
        <button
          type="button"
          className={`queue-status-pill${state.view === 'list' ? ' is-active' : ''}`}
          aria-pressed={state.view === 'list'}
          onClick={() => onPatch({ view: undefined })}
        >
          Список
        </button>
        <button
          type="button"
          className={`queue-status-pill${state.view === 'kanban' ? ' is-active' : ''}`}
          aria-pressed={state.view === 'kanban'}
          onClick={() => onPatch({ view: 'kanban' })}
        >
          Канбан
        </button>

        <span className="queue-filters-spacer" />

        <Button
          type="button"
          variant={advancedOpen || advancedCount ? 'secondary' : 'ghost'}
          aria-expanded={advancedOpen}
          onClick={() => setAdvancedOpen((value) => !value)}
        >
          <SlidersHorizontal size={16} />
          Фильтры
          {advancedCount ? <span className="queue-filter-count">{advancedCount}</span> : null}
        </Button>
        <Button type="button" variant="ghost" onClick={onRefresh} disabled={refreshing}>
          <RefreshCw size={16} className={refreshing ? 'is-spinning' : undefined} />
          Обновить
        </Button>
      </div>

      <div className="queue-status-pills" role="group" aria-label="Статусы заявок">
        {QUEUE_STATUSES.map((status) => {
          const active = state.statuses.includes(status);
          return (
            <button
              key={status}
              type="button"
              className={`queue-status-pill status-${status.toLowerCase().replace(/_/g, '-')}${active ? ' is-active' : ''}`}
              aria-pressed={active}
              onClick={() => toggleStatus(status)}
            >
              {SERVICE_REQUEST_STATUS_LABELS[status]}
            </button>
          );
        })}
      </div>

      {advancedOpen ? (
        <div className="queue-filters-advanced">
          <FilterSelect
            label="Срочность ИИ"
            value={state.urgency || 'any'}
            onChange={(value) => onPatch({ urgency: value === 'any' ? undefined : value, page: '1' })}
            options={[['any', 'Любая'], ...Object.entries(URGENCY_LABELS)]}
          />
          <FilterSelect
            label="Оценка диагноза"
            value={state.feedback || 'any'}
            onChange={(value) => onPatch({ feedback: value === 'any' ? undefined : value, page: '1' })}
            options={[['any', 'Любая'], ...Object.entries(FEEDBACK_LABELS)]}
          />
          <FilterSelect
            label="Ответ клиенту"
            value={state.sla || 'any'}
            onChange={(value) => onPatch({ sla: value === 'any' ? undefined : value, page: '1' })}
            options={[
              ['any', 'Все заявки'],
              ['breached', SLA_OVERDUE_LABEL],
            ]}
          />
          <FilterSelect
            label="Источник"
            value={state.source || 'any'}
            onChange={(value) => onPatch({ source: value === 'any' ? undefined : value, page: '1' })}
            options={[['any', 'Любой'], ...Object.entries(SOURCE_LABELS)]}
          />
          <FilterSelect
            label="Период"
            value={state.period || 'any'}
            onChange={(value) => onPatch({ period: value === 'any' ? undefined : value, page: '1' })}
            options={[['any', 'Весь период'], ...Object.entries(PERIOD_LABELS)]}
          />
          <FilterSelect
            label="Диагноз ИИ"
            value={state.hasDiagnosis || 'any'}
            onChange={(value) => onPatch({ hasDiagnosis: value === 'any' ? undefined : value, page: '1' })}
            options={[['any', 'Любой'], ...Object.entries(DIAGNOSIS_LABELS)]}
          />
        </div>
      ) : null}

      <div className="queue-presets">
        {savedFilters.map((preset) => (
          <span key={preset.id} className="queue-preset">
            <button type="button" onClick={() => onApplyPreset(preset)}>
              {preset.label}
            </button>
            {preset.builtIn ? null : (
              <button
                type="button"
                className="queue-preset-remove"
                aria-label={`Удалить пресет «${preset.label}»`}
                onClick={() => onRemovePreset(preset.id)}
              >
                <X size={14} />
              </button>
            )}
          </span>
        ))}
        {presetFormOpen ? (
          <form
            className="queue-preset-form"
            onSubmit={(event) => {
              event.preventDefault();
              onSavePreset(presetName);
              setPresetName('');
              setPresetFormOpen(false);
            }}
          >
            <input
              ref={presetInputRef}
              className="input"
              value={presetName}
              onChange={(event) => setPresetName(event.target.value)}
              placeholder="Название пресета"
              aria-label="Название пресета"
              maxLength={40}
            />
            <Button type="submit" variant="secondary" disabled={!presetName.trim()}>
              Сохранить
            </Button>
            <Button type="button" variant="ghost" onClick={() => setPresetFormOpen(false)}>
              Отмена
            </Button>
          </form>
        ) : (
          <button
            type="button"
            className="queue-preset-add"
            onClick={() => setPresetFormOpen(true)}
            disabled={!chips.length}
            title={chips.length ? 'Сохранить текущий набор фильтров' : 'Сначала выберите фильтры'}
          >
            <Bookmark size={14} />
            Сохранить фильтр
          </button>
        )}
      </div>

      <div className="queue-filters-footer">
        <span className="muted tnum">
          Найдено: {total}
          {lastUpdatedAt
            ? ` · обновлено ${lastUpdatedAt.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' })}`
            : ''}
        </span>
        {chips.length ? (
          <div className="queue-filter-chips">
            {chips.map((chip) => (
              <button key={chip.key} type="button" className="queue-filter-chip" onClick={chip.onRemove}>
                {chip.label}
                <X size={12} aria-hidden />
              </button>
            ))}
            <button type="button" className="queue-filter-chip queue-filter-reset" onClick={onReset}>
              Сбросить всё
            </button>
          </div>
        ) : null}
      </div>
    </section>
  );
}

function FilterSelect({
  label,
  value,
  onChange,
  options,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: Array<[string, string]>;
}) {
  return (
    <label>
      {label}
      <select className="select" value={value} aria-label={label} onChange={(event) => onChange(event.target.value)}>
        {options.map(([optionValue, optionLabel]) => (
          <option key={optionValue} value={optionValue}>
            {optionLabel}
          </option>
        ))}
      </select>
    </label>
  );
}

function isTypingTarget(target: EventTarget | null) {
  if (!(target instanceof HTMLElement)) return false;
  return (
    target.tagName === 'INPUT' ||
    target.tagName === 'TEXTAREA' ||
    target.tagName === 'SELECT' ||
    target.isContentEditable
  );
}
