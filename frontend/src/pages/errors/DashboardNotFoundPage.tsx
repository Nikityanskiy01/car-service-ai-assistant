import { Link, useLocation } from 'react-router-dom';
import { PageHeader } from '../../components/layout/dashboard/PageHeader';
import { Card } from '../../components/ui/Card';
import { dashboardZoneFor } from '../../config/dashboardPaths';
import { usePageMeta } from '../../hooks/usePageMeta';

const ZONE_LABELS: Record<string, string> = {
  '/dashboard/client': 'Кабинет',
  '/dashboard/manager': 'Рабочий стол',
  '/dashboard/admin': 'Пульт',
};

export function DashboardNotFoundPage() {
  usePageMeta({
    title: 'Страница не найдена',
    description: 'Запрошенный раздел кабинета отсутствует.',
  });

  const location = useLocation();
  const zoneHome = dashboardZoneFor(location.pathname);
  const zoneLabel = ZONE_LABELS[zoneHome] || 'Кабинет';

  return (
    <div className="stack dashboard-page">
      <PageHeader
        title="Страница не найдена"
        description="Такого раздела в кабинете нет — возможно, ссылка устарела."
        breadcrumbs={[{ label: zoneLabel, to: zoneHome }, { label: 'Ошибка' }]}
      />
      <Card className="dashboard-not-found-card">
        <p className="dashboard-not-found-lead">
          Проверьте адрес или вернитесь к основным разделам через меню слева.
        </p>
        <div className="dashboard-not-found-actions">
          <Link className="btn btn-primary" to={zoneHome}>
            {zoneLabel === 'Кабинет' ? 'В кабинет' : `В «${zoneLabel}»`}
          </Link>
          <Link className="btn btn-secondary" to="/">
            На сайт
          </Link>
        </div>
      </Card>
    </div>
  );
}
