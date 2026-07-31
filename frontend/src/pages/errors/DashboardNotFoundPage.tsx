import { Link } from 'react-router-dom';
import { PageHeader } from '../../components/layout/dashboard/PageHeader';
import { Card } from '../../components/ui/Card';
import { usePageMeta } from '../../hooks/usePageMeta';

export function DashboardNotFoundPage() {
  usePageMeta({
    title: 'Страница не найдена',
    description: 'Запрошенный раздел кабинета отсутствует.',
  });

  return (
    <div className="stack dashboard-page">
      <PageHeader
        title="Страница не найдена"
        description="Такого раздела в кабинете нет — возможно, ссылка устарела."
        breadcrumbs={[{ label: 'Кабинет', to: '/dashboard/client' }, { label: 'Ошибка' }]}
      />
      <Card className="dashboard-not-found-card">
        <p className="dashboard-not-found-lead">
          Проверьте адрес или вернитесь к основным разделам: обращения, записи или профиль.
        </p>
        <div className="dashboard-not-found-actions">
          <Link className="btn btn-primary" to="/dashboard/client">
            В кабинет
          </Link>
          <Link className="btn btn-secondary" to="/dashboard/client/bookings">
            Мои записи
          </Link>
        </div>
      </Card>
    </div>
  );
}
