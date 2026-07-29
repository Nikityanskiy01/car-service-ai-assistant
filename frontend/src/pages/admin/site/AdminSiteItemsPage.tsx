import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  createSiteItem,
  deleteSiteItem,
  listSiteItems,
  reorderSiteItems,
  updateSiteItem,
  type SiteCmsItem,
} from '../../../api/adminSite';
import { PageHeader } from '../../../components/layout/dashboard/PageHeader';
import { Button } from '../../../components/ui/Button';
import { Card } from '../../../components/ui/Card';
import { ConfirmDialog } from '../../../components/ui/ConfirmDialog';
import { EmptyState } from '../../../components/ui/EmptyState';
import { ErrorState } from '../../../components/ui/ErrorState';
import { Loader } from '../../../components/ui/Loader';
import { Tabs } from '../../../components/ui/Tabs';
import { resolveAdminBreadcrumbs } from '../../../config/adminRoutes';
import { usePageMeta } from '../../../hooks/usePageMeta';

const KIND_LABELS: Record<SiteCmsItem['kind'], string> = {
  service: 'Услуги',
  work: 'Работы',
  gallery: 'Галерея',
};

const PREVIEW_PATH: Record<SiteCmsItem['kind'], string> = {
  service: '/services',
  work: '/works',
  gallery: '/gallery',
};

type FormState = {
  title: string;
  description: string;
  price: string;
  category: string;
  imageUrl: string;
  problem: string;
  result: string;
  term: string;
  published: boolean;
};

const emptyForm = (): FormState => ({
  title: '',
  description: '',
  price: '',
  category: '',
  imageUrl: '',
  problem: '',
  result: '',
  term: '',
  published: true,
});

