import { useEffect, useState } from 'react';
import { getAnalyticsKpi } from '../../api/dashboard';
import { AnalyticsMetricCard } from '../../components/analytics/AnalyticsMetricCard';
import { PageHeader } from '../../components/layout/dashboard/PageHeader';
import { Card } from '../../components/ui/Card';
import { ErrorState } from '../../components/ui/ErrorState';
import { Loader } from '../../components/ui/Loader';
import { Tabs } from '../../components/ui/Tabs';
import { usePageMeta } from '../../hooks/usePageMeta';
import type { AnalyticsKpi } from '../../types/dashboard';

export function AdminAnalyticsPage() {
  usePageMeta({ title: 'Аналитика', description: 'Показатели консультаций, заявок и конверсии.' });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [kpi, setKpi] = useState<AnalyticsKpi | null>(null);
  const [period, setPeriod] = useState('30');

  useEffect(() => {
    void getAnalyticsKpi()
      .then(setKpi)
      .catch((e) => setError(e instanceof Error ? e.message : 'Ошибка загрузки'))
      .finally(() => setLoading(false));
  }, [period]);

  if (loading) return <Loader />;
  if (error) return <ErrorState message={error} />;
  if (!kpi) return null;

  const funnel = kpi.funnel;

  return (
    <div className="stack dashboard-page">
      <PageHeader title="Аналитика" description="Реальные данные из базы сервиса." />

      <Tabs
        value={period}
        onChange={setPeriod}
        items={[
          { id: 'today', label: 'Сегодня' },
          { id: '7', label: '7 дней' },
          { id: '30', label: '30 дней' },
        ]}
      />

      <div className="metrics-grid">
        <AnalyticsMetricCard label="Консультации" value={kpi.consultations ?? funnel.consultationsTotal} />
        <AnalyticsMetricCard label="Заявки" value={kpi.serviceRequests ?? funnel.requestsTotal} />
        <AnalyticsMetricCard label="Записи" value={kpi.bookings ?? funnel.bookingsTotal} />
        <AnalyticsMetricCard
          label="Конверсия консультация → заявка"
          value={`${funnel.conversionConsultationToRequest}%`}
        />
        <AnalyticsMetricCard label="Конверсия заявка → запись" value={`${funnel.conversionRequestToBooking}%`} />
        <AnalyticsMetricCard label="Завершённые заявки" value={`${funnel.conversionCompleted}%`} />
      </div>

      <Card>
        <h2>Эффективность менеджеров</h2>
        <ul className="simple-list">
          {kpi.managers.map((row) => (
            <li key={row.manager.id}>
              <strong>{row.manager.fullName}</strong>
              <span>Сообщений: {row.activityMessages}</span>
              <span>Активных заявок: {row.activeRequests}</span>
            </li>
          ))}
        </ul>
      </Card>
    </div>
  );
}
