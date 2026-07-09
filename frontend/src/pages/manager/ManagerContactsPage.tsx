import { useEffect, useState } from 'react';
import { listContacts } from '../../api/dashboard';
import { PageHeader } from '../../components/layout/dashboard/PageHeader';
import { Card } from '../../components/ui/Card';
import { DataTable } from '../../components/ui/DataTable';
import { EmptyState } from '../../components/ui/EmptyState';
import { ErrorState } from '../../components/ui/ErrorState';
import { Loader } from '../../components/ui/Loader';
import { usePageMeta } from '../../hooks/usePageMeta';

export function ManagerContactsPage() {
  usePageMeta({ title: 'Обращения с сайта', description: 'Сообщения из формы обратной связи.' });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [contacts, setContacts] = useState<Awaited<ReturnType<typeof listContacts>>>([]);

  useEffect(() => {
    void listContacts()
      .then(setContacts)
      .catch((e) => setError(e instanceof Error ? e.message : 'Ошибка загрузки'))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <Loader />;
  if (error) return <ErrorState message={error} />;

  return (
    <div className="stack dashboard-page">
      <PageHeader
        title="Обращения с сайта"
        description="Новые контакты и вопросы с публичных страниц."
        breadcrumbs={[
          { label: 'Рабочий стол', to: '/dashboard/manager' },
          { label: 'Обращения' },
        ]}
      />

      <Card>
        {!contacts.length ? (
          <EmptyState title="Обращений нет" description="Все новые сообщения уже обработаны." />
        ) : (
          <>
            <div className="desktop-only">
              <DataTable
                columns={[
                  { key: 'fullName', label: 'Имя' },
                  { key: 'phone', label: 'Телефон' },
                  { key: 'message', label: 'Сообщение' },
                ]}
                rows={contacts.map((item) => ({
                  fullName: item.fullName,
                  phone: item.phone,
                  message: item.message || '—',
                }))}
              />
            </div>
            <div className="mobile-only responsive-card-list">
              {contacts.map((item) => (
                <article key={item.id} className="responsive-data-card">
                  <strong>{item.fullName}</strong>
                  <a href={`tel:${item.phone}`}>{item.phone}</a>
                  <p>{item.message || 'Без текста'}</p>
                </article>
              ))}
            </div>
          </>
        )}
      </Card>
    </div>
  );
}
