import { useEffect, useState } from 'react';
import { listCmsItems } from '../../api/dashboard';
import { PageHeader } from '../../components/layout/dashboard/PageHeader';
import { Card } from '../../components/ui/Card';
import { DataTable } from '../../components/ui/DataTable';
import { EmptyState } from '../../components/ui/EmptyState';
import { ErrorState } from '../../components/ui/ErrorState';
import { Loader } from '../../components/ui/Loader';
import { resolveAdminBreadcrumbs } from '../../config/adminRoutes';
import { usePageMeta } from '../../hooks/usePageMeta';

export function AdminCmsPage() {
  usePageMeta({ title: 'Содержимое сайта', description: 'Управление блоками публичных страниц.' });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [items, setItems] = useState<Awaited<ReturnType<typeof listCmsItems>>>([]);

  useEffect(() => {
    void listCmsItems()
      .then(setItems)
      .catch((e) => setError(e instanceof Error ? e.message : 'Ошибка загрузки'))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <Loader />;
  if (error) return <ErrorState message={error} />;

  return (
    <div className="stack dashboard-page">
      <PageHeader
        title="Услуги и галерея"
        description="Блоки главной, услуг, работ и галереи. Полное редактирование — в фазе C."
        breadcrumbs={resolveAdminBreadcrumbs('/dashboard/admin/site/items')}
      />
      <Card>
        {!items.length ? (
          <EmptyState title="Контент не найден" description="Запустите seed или добавьте блоки через API." />
        ) : (
          <DataTable
            columns={[
              { key: 'kind', label: 'Раздел' },
              { key: 'title', label: 'Заголовок' },
              { key: 'published', label: 'Опубликовано' },
              { key: 'orderIndex', label: 'Порядок' },
            ]}
            rows={items.map((item) => ({
              kind: item.kind,
              title: item.title,
              published: item.published ? 'Да' : 'Черновик',
              orderIndex: item.orderIndex,
            }))}
          />
        )}
      </Card>
    </div>
  );
}
