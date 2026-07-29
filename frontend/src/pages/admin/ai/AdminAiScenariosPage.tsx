import { useCallback, useEffect, useState } from 'react';
import {
  createScenario,
  createScenarioHint,
  createScenarioQuestion,
  deleteScenario,
  deleteScenarioHint,
  deleteScenarioQuestion,
  listScenarios,
  updateScenario,
  updateScenarioHint,
  updateScenarioQuestion,
  type ConsultationScenario,
} from '../../../api/adminReference';
import { PageHeader } from '../../../components/layout/dashboard/PageHeader';
import { Button } from '../../../components/ui/Button';
import { Card } from '../../../components/ui/Card';
import { ConfirmDialog } from '../../../components/ui/ConfirmDialog';
import { EmptyState } from '../../../components/ui/EmptyState';
import { ErrorState } from '../../../components/ui/ErrorState';
import { Loader } from '../../../components/ui/Loader';
import { resolveAdminBreadcrumbs } from '../../../config/adminRoutes';
import { usePageMeta } from '../../../hooks/usePageMeta';

export function AdminAiScenariosPage() {
  usePageMeta({ title: 'Сценарии ИИ', description: 'Шаблоны вопросов и подсказок для консультации.' });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [scenarios, setScenarios] = useState<ConsultationScenario[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [newTitle, setNewTitle] = useState('');
  const [newDescription, setNewDescription] = useState('');
  const [questionText, setQuestionText] = useState('');
  const [hintText, setHintText] = useState('');
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const selected = scenarios.find((s) => s.id === selectedId) || null;

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const rows = await listScenarios();
      setScenarios(rows);
      setSelectedId((prev) => prev || rows[0]?.id || null);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Ошибка загрузки');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, []);

  async function onCreateScenario(e: React.FormEvent) {
    e.preventDefault();
    if (!newTitle.trim()) return;
    setSaving(true);
    try {
      const row = await createScenario({ title: newTitle.trim(), description: newDescription.trim() || undefined });
      setNewTitle('');
      setNewDescription('');
      await load();
      setSelectedId(row.id);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Не удалось создать сценарий');
    } finally {
      setSaving(false);
    }
  }

  async function toggleActive(scenario: ConsultationScenario) {
    try {
      await updateScenario(scenario.id, { active: !scenario.active });
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Не удалось обновить сценарий');
    }
  }

  async function onAddQuestion(e: React.FormEvent) {
    e.preventDefault();
    if (!selected || !questionText.trim()) return;
    setSaving(true);
    try {
      const order = (selected.questions?.length || 0) + 1;
      await createScenarioQuestion(selected.id, { text: questionText.trim(), order });
      setQuestionText('');
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Не удалось добавить вопрос');
    } finally {
      setSaving(false);
    }
  }

  async function onAddHint(e: React.FormEvent) {
    e.preventDefault();
    if (!selected || !hintText.trim()) return;
    setSaving(true);
    try {
      const order = (selected.hints?.length || 0) + 1;
      await createScenarioHint(selected.id, { text: hintText.trim(), order });
      setHintText('');
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Не удалось добавить подсказку');
    } finally {
      setSaving(false);
    }
  }

  async function confirmDelete() {
    if (!pendingDeleteId) return;
    try {
      await deleteScenario(pendingDeleteId);
      setPendingDeleteId(null);
      if (selectedId === pendingDeleteId) setSelectedId(null);
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Не удалось удалить сценарий');
    }
  }

  if (loading) return <Loader label="Загружаем сценарии..." />;
  if (error && !scenarios.length) return <ErrorState message={error} onRetry={() => void load()} />;

  return (
    <div className="stack dashboard-page">
      <PageHeader
        title="Сценарии консультации"
        description="Вопросы и подсказки, которые видит клиент в ИИ-диагностике."
        breadcrumbs={resolveAdminBreadcrumbs('/dashboard/admin/ai/scenarios')}
      />

      {error ? <ErrorState message={error} onRetry={() => void load()} /> : null}

      <div className="admin-scenario-layout">
        <Card>
          <h2>Сценарии</h2>
          <form className="stack compact admin-inline-form" onSubmit={(e) => void onCreateScenario(e)}>
            <input
              value={newTitle}
              onChange={(e) => setNewTitle(e.target.value)}
              placeholder="Название сценария"
              aria-label="Название сценария"
              required
            />
            <input
              value={newDescription}
              onChange={(e) => setNewDescription(e.target.value)}
              placeholder="Описание (необязательно)"
              aria-label="Описание сценария"
            />
            <Button type="submit" disabled={saving}>
              Создать
            </Button>
          </form>

          {!scenarios.length ? (
            <EmptyState title="Сценариев нет" description="Создайте первый сценарий для клиентской консультации." />
          ) : (
            <ul className="admin-scenario-list">
              {scenarios.map((item) => (
                <li key={item.id}>
                  <button
                    type="button"
                    className={`admin-scenario-item${selectedId === item.id ? ' active' : ''}`}
                    onClick={() => setSelectedId(item.id)}
                  >
                    <strong>{item.title}</strong>
                    <span>
                      {item.questions?.length || 0} вопр. · {item.hints?.length || 0} подск.
                      {!item.active ? ' · выкл' : ''}
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
              <EmptyState title="Выберите сценарий" description="Слева — список сценариев консультации." />
            </Card>
          ) : (
            <>
              <Card>
                <div className="card-header-row">
                  <div>
                    <h2>{selected.title}</h2>
                    {selected.description ? <p className="muted-text">{selected.description}</p> : null}
                  </div>
                  <div className="row gap-sm">
                    <Button variant="secondary" onClick={() => void toggleActive(selected)}>
                      {selected.active ? 'Деактивировать' : 'Активировать'}
                    </Button>
                    <Button variant="ghost" onClick={() => setPendingDeleteId(selected.id)}>
                      Удалить
                    </Button>
                  </div>
                </div>
              </Card>

              <Card>
                <h3>Вопросы</h3>
                <form className="admin-inline-form" onSubmit={(e) => void onAddQuestion(e)}>
                  <input
                    value={questionText}
                    onChange={(e) => setQuestionText(e.target.value)}
                    placeholder="Текст вопроса"
                    aria-label="Новый вопрос"
                  />
                  <Button type="submit" disabled={saving}>
                    Добавить
                  </Button>
                </form>
                <ul className="simple-list admin-editable-list">
                  {(selected.questions || []).map((q) => (
                    <li key={q.id}>
                      <span>{q.order}. {q.text}</span>
                      <div className="row gap-sm">
                        <Button
                          variant="ghost"
                          onClick={() => {
                            const text = window.prompt('Текст вопроса', q.text);
                            if (text?.trim()) void updateScenarioQuestion(q.id, { text: text.trim() }).then(load);
                          }}
                        >
                          Изменить
                        </Button>
                        <Button variant="ghost" onClick={() => void deleteScenarioQuestion(q.id).then(load)}>
                          Удалить
                        </Button>
                      </div>
                    </li>
                  ))}
                </ul>
              </Card>

              <Card>
                <h3>Подсказки</h3>
                <form className="admin-inline-form" onSubmit={(e) => void onAddHint(e)}>
                  <input
                    value={hintText}
                    onChange={(e) => setHintText(e.target.value)}
                    placeholder="Текст подсказки"
                    aria-label="Новая подсказка"
                  />
                  <Button type="submit" disabled={saving}>
                    Добавить
                  </Button>
                </form>
                <ul className="simple-list admin-editable-list">
                  {(selected.hints || []).map((h) => (
                    <li key={h.id}>
                      <span>{h.order}. {h.text}</span>
                      <div className="row gap-sm">
                        <Button
                          variant="ghost"
                          onClick={() => {
                            const text = window.prompt('Текст подсказки', h.text);
                            if (text?.trim()) void updateScenarioHint(h.id, { text: text.trim() }).then(load);
                          }}
                        >
                          Изменить
                        </Button>
                        <Button variant="ghost" onClick={() => void deleteScenarioHint(h.id).then(load)}>
                          Удалить
                        </Button>
                      </div>
                    </li>
                  ))}
                </ul>
              </Card>
            </>
          )}
        </div>
      </div>

      <ConfirmDialog
        open={!!pendingDeleteId}
        title="Удалить сценарий?"
        text="Вопросы и подсказки будут удалены без возможности восстановления."
        onCancel={() => setPendingDeleteId(null)}
        onConfirm={() => void confirmDelete()}
      />
    </div>
  );
}
