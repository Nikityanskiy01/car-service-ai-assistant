import { api } from '../../api/client';
import { Card } from '../../components/ui/Card';
import { EmptyState } from '../../components/ui/EmptyState';
import { ErrorState } from '../../components/ui/ErrorState';
import { Loader } from '../../components/ui/Loader';
import { useAsyncState } from '../../hooks/useAsyncState';
import { usePageMeta } from '../../hooks/usePageMeta';

interface GalleryItem {
  id: string;
  title: string;
  description?: string;
  imageUrl?: string;
}

export function GalleryPage() {
  usePageMeta({
    title: 'Интерфейсы и демонстрационные материалы',
    description: 'Галерея экранов продукта и сценариев использования для потенциальных клиентов автосервиса.',
  });
  const { data, error, loading } = useAsyncState<GalleryItem[]>(() => api('/content/site-items?kind=gallery'));
  return (
    <div className="stack">
      <h1>Галерея</h1>
      {loading ? <Loader /> : null}
      {error ? <ErrorState message={error} /> : null}
      {!loading && !error && data?.length === 0 ? <EmptyState description="Галерея пока пустая." /> : null}
      <div className="grid three">
        {data?.map((item) => (
          <Card key={item.id}>
            {item.imageUrl ? <img src={item.imageUrl} alt={item.title} className="image-cover" /> : null}
            <h3>{item.title}</h3>
            <p>{item.description || 'Описание отсутствует.'}</p>
          </Card>
        ))}
      </div>
    </div>
  );
}
