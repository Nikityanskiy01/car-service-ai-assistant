import { Link, useLocation, useRouteError } from 'react-router-dom';
import { PageHeader } from '../../components/layout/dashboard/PageHeader';
import { Card } from '../../components/ui/Card';
import { dashboardZoneFor } from '../../config/dashboardPaths';
import { usePageMeta } from '../../hooks/usePageMeta';

const ZONE_LABELS: Record<string, string> = {
  '/dashboard/client': 'Кабинет',
  '/dashboard/manager': 'Рабочий стол',
  '/dashboard/admin': 'Пульт',
};

function errorMessage(error: unknown) {
  if (error instanceof Error && error.message.trim()) return error.message;
  if (typeof error === 'string' && error.trim()) return error;
  return 'Не удалось отрисовать этот раздел. Попробуйте обновить страницу.';
}

export function DashboardErrorPage() {
  usePageMeta({
    title: 'Ошибка кабинета',
    description: 'Раздел кабинета не удалось открыть.',
  });

  const location = useLocation();
  const error = useRouteError();
  const zoneHome = dashboardZoneFor(location.pathname);
  const zoneLabel = ZONE_LABELS[zoneHome] || 'Кабинет';

  return (
    <div className="stack dashboard-page">
      <PageHeader
        title="Раздел временно недоступен"
        description="Страница кабинета не открылась. Данные не потерялись — можно вернуться и продолжить работу."
        breadcrumbs={[{ label: zoneLabel, to: zoneHome }, { label: 'Ошибка' }]}
      />
      <Card className="dashboard-not-found-card">
        <p className="dashboard-not-found-lead">{errorMessage(error)}</p>
        <div className="dashboard-not-found-actions">
          <Link className="btn btn-primary" to={zoneHome}>
            {zoneLabel === 'Кабинет' ? 'В кабинет' : `В «${zoneLabel}»`}
          </Link>
          <button type="button" className="btn btn-secondary" onClick={() => window.location.reload()}>
            Обновить страницу
          </button>
        </div>
      </Card>
    </div>
  );
}