export function AdminSiteItemsPage() {
  usePageMeta({ title: 'Контент сайта', description: 'Услуги, работы и галерея.' });
  const [kind, setKind] = useState<SiteCmsItem['kind']>('service');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [items, setItems] = useState<SiteCmsItem[]>([]);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<FormState>(emptyForm);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setItems(await listSiteItems(kind));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Ошибка загрузки');
    } finally {
      setLoading(false);
    }
  }, [kind]);

  useEffect(() => {
    void load();
    setEditingId(null);
    setForm(emptyForm());
  }, [load]);

  const sorted = useMemo(
    () => [...items].sort((a, b) => a.orderIndex - b.orderIndex || a.title.localeCompare(b.title, 'ru')),
    [items],
  );

  function startEdit(item: SiteCmsItem) {
    setEditingId(item.id);
    setForm({
      title: item.title || '',
      description: item.description || '',
      price: item.price || '',
      category: item.category || '',
      imageUrl: item.imageUrl || '',
      problem: item.problem || '',
      result: item.result || '',
      term: item.term || '',
      published: item.published,
    });
  }

  async function onSave(e: React.FormEvent) {
    e.preventDefault();
    if (!form.title.trim()) return;
    setSaving(true);
    setError(null);
    try {
      const payload = { kind, ...form, title: form.title.trim() };
      if (editingId) await updateSiteItem(editingId, payload);
      else await createSiteItem(payload);
      setEditingId(null);
      setForm(emptyForm());
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Ошибка сохранения');
    } finally {
      setSaving(false);
    }
  }

  async function moveItem(id: string, dir: -1 | 1) {
    const idx = sorted.findIndex((x) => x.id === id);
    const target = idx + dir;
    if (idx < 0 || target < 0 || target >= sorted.length) return;
    const ids = sorted.map((x) => x.id);
    const tmp = ids[idx];
    ids[idx] = ids[target];
    ids[target] = tmp;
    await reorderSiteItems(kind, ids);
    await load();
  }

  return (
    <div className="stack dashboard-page">
      <PageHeader
        title="Услуги и галерея"
        description="Публикация карточек на публичных страницах сервиса."
        breadcrumbs={resolveAdminBreadcrumbs('/dashboard/admin/site/items')}
        actions={
          <Link to={PREVIEW_PATH[kind]} className="btn btn-secondary" target="_blank" rel="noreferrer">
            Предпросмотр
          </Link>
        }
      />

      <Tabs
        value={kind}
        onChange={(v) => setKind(v as SiteCmsItem['kind'])}
        items={[
          { id: 'service', label: 'Услуги' },
          { id: 'work', label: 'Работы' },
          { id: 'gallery', label: 'Галерея' },
        ]}
      />

      {loading ? <Loader /> : null}
      {error ? <ErrorState message={error} onRetry={() => void load()} /> : null}

      <div className="admin-scenario-layout">
        <Card>
          <h2>{editingId ? 'Редактирование' : 'Новая запись'}</h2>
          <form className="stack compact" onSubmit={(e) => void onSave(e)}>
            <input
              value={form.title}
              onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
              placeholder="Заголовок"
              required
              aria-label="Заголовок"
            />
            <textarea
              value={form.description}
              onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
              placeholder="Описание"
              rows={3}
              aria-label="Описание"
            />
            {kind === 'service' ? (
              <>
                <input
                  value={form.price}
                  onChange={(e) => setForm((f) => ({ ...f, price: e.target.value }))}
                  placeholder="Цена от"
                  aria-label="Цена"
                />
                <input
                  value={form.category}
                  onChange={(e) => setForm((f) => ({ ...f, category: e.target.value }))}
                  placeholder="Категория"
                  aria-label="Категория"
                />
              </>
            ) : null}
            {kind === 'work' ? (
              <>
                <input
                  value={form.problem}
                  onChange={(e) => setForm((f) => ({ ...f, problem: e.target.value }))}
                  placeholder="Проблема"
                  aria-label="Проблема"
                />
                <input
                  value={form.result}
                  onChange={(e) => setForm((f) => ({ ...f, result: e.target.value }))}
                  placeholder="Результат"
                  aria-label="Результат"
                />
                <input
                  value={form.term}
                  onChange={(e) => setForm((f) => ({ ...f, term: e.target.value }))}
                  placeholder="Срок"
                  aria-label="Срок"
                />
              </>
            ) : null}
            <input
              value={form.imageUrl}
              onChange={(e) => setForm((f) => ({ ...f, imageUrl: e.target.value }))}
              placeholder="URL изображения (https://)"
              aria-label="URL изображения"
            />
            <label className="checkbox-row">
              <input
                type="checkbox"
                checked={form.published}
                onChange={(e) => setForm((f) => ({ ...f, published: e.target.checked }))}
              />
              Опубликовано
            </label>
            <div className="row gap-sm">
              <Button type="submit" disabled={saving}>
                {editingId ? 'Сохранить' : 'Создать'}
              </Button>
              {editingId ? (
                <Button
                  type="button"
                  variant="ghost"
                  onClick={() => {
                    setEditingId(null);
                    setForm(emptyForm());
                  }}
                >
                  Отмена
                </Button>
              ) : null}
            </div>
          </form>
        </Card>

        <Card>
          <h2>
            {KIND_LABELS[kind]} ({sorted.length})
          </h2>
          {!sorted.length && !loading ? (
            <EmptyState title="Записей нет" description="Добавьте первую карточку слева." />
          ) : (
            <ul className="simple-list admin-editable-list">
              {sorted.map((item) => (
                <li key={item.id}>
                  <div>
                    <strong>{item.title}</strong>
                    <span className="muted">
                      #{item.orderIndex} · {item.published ? 'опубликовано' : 'черновик'}
                    </span>
                  </div>
                  <div className="row gap-sm">
                    <Button variant="ghost" onClick={() => void moveItem(item.id, -1)}>
                      ↑
                    </Button>
                    <Button variant="ghost" onClick={() => void moveItem(item.id, 1)}>
                      ↓
                    </Button>
                    <Button variant="ghost" onClick={() => startEdit(item)}>
                      Изменить
                    </Button>
                    <Button variant="ghost" onClick={() => setDeleteId(item.id)}>
                      Удалить
                    </Button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>

      <ConfirmDialog
        open={!!deleteId}
        title="Удалить запись?"
        text="Карточка исчезнет с публичного сайта."
        onCancel={() => setDeleteId(null)}
        onConfirm={() => {
          if (!deleteId) return;
          void deleteSiteItem(deleteId)
            .then(() => {
              setDeleteId(null);
              return load();
            })
            .catch((e) => setError(e instanceof Error ? e.message : 'Ошибка удаления'));
        }}
      />
    </div>
  );
}
