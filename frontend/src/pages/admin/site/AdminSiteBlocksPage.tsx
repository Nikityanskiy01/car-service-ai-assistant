import { useCallback, useEffect, useState } from 'react';
import {
  createSiteContentBlock,
  listSiteContentBlocks,
  patchSiteContentBlock,
  rollbackSiteContentBlock,
  type SiteContentBlock,
} from '../../../api/adminSite';
import { PageHeader } from '../../../components/layout/dashboard/PageHeader';
import { Button } from '../../../components/ui/Button';
import { Card } from '../../../components/ui/Card';
import { EmptyState } from '../../../components/ui/EmptyState';
import { ErrorState } from '../../../components/ui/ErrorState';
import { Loader } from '../../../components/ui/Loader';
import { resolveAdminBreadcrumbs } from '../../../config/adminRoutes';
import { usePageMeta } from '../../../hooks/usePageMeta';

export function AdminSiteBlocksPage() {
  usePageMeta({ title: 'Текстовые блоки', description: 'Версионируемый контент сайта.' });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [blocks, setBlocks] = useState<SiteContentBlock[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [newKey, setNewKey] = useState('');
  const [newTitle, setNewTitle] = useState('');
  const [newSection, setNewSection] = useState('general');
  const [newContent, setNewContent] = useState('');
  const [editTitle, setEditTitle] = useState('');
  const [editSection, setEditSection] = useState('');
  const [editContent, setEditContent] = useState('');
  const [editPublished, setEditPublished] = useState(false);
  const [saving, setSaving] = useState(false);

  const selected = blocks.find((b) => b.id === selectedId) || null;

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const rows = await listSiteContentBlocks();
      setBlocks(rows);
      setSelectedId((prev) => prev || rows[0]?.id || null);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Ошибка загрузки');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (!selected) return;
    setEditTitle(selected.title);
    setEditSection(selected.section);
    setEditContent(selected.content);
    setEditPublished(selected.isPublished);
  }, [selected]);

  async function onCreate(e: React.FormEvent) {
    e.preventDefault();
    if (!newKey.trim() || !newTitle.trim() || !newContent.trim()) return;
    setSaving(true);
    try {
      const row = await createSiteContentBlock({
        key: newKey.trim(),
        title: newTitle.trim(),
        section: newSection.trim() || 'general',
        content: newContent.trim(),
      });
      setNewKey('');
      setNewTitle('');
      setNewContent('');
      await load();
      setSelectedId(row.id);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Ошибка создания');
    } finally {
      setSaving(false);
    }
  }

  async function onSaveBlock() {
    if (!selected) return;
    setSaving(true);
    try {
      await patchSiteContentBlock(selected.id, {
        title: editTitle.trim(),
        section: editSection.trim(),
        content: editContent.trim(),
        isPublished: editPublished,
        note: 'Редактирование в админке',
      });
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Ошибка сохранения');
    } finally {
      setSaving(false);
    }
  }

  if (loading) return <Loader label="Загружаем блоки..." />;
  if (error && !blocks.length) return <ErrorState message={error} onRetry={() => void load()} />;

  return (
    <div className="stack dashboard-page">
      <PageHeader
        title="Текстовые блоки"
        description="Контент с историей версий и откатом."
        breadcrumbs={resolveAdminBreadcrumbs('/dashboard/admin/site/blocks')}
      />

      {error ? <ErrorState message={error} onRetry={() => void load()} /> : null}

      <div className="admin-scenario-layout">
        <Card>
          <h2>Блоки</h2>
          <form className="stack compact" onSubmit={(e) => void onCreate(e)}>
            <input value={newKey} onChange={(e) => setNewKey(e.target.value)} placeholder="key (hero.title)" aria-label="Ключ" />
            <input value={newTitle} onChange={(e) => setNewTitle(e.target.value)} placeholder="Заголовок" aria-label="Заголовок" />
            <input value={newSection} onChange={(e) => setNewSection(e.target.value)} placeholder="Секция" aria-label="Секция" />
            <textarea value={newContent} onChange={(e) => setNewContent(e.target.value)} placeholder="Текст" rows={4} aria-label="Текст" />
            <Button type="submit" disabled={saving}>
              Создать блок
            </Button>
          </form>
          {!blocks.length ? (
            <EmptyState title="Блоков нет" />
          ) : (
            <ul className="admin-scenario-list">
              {blocks.map((block) => (
                <li key={block.id}>
                  <button
                    type="button"
                    className={`admin-scenario-item${selectedId === block.id ? ' active' : ''}`}
                    onClick={() => setSelectedId(block.id)}
                  >
                    <strong>{block.title}</strong>
                    <span>
                      {block.key} · {block.section} · {block.isPublished ? 'опубликован' : 'черновик'}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </Card>

        <div className="stack">
          {!selected ? (
            <Card>
              <EmptyState title="Выберите блок" />
            </Card>
          ) : (
            <>
              <Card>
                <h2>{selected.key}</h2>
                <div className="stack compact">
                  <input value={editTitle} onChange={(e) => setEditTitle(e.target.value)} aria-label="Заголовок блока" />
                  <input value={editSection} onChange={(e) => setEditSection(e.target.value)} aria-label="Секция блока" />
                  <textarea value={editContent} onChange={(e) => setEditContent(e.target.value)} rows={10} aria-label="Контент" />
                  <label className="checkbox-row">
                    <input type="checkbox" checked={editPublished} onChange={(e) => setEditPublished(e.target.checked)} />
                    Опубликован
                  </label>
                  <Button onClick={() => void onSaveBlock()} disabled={saving}>
                    Сохранить
                  </Button>
                </div>
              </Card>
              {selected.versions?.length ? (
                <Card>
                  <h3>Версии</h3>
                  <ul className="simple-list">
                    {selected.versions.map((v) => (
                      <li key={v.id}>
                        <div>
                          <strong>{new Date(v.createdAt).toLocaleString('ru-RU')}</strong>
                          <span className="muted">
                            {v.actor?.fullName || 'Система'}
                            {v.note ? ` · ${v.note}` : ''}
                          </span>
                          <p className="muted-text">{v.content.slice(0, 120)}{v.content.length > 120 ? '…' : ''}</p>
                        </div>
                        <Button
                          variant="ghost"
                          onClick={() => void rollbackSiteContentBlock(selected.id, v.id).then(load)}
                        >
                          Откатить
                        </Button>
                      </li>
                    ))}
                  </ul>
                </Card>
              ) : null}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
