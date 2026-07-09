import { Link } from 'react-router-dom';
import { api } from '../../api/client';
import { Card } from '../../components/ui/Card';
import { EmptyState } from '../../components/ui/EmptyState';
import { ErrorState } from '../../components/ui/ErrorState';
import { Loader } from '../../components/ui/Loader';
import { useAsyncState } from '../../hooks/useAsyncState';
import { usePageMeta } from '../../hooks/usePageMeta';
import { STORAGE_KEYS } from '../../lib/storageKeys';

interface ServiceItem {
  id: string;
  title: string;
  description?: string;
  price?: string;
  category?: string;
}

export function ServicesPage() {
  usePageMeta({
    title: 'Возможности и услуги',
    description: 'Демонстрация сервисных категорий и сценариев обработки обращений автосервиса.',
  });
  const { data, error, loading } = useAsyncState<ServiceItem[]>(() =>
    api('/content/site-items?kind=service'),
  );

  function handleSelectService(item: ServiceItem) {
    sessionStorage.setItem(
      STORAGE_KEYS.bookingPrefill,
      JSON.stringify({ serviceTitle: item.title, categoryLabel: item.category || '' }),
    );
  }

  return (
    <div className="stack">
      <h1>Услуги</h1>
      {loading ? <Loader /> : null}
      {error ? <ErrorState message={error} /> : null}
      {!loading && !error && data?.length === 0 ? <EmptyState description="Услуги пока не опубликованы." /> : null}
      <div className="grid three">
        {data?.map((item) => (
          <Card key={item.id}>
            <h3>{item.title}</h3>
            <p>{item.description || 'Описание отсутствует.'}</p>
            <p className="muted">{item.price || 'Стоимость уточняется'}</p>
            <Link to="/booking" className="btn btn-secondary" onClick={() => handleSelectService(item)}>
              Выбрать услугу
            </Link>
          </Card>
        ))}
      </div>
    </div>
  );
}
