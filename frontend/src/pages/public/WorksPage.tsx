import { api } from '../../api/client';
import { Card } from '../../components/ui/Card';
import { EmptyState } from '../../components/ui/EmptyState';
import { ErrorState } from '../../components/ui/ErrorState';
import { Loader } from '../../components/ui/Loader';
import { useAsyncState } from '../../hooks/useAsyncState';
import { usePageMeta } from '../../hooks/usePageMeta';

interface WorkItem {
  id: string;
  title: string;
  problem?: string;
  result?: string;
  term?: string;
}

export function WorksPage() {
  usePageMeta({
    title: 'Сценарии работ',
    description: 'Примеры обращений, результатов и формата представления выполненных работ.',
  });
  const { data, error, loading } = useAsyncState<WorkItem[]>(() => api('/content/site-items?kind=work'));
  return (
    <div className="stack">
      <h1>Выполненные работы</h1>
      {loading ? <Loader /> : null}
      {error ? <ErrorState message={error} /> : null}
      {!loading && !error && data?.length === 0 ? <EmptyState description="Пока нет опубликованных кейсов." /> : null}
      <div className="grid two">
        {data?.map((item) => (
          <Card key={item.id}>
            <h3>{item.title}</h3>
            <p>
              <strong>Проблема:</strong> {item.problem || '—'}
            </p>
            <p>
              <strong>Результат:</strong> {item.result || '—'}
            </p>
            <p className="muted">{item.term || 'Срок уточняется'}</p>
          </Card>
        ))}
      </div>
    </div>
  );
}
