import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { getAiFeedbackReport, listServiceRequests, type AiFeedbackReport } from '../../../api/dashboard';
import { downloadApiFile } from '../../../api/downloads';
import { AnalyticsMetricCard } from '../../../components/analytics/AnalyticsMetricCard';
import { PageHeader } from '../../../components/layout/dashboard/PageHeader';
import { Button } from '../../../components/ui/Button';
import { Card } from '../../../components/ui/Card';
import { EmptyState } from '../../../components/ui/EmptyState';
import { ErrorState } from '../../../components/ui/ErrorState';
import { Loader } from '../../../components/ui/Loader';
import { Tabs } from '../../../components/ui/Tabs';
import { requestNeedsFeedback } from '../../../lib/managerRequestHelpers';
import { usePageMeta } from '../../../hooks/usePageMeta';

const VERDICT_LABELS: Record<string, string> = {
  CORRECT: 'Верный',
  PARTIAL: 'Частично',
  INCORRECT: 'Неверный',
};

export function AdminAiFeedbackPage() {
  usePageMeta({ title: 'Обратная связь ИИ', description: 'Оценки диагнозов от менеджеров.' });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [report, setReport] = useState<AiFeedbackReport | null>(null);
  const [pendingCount, setPendingCount] = useState(0);
  const [period, setPeriod] = useState('30');

  useEffect(() => {
    const days = period === 'today' ? 1 : Number(period) || 30;
    setLoading(true);
    setError(null);
    void Promise.all([
      getAiFeedbackReport(days),
      listServiceRequests({ pageSize: 100, sort: 'createdAt', dir: 'desc' }),
    ])
      .then(([feedback, requests]) => {
        setReport(feedback);
        setPendingCount(requests.items.filter((item) => requestNeedsFeedback(item)).length);
      })
      .catch((e) => setError(e instanceof Error ? e.message : 'Ошибка загрузки'))
      .finally(() => setLoading(false));
  }, [period]);

  const days = period === 'today' ? 1 : Number(period) || 30;
  const recentRows = useMemo(() => report?.recent ?? [], [report]);

  if (loading) return <Loader />;
  if (error) return <ErrorState message={error} onRetry={() => window.location.reload()} />;
  if (!report) return null;

  return (
    <div className="stack dashboard-page">
      <PageHeader
        title="Обратная связь"
        description="Насколько предварительные диагнозы совпадают с реальностью в сервисе."
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
        <AnalyticsMetricCard label="Точность (верный)" value={`${report.accuracyPercent}%`} tone="accent" />
        <AnalyticsMetricCard label="Полезен (верный + частично)" value={`${report.usefulPercent}%`} />
        <Link to="/dashboard/admin/operations/requests?status=COMPLETED">
          <AnalyticsMetricCard label="Ждут оценки" value={pendingCount} />
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
          <ul className="simple-list">
            {report.topMisdiagnoses.map((row) => (
              <li key={row.actualCause}>
                <strong>{row.actualCause}</strong>
                <span>{row.count} раз</span>
              </li>
            ))}
          </ul>
        </Card>
      ) : null}

      {report.topErrorCategories.length ? (
        <Card>
          <h2>Ошибки по категориям</h2>
          <ul className="simple-list">
            {report.topErrorCategories.map((row) => (
              <li key={row.category}>
                <strong>{row.category}</strong>
                <span>
                  {row.incorrect + row.partial} / {row.total} ({row.errorRatePercent}%)
                </span>
              </li>
            ))}
          </ul>
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
                    {row.worksDone ? ` · работы: ${row.worksDone}` : ''}
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
            description="Менеджеры отмечают точность диагноза в карточке заявки."
          />
        )}
      </Card>
    </div>
  );
}
