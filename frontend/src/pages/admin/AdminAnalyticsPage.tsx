import { useEffect, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { getAnalyticsKpi, getAiFeedbackReport, type AiFeedbackReport } from '../../api/dashboard';
import { downloadApiFile } from '../../api/downloads';
import { AnalyticsBulletChart } from '../../components/analytics/AnalyticsBulletChart';
import { AnalyticsFunnelChart } from '../../components/analytics/AnalyticsFunnelChart';
import { AnalyticsMetricCard } from '../../components/analytics/AnalyticsMetricCard';
import { PageHeader } from '../../components/layout/dashboard/PageHeader';
import { Button } from '../../components/ui/Button';
import { Card } from '../../components/ui/Card';
import { DataTable } from '../../components/ui/DataTable';
import { EmptyState } from '../../components/ui/EmptyState';
import { ErrorState } from '../../components/ui/ErrorState';
import { Loader } from '../../components/ui/Loader';
import { Tabs } from '../../components/ui/Tabs';
import { usePageMeta } from '../../hooks/usePageMeta';
import type { AnalyticsKpi } from '../../types/dashboard';

const TAB_ITEMS = [
  { id: 'overview', label: 'Обзор' },
  { id: 'funnel', label: 'Воронка' },
  { id: 'ai-quality', label: 'Качество ИИ' },
  { id: 'managers', label: 'Менеджеры' },
  { id: 'export', label: 'Экспорт' },
];

const PERIOD_ITEMS = [
  { id: 'today', label: 'Сегодня' },
  { id: '7', label: '7 дней' },
  { id: '30', label: '30 дней' },
  { id: '90', label: '90 дней' },
];

function periodToDays(period: string) {
  if (period === 'today') return 1;
  return Number(period) || 30;
}

const FUNNEL_DRILLDOWN: Record<string, { title: string; to: string }> = {
  consultations: { title: 'Консультации', to: '/dashboard/admin/ai/feedback' },
  requests: { title: 'Заявки', to: '/dashboard/admin/operations/requests' },
  bookings: { title: 'Записи', to: '/dashboard/admin/operations/bookings' },
  completed: { title: 'Завершённые заявки', to: '/dashboard/admin/operations/requests?status=COMPLETED' },
};

export function AdminAnalyticsPage() {
  usePageMeta({ title: 'Аналитика', description: 'Показатели консультаций, заявок и конверсии.' });
  const [searchParams, setSearchParams] = useSearchParams();
  const tab = searchParams.get('tab') || 'overview';
  const period = searchParams.get('period') || '30';
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [kpi, setKpi] = useState<AnalyticsKpi | null>(null);
  const [aiFeedback, setAiFeedback] = useState<AiFeedbackReport | null>(null);
  const [funnelKey, setFunnelKey] = useState<string | null>(null);

  const days = periodToDays(period);

  function load() {
    setLoading(true);
    setError(null);
    void Promise.all([getAnalyticsKpi(days), getAiFeedbackReport(days)])
      .then(([kpiData, feedbackData]) => {
        setKpi(kpiData);
        setAiFeedback(feedbackData);
      })
      .catch((e) => setError(e instanceof Error ? e.message : 'Ошибка загрузки'))
      .finally(() => setLoading(false));
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [days]);

  const funnelSteps = useMemo(() => {
    if (!kpi) return [];
    if (kpi.funnel.steps?.length) return kpi.funnel.steps;
    return [
      { key: 'consultations', label: 'Консультации', count: kpi.funnel.consultationsTotal },
      { key: 'requests', label: 'Заявки', count: kpi.funnel.requestsTotal },
      { key: 'bookings', label: 'Записи', count: kpi.funnel.bookingsTotal },
      { key: 'completed', label: 'Завершено', count: kpi.funnel.completedRequests ?? 0 },
    ];
  }, [kpi]);

  const bulletMax = useMemo(() => {
    if (!kpi) return 1;
    return Math.max(kpi.funnel.consultationsTotal, kpi.funnel.requestsTotal, kpi.funnel.bookingsTotal, 1);
  }, [kpi]);

  function setTab(next: string) {
    const nextParams = new URLSearchParams(searchParams);
    nextParams.set('tab', next);
    setSearchParams(nextParams, { replace: true });
  }

  function setPeriod(next: string) {
    const nextParams = new URLSearchParams(searchParams);
    nextParams.set('period', next);
    setSearchParams(nextParams, { replace: true });
  }

  if (loading) return <Loader />;
  if (error) return <ErrorState message={error} onRetry={load} />;
  if (!kpi) return null;

  const funnel = kpi.funnel;

  return (
    <div className="stack dashboard-page">
      <PageHeader title="Аналитика" description="Реальные данные из базы сервиса за выбранный период." />

      <div className="analytics-toolbar">
        <Tabs value={tab} onChange={setTab} items={TAB_ITEMS} />
        <Tabs value={period} onChange={setPeriod} items={PERIOD_ITEMS} />
      </div>

      {tab === 'overview' && (
        <>
          <div className="analytics-bullets-grid">
            <AnalyticsBulletChart label="Консультации" value={funnel.consultationsTotal} max={bulletMax} />
            <AnalyticsBulletChart label="Заявки" value={funnel.requestsTotal} max={bulletMax} />
            <AnalyticsBulletChart label="Записи" value={funnel.bookingsTotal} max={bulletMax} />
            <AnalyticsBulletChart
              label="Консультация → заявка"
              value={funnel.conversionConsultationToRequest}
              max={100}
              suffix="%"
            />
            <AnalyticsBulletChart
              label="Заявка → запись"
              value={funnel.conversionRequestToBooking}
              max={100}
              suffix="%"
            />
            <AnalyticsBulletChart
              label="Завершённые заявки"
              value={funnel.conversionCompleted}
              max={100}
              suffix="%"
            />
          </div>

          <div className="metrics-grid">
            <AnalyticsMetricCard label="Отменённые заявки" value={funnel.cancelledRequests} />
            {funnel.biggestDropOff ? (
              <AnalyticsMetricCard
                label="Максимальный отток"
                value={`${funnel.biggestDropOff.dropPercent}%`}
                hint={`${funnel.biggestDropOff.from} → ${funnel.biggestDropOff.to}`}
              />
            ) : null}
          </div>
        </>
      )}

      {tab === 'funnel' && (
        <div className="grid two">
          <Card>
            <h2>Воронка сервиса</h2>
            <p className="muted">Клик по стадии — переход к списку сущностей.</p>
            <AnalyticsFunnelChart steps={funnelSteps} activeKey={funnelKey} onSelect={setFunnelKey} />
            {funnel.biggestDropOff ? (
              <p className="analytics-dropoff-note">
                Наибольший отток: <strong>{funnel.biggestDropOff.from}</strong> →{' '}
                <strong>{funnel.biggestDropOff.to}</strong> (−{funnel.biggestDropOff.dropPercent}%)
              </p>
            ) : null}
          </Card>
          <Card>
            <h2>Drill-down</h2>
            {funnelKey && FUNNEL_DRILLDOWN[funnelKey] ? (
              <div className="stack compact">
                <p>
                  Стадия: <strong>{FUNNEL_DRILLDOWN[funnelKey].title}</strong>
                </p>
                <p>
                  Записей: <strong>{funnelSteps.find((s) => s.key === funnelKey)?.count ?? 0}</strong>
                </p>
                <Link to={FUNNEL_DRILLDOWN[funnelKey].to}>
                  <Button>Открыть список</Button>
                </Link>
              </div>
            ) : (
              <p className="muted">Выберите стадию воронки слева.</p>
            )}
          </Card>
        </div>
      )}

      {tab === 'ai-quality' && (
        <Card>
          {!aiFeedback || !aiFeedback.totalFeedback ? (
            <EmptyState title="Оценок пока нет" description="Когда менеджеры оценят диагнозы, метрики появятся здесь." />
          ) : (
            <>
          <div className="card-header-row">
            <h2>Качество ИИ-диагнозов</h2>
            <Link to="/dashboard/admin/ai/feedback">
              <Button variant="ghost">Подробнее в ИИ-студии</Button>
            </Link>
          </div>
          <div className="metrics-grid">
            <AnalyticsMetricCard label="Оценок за период" value={aiFeedback.totalFeedback} />
            <AnalyticsMetricCard label="Точность (верный)" value={`${aiFeedback.accuracyPercent}%`} />
            <AnalyticsMetricCard label="Полезен (верный + частично)" value={`${aiFeedback.usefulPercent}%`} />
          </div>
          <div className="analytics-verdict-row">
            <span className="analytics-verdict correct">Верно: {aiFeedback.byVerdict.CORRECT}</span>
            <span className="analytics-verdict partial">Частично: {aiFeedback.byVerdict.PARTIAL}</span>
            <span className="analytics-verdict incorrect">Неверно: {aiFeedback.byVerdict.INCORRECT}</span>
          </div>
          {aiFeedback.topErrorCategories.length ? (
            <>
              <h3>Ошибки по категориям</h3>
              <ul className="analytics-bar-list">
                {aiFeedback.topErrorCategories.map((row) => (
                  <li key={row.category}>
                    <span>{row.category}</span>
                    <div className="analytics-bar-track">
                      <div
                        className="analytics-bar-fill is-warn"
                        style={{ width: `${Math.min(100, row.errorRatePercent)}%` }}
                      />
                    </div>
                    <em>{row.errorRatePercent}%</em>
                  </li>
                ))}
              </ul>
            </>
          ) : null}
          {aiFeedback.topMisdiagnoses.length ? (
            <>
              <h3>Частые расхождения</h3>
              <ul className="simple-list">
                {aiFeedback.topMisdiagnoses.map((row) => (
                  <li key={row.actualCause}>
                    <strong>{row.actualCause}</strong>
                    <span>{row.count} раз</span>
                  </li>
                ))}
              </ul>
            </>
          ) : null}
            </>
          )}
        </Card>
      )}

      {tab === 'managers' && (
        <Card>
          <h2>Эффективность менеджеров</h2>
          {kpi.managers.length ? (
          <DataTable
            columns={[
              { key: 'name', label: 'Менеджер' },
              { key: 'messages', label: 'Сообщений' },
              { key: 'active', label: 'Активных заявок' },
            ]}
            rows={kpi.managers.map((row) => ({
              name: row.manager.fullName,
              messages: row.activityMessages,
              active: row.activeRequests,
            }))}
          />
          ) : (
            <EmptyState title="Нет данных по менеджерам" description="Как только появятся активные заявки, таблица заполнится." />
          )}
        </Card>
      )}

      {tab === 'export' && (
        <Card>
          <h2>Экспорт отчётов</h2>
          <p className="muted">Период: {period === 'today' ? 'сегодня' : `${days} дн.`}</p>
          <div className="row gap-sm analytics-export-actions">
            <Button type="button" onClick={() => void downloadApiFile(`/analytics/kpi.csv?days=${days}`)}>
              KPI CSV
            </Button>
            <Button type="button" variant="secondary" onClick={() => void downloadApiFile(`/analytics/ai-feedback.csv?days=${days}`)}>
              AI feedback CSV
            </Button>
          </div>
          <div className="analytics-export-preset">
            <h3>Отчёт для руководства</h3>
            <ul className="simple-list">
              <li>Консультации: {funnel.consultationsTotal}</li>
              <li>Заявки: {funnel.requestsTotal}</li>
              <li>Записи: {funnel.bookingsTotal}</li>
              <li>Конверсия консультация → заявка: {funnel.conversionConsultationToRequest}%</li>
              <li>Конверсия заявка → запись: {funnel.conversionRequestToBooking}%</li>
              {aiFeedback ? <li>Точность ИИ: {aiFeedback.accuracyPercent}%</li> : null}
            </ul>
          </div>
        </Card>
      )}
    </div>
  );
}
