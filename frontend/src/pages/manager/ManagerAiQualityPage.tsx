import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { getAiFeedbackReport, listServiceRequests, type AiFeedbackReport } from '../../api/dashboard';
import { downloadApiFile } from '../../api/downloads';
import { AnalyticsBulletChart } from '../../components/analytics/AnalyticsBulletChart';
import { AnalyticsMetricCard } from '../../components/analytics/AnalyticsMetricCard';
import { CategoryBarChart } from '../../components/analytics/CategoryBarChart';
import { InlineFeedbackQueue } from '../../components/manager/InlineFeedbackQueue';
import { PageHeader } from '../../components/layout/dashboard/PageHeader';
import { Button } from '../../components/ui/Button';
import { Card } from '../../components/ui/Card';
import { EmptyState } from '../../components/ui/EmptyState';
import { ErrorState } from '../../components/ui/ErrorState';
import { Loader } from '../../components/ui/Loader';
import { Tabs } from '../../components/ui/Tabs';
import { requestNeedsFeedback } from '../../lib/managerRequestHelpers';
import { usePageMeta } from '../../hooks/usePageMeta';

const VERDICT_LABELS: Record<string, string> = {
  CORRECT: 'Верный',
  PARTIAL: 'Частично',
  INCORRECT: 'Неверный',
};

export function ManagerAiQualityPage() {
  usePageMeta({ title: 'Качество ИИ', description: 'Оценки диагнозов и зоны улучшения.' });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [report, setReport] = useState<AiFeedbackReport | null>(null);
  const [pendingItems, setPendingItems] = useState<Awaited<ReturnType<typeof listServiceRequests>>['items']>([]);
  const [period, setPeriod] = useState('7');

  useEffect(() => {
    const days = period === 'today' ? 1 : Number(period) || 7;
    setLoading(true);
    setError(null);
    void Promise.all([
      getAiFeedbackReport(days),
      listServiceRequests({ pageSize: 100, sort: 'createdAt', dir: 'desc' }),
    ])
      .then(([feedback, requests]) => {
        setReport(feedback);
        setPendingItems(requests.items.filter((item) => requestNeedsFeedback(item, 24)));
      })
      .catch((e) => setError(e instanceof Error ? e.message : 'Ошибка загрузки'))
      .finally(() => setLoading(false));
  }, [period]);

  const days = period === 'today' ? 1 : Number(period) || 7;
  const pendingCount = pendingItems.length;

  const recentRows = useMemo(() => report?.recent ?? [], [report]);

  const categoryRows = useMemo(
    () =>
      (report?.topErrorCategories || []).map((row) => ({
        label: row.category,
        value: row.incorrect + row.partial,
        meta: `${row.errorRatePercent}%`,
      })),
    [report],
  );

  if (loading) return <Loader />;
  if (error) return <ErrorState message={error} />;
  if (!report) return null;

  return (
    <div className="stack dashboard-page">
      <PageHeader
        title="Качество ИИ"
        description="Насколько предварительные диагнозы совпадают с реальностью в сервисе."
        breadcrumbs={[
          { label: 'Рабочий стол', to: '/dashboard/manager' },
          { label: 'Качество ИИ' },
        ]}
      />

      <Tabs
        value={period}
        onChange={setPeriod}
        items={[
          { id: 'today', label: 'Сегодня' },
          { id: '7', label: '7 дней' },
          { id: '30', label: '30 дней' },
        ]}
      />

      <div className="metrics-grid metrics-grid-4">
        <AnalyticsMetricCard label="Оценок за период" value={report.totalFeedback} />
        <AnalyticsBulletChart
          label="Точность (верный)"
          value={report.accuracyPercent}
          max={100}
          suffix="%"
          hint={`${report.byVerdict.CORRECT} из ${report.totalFeedback || 1} оценок`}
        />
        <AnalyticsBulletChart
          label="Полезен (верный + частично)"
          value={report.usefulPercent}
          max={100}
          suffix="%"
        />
        <Link to="/dashboard/manager/requests?status=COMPLETED&feedback=none" className="kpi-bullet-link">
          <AnalyticsMetricCard label="Ждут оценки (>24ч)" value={pendingCount} />
        </Link>
      </div>

      <Card>
        <div className="card-header-row">
          <h2>Отчёт за период</h2>
          <Button
            type="button"
            variant="secondary"
            onClick={() => void downloadApiFile(`/analytics/ai-feedback.csv?days=${days}`)}
          >
            Скачать CSV
          </Button>
        </div>

        <div className="metrics-grid metrics-grid-3">
          <AnalyticsMetricCard label="Верных" value={report.byVerdict.CORRECT} />
          <AnalyticsMetricCard label="Частично" value={report.byVerdict.PARTIAL} />
          <AnalyticsMetricCard label="Неверных" value={report.byVerdict.INCORRECT} />
        </div>
      </Card>

      {report.topMisdiagnoses.length ? (
        <Card>
          <h2>Частые расхождения</h2>
          <CategoryBarChart
            rows={report.topMisdiagnoses.map((row) => ({
              label: row.actualCause,
              value: row.count,
            }))}
          />
        </Card>
      ) : null}

      {categoryRows.length ? (
        <Card>
          <h2>Ошибки по категориям</h2>
          <CategoryBarChart rows={categoryRows} />
        </Card>
      ) : null}

      {pendingItems.length ? (
        <Card>
          <h2>Быстрая оценка (без открытия карточки)</h2>
          <p className="muted">Заявки старше 24 часов без оценки диагноза ИИ.</p>
          <InlineFeedbackQueue
            items={pendingItems.slice(0, 8)}
            onSaved={() => {
              void listServiceRequests({ pageSize: 100, sort: 'createdAt', dir: 'desc' }).then((requests) => {
                setPendingItems(requests.items.filter((item) => requestNeedsFeedback(item, 24)));
              });
            }}
          />
        </Card>
      ) : null}

      <Card>
        <h2>Последние оценки</h2>
        {recentRows.length ? (
          <ul className="simple-list">
            {recentRows.map((row) => (
              <li key={row.id}>
                <div>
                  <strong>{VERDICT_LABELS[row.verdict] || row.verdict}</strong>
                  <span className="muted">
                    {row.vehicle || row.category}
                    {row.actualCause ? ` · ${row.actualCause}` : ''}
                  </span>
                </div>
                <span>
                  {new Date(row.createdAt).toLocaleString('ru-RU')}
                  {row.managerName ? ` · ${row.managerName}` : ''}
                </span>
              </li>
            ))}
          </ul>
        ) : (
          <EmptyState
            title="Оценок пока нет"
            description="Отмечайте точность диагноза в карточке заявки на вкладке «Сводка»."
          />
        )}
      </Card>

      {pendingCount > 0 ? (
        <Card className="hint-card">
          <div>
            <strong>Нужна ваша оценка: {pendingCount}</strong>
            <p>Откройте завершённые или активные заявки и отметьте, насколько диагноз ИИ совпал с реальностью.</p>
            <Link to="/dashboard/manager/requests?feedback=none">
              <Button variant="secondary">Перейти в очередь</Button>
            </Link>
          </div>
        </Card>
      ) : null}
    </div>
  );
}
