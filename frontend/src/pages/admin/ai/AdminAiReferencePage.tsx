import { useEffect, useState } from 'react';
import {
  createReferenceMaterial,
  createServiceCategory,
  deleteReferenceMaterial,
  deleteServiceCategory,
  listReferenceMaterials,
  listServiceCategories,
  updateReferenceMaterial,
  updateServiceCategory,
  type ReferenceMaterial,
  type ServiceCategory,
} from '../../../api/adminReference';
import { PageHeader } from '../../../components/layout/dashboard/PageHeader';
import { Button } from '../../../components/ui/Button';
import { Card } from '../../../components/ui/Card';
import { DataTable } from '../../../components/ui/DataTable';
import { EmptyState } from '../../../components/ui/EmptyState';
import { ErrorState } from '../../../components/ui/ErrorState';
import { Loader } from '../../../components/ui/Loader';
import { Tabs } from '../../../components/ui/Tabs';
import { resolveAdminBreadcrumbs } from '../../../config/adminRoutes';
import { usePageMeta } from '../../../hooks/usePageMeta';

export function AdminAiReferencePage() {
  usePageMeta({ title: 'Справочники ИИ', description: 'Категории услуг и справочные материалы.' });
  const [tab, setTab] = useState('categories');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [categories, setCategories] = useState<ServiceCategory[]>([]);
  const [materials, setMaterials] = useState<ReferenceMaterial[]>([]);
  const [catName, setCatName] = useState('');
  const [matTitle, setMatTitle] = useState('');
  const [matBody, setMatBody] = useState('');

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const [cats, mats] = await Promise.all([listServiceCategories(), listReferenceMaterials()]);
      setCategories(cats);
      setMaterials(mats.filter((m) => !m.title.startsWith('[CMS_')));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Ошибка загрузки');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
  }, []);

  if (loading) return <Loader />;
  if (error) return <ErrorState message={error} onRetry={() => void load()} />;

  return (
    <div className="stack dashboard-page">
      <PageHeader
        title="Справочники"
        description="Категории услуг и материалы для контекста ИИ-диагностики."
        breadcrumbs={resolveAdminBreadcrumbs('/dashboard/admin/ai/reference')}
      />

      <Tabs
        value={tab}
        onChange={setTab}
        items={[
          { id: 'categories', label: 'Категории услуг' },
          { id: 'materials', label: 'Материалы' },
        ]}
      />

      {tab === 'categories' ? (
        <Card>
          <form
            className="admin-inline-form"
            onSubmit={(e) => {
              e.preventDefault();
              if (!catName.trim()) return;
              void createServiceCategory({ name: catName.trim() })
                .then(() => {
                  setCatName('');
                  return load();
                })
                .catch((err) => setError(err instanceof Error ? err.message : 'Ошибка'));
            }}
          >
            <input
              value={catName}
              onChange={(e) => setCatName(e.target.value)}
              placeholder="Название категории"
              aria-label="Название категории"
            />
            <Button type="submit">Добавить</Button>
          </form>
          {!categories.length ? (
            <EmptyState title="Категорий нет" />
          ) : (
            <DataTable
              columns={[
                { key: 'name', label: 'Название' },
                { key: 'description', label: 'Описание' },
                { key: 'actions', label: '' },
              ]}
              rows={categories.map((c) => ({
                name: c.name,
                description: c.description || '—',
                actions: (
                  <div className="row gap-sm">
                    <Button
                      variant="ghost"
                      onClick={() => {
                        const name = window.prompt('Название', c.name);
                        if (name?.trim()) void updateServiceCategory(c.id, { name: name.trim() }).then(load);
                      }}
                    >
                      Изменить
                    </Button>
                    <Button variant="ghost" onClick={() => void deleteServiceCategory(c.id).then(load)}>
                      Удалить
                    </Button>
                  </div>
                ),
              }))}
            />
          )}
        </Card>
      ) : (
        <Card>
          <form
            className="stack compact"
            onSubmit={(e) => {
              e.preventDefault();
              if (!matTitle.trim() || !matBody.trim()) return;
              void createReferenceMaterial({ title: matTitle.trim(), body: matBody.trim() })
                .then(() => {
                  setMatTitle('');
                  setMatBody('');
                  return load();
                })
                .catch((err) => setError(err instanceof Error ? err.message : 'Ошибка'));
            }}
          >
            <input
              value={matTitle}
              onChange={(e) => setMatTitle(e.target.value)}
              placeholder="Заголовок материала"
              aria-label="Заголовок"
            />
            <textarea
              value={matBody}
              onChange={(e) => setMatBody(e.target.value)}
              placeholder="Текст для справочника"
              aria-label="Текст материала"
              rows={4}
            />
            <Button type="submit">Добавить материал</Button>
          </form>
          {!materials.length ? (
            <EmptyState title="Материалов нет" />
          ) : (
            <ul className="simple-list admin-material-list">
              {materials.map((m) => (
                <li key={m.id}>
                  <div>
                    <strong>{m.title}</strong>
                    <p className="muted-text">{m.body.slice(0, 180)}{m.body.length > 180 ? '…' : ''}</p>
                  </div>
                  <div className="row gap-sm">
                    <Button
                      variant="ghost"
                      onClick={() => {
                        const title = window.prompt('Заголовок', m.title);
                        const body = window.prompt('Текст', m.body);
                        if (title?.trim() && body?.trim()) {
                          void updateReferenceMaterial(m.id, { title: title.trim(), body: body.trim() }).then(load);
                        }
                      }}
                    >
                      Изменить
                    </Button>
                    <Button variant="ghost" onClick={() => void deleteReferenceMaterial(m.id).then(load)}>
                      Удалить
                    </Button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </Card>
      )}
    </div>
  );
}
