import { useEffect, useState } from 'react';
import {
  backfillCaseMemory,
  getCaseMemoryStats,
  searchCaseMemory,
  type CaseMemorySearchResponse,
  type CaseMemoryStats,
} from '../../../api/adminAi';
import { PageHeader } from '../../../components/layout/dashboard/PageHeader';
import { AnalyticsMetricCard } from '../../../components/analytics/AnalyticsMetricCard';
import { Button } from '../../../components/ui/Button';
import { Card } from '../../../components/ui/Card';
import { EmptyState } from '../../../components/ui/EmptyState';
import { ErrorState } from '../../../components/ui/ErrorState';
import { Loader } from '../../../components/ui/Loader';
import { usePageMeta } from '../../../hooks/usePageMeta';

export function AdminAiMemoryPage() {
  usePageMeta({ title: 'Память кейсов', description: 'Семантический поиск по завершённым консультациям.' });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [stats, setStats] = useState<CaseMemoryStats | null>(null);
  const [symptoms, setSymptoms] = useState('');
  const [make, setMake] = useState('');
  const [model, setModel] = useState('');
  const [searching, setSearching] = useState(false);
  const [backfilling, setBackfilling] = useState(false);
  const [searchResult, setSearchResult] = useState<CaseMemorySearchResponse | null>(null);
  const [backfillMsg, setBackfillMsg] = useState<string | null>(null);

  async function loadStats() {
    setLoading(true);
    setError(null);
    try {
      setStats(await getCaseMemoryStats());
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Ошибка загрузки');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadStats();
  }, []);

  async function onSearch(e: React.FormEvent) {
    e.preventDefault();
    if (!symptoms.trim()) return;
    setSearching(true);
    setError(null);
    try {
      setSearchResult(
        await searchCaseMemory({
          symptoms: symptoms.trim(),
          make: make.trim() || undefined,
          model: model.trim() || undefined,
          limit: 5,
        }),
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Ошибка поиска');
    } finally {
      setSearching(false);
    }
  }

  async function onBackfill() {
    setBackfilling(true);
    setBackfillMsg(null);
    setError(null);
    try {
      const result = await backfillCaseMemory({ limit: 200 });
      setBackfillMsg(`Проиндексировано: ${result.indexed}, пропущено: ${result.skipped}, всего: ${result.total}`);
      await loadStats();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Ошибка индексации');
    } finally {
      setBackfilling(false);
    }
  }

  if (loading) return <Loader label="Загружаем память кейсов..." />;
  if (error && !stats) return <ErrorState message={error} onRetry={() => void loadStats()} />;

  return (
    <div className="stack dashboard-page">
      <PageHeader
        title="Память кейсов"
        description="Семантический поиск по завершённым консультациям для улучшения диагнозов."
        actions={
          <Button variant="secondary" disabled={backfilling} onClick={() => void onBackfill()}>
            {backfilling ? 'Индексация…' : 'Проиндексировать кейсы'}
          </Button>
        }
      />

      {error ? <ErrorState message={error} onRetry={() => void loadStats()} /> : null}
      {backfillMsg ? <Card className="success-block"><p>{backfillMsg}</p></Card> : null}

      {stats ? (
        <div className="metrics-grid metrics-grid-4">
          <AnalyticsMetricCard label="Проиндексировано" value={stats.indexedSessions} />
          <AnalyticsMetricCard label="Завершённых сессий" value={stats.completedSessions} />
          <AnalyticsMetricCard label="Покрытие" value={`${stats.coveragePercent}%`} tone="accent" />
          <AnalyticsMetricCard
            label="Semantic"
            value={stats.semanticEnabled ? 'вкл' : 'выкл'}
          />
        </div>
      ) : null}

      {stats ? (
        <Card>
          <dl className="detail-dl desk-profile-dl">
            <div>
              <dt>Embedding-модель</dt>
              <dd>{stats.embeddingModel || '—'}</dd>
            </div>
            <div>
              <dt>TOP_K в промпте</dt>
              <dd>{stats.topK}</dd>
            </div>
            <div>
              <dt>Lexical fallback</dt>
              <dd>{stats.lexicalFallback ? 'да' : 'нет'}</dd>
            </div>
            <div>
              <dt>Последняя индексация</dt>
              <dd>{stats.lastIndexedAt ? new Date(stats.lastIndexedAt).toLocaleString('ru-RU') : '—'}</dd>
            </div>
          </dl>
        </Card>
      ) : null}

      <Card>
        <h2>Тестовый поиск</h2>
        <form className="stack compact" onSubmit={(e) => void onSearch(e)}>
          <input
            value={symptoms}
            onChange={(e) => setSymptoms(e.target.value)}
            placeholder="Симптомы, напр. стук при торможении"
            aria-label="Симптомы"
            required
          />
          <div className="admin-inline-form">
            <input
              value={make}
              onChange={(e) => setMake(e.target.value)}
              placeholder="Марка"
              aria-label="Марка"
            />
            <input
              value={model}
              onChange={(e) => setModel(e.target.value)}
              placeholder="Модель"
              aria-label="Модель"
            />
            <Button type="submit" disabled={searching}>
              {searching ? 'Поиск…' : 'Найти похожие'}
            </Button>
          </div>
        </form>
      </Card>

      {searchResult ? (
        <Card>
          <h2>
            Результаты ({searchResult.results.length})
            {!searchResult.semanticEnabled ? (
              <span className="muted-text"> · только lexical</span>
            ) : null}
          </h2>
          {!searchResult.results.length ? (
            <EmptyState title="Похожих кейсов не найдено" description="Попробуйте другие симптомы или запустите backfill." />
          ) : (
            <ul className="simple-list">
              {searchResult.results.map((row, idx) => (
                <li key={`${row.make}-${row.model}-${idx}`}>
                  <div>
                    <strong>
                      {[row.make, row.model].filter(Boolean).join(' ') || 'Авто не указано'}
                      {row.score != null ? ` · ${Math.round(row.score * 100)}%` : ''}
                    </strong>
                    <span className="muted">
                      {row.source}
                      {row.symptomCategory ? ` · ${row.symptomCategory}` : ''}
                      {row.categoryMatch ? ' · категория совпала' : ''}
                    </span>
                    {row.topRecommendations?.length ? (
                      <p className="muted-text">{row.topRecommendations.join('; ')}</p>
                    ) : null}
                  </div>
                  {row.costFromMinor != null ? (
                    <span>от {Math.round(row.costFromMinor / 100).toLocaleString('ru-RU')} ₽</span>
                  ) : null}
                </li>
              ))}
            </ul>
          )}
        </Card>
      ) : null}
    </div>
  );
}
