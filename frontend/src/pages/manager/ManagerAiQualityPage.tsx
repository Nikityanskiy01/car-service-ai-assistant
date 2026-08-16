import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Download } from 'lucide-react';
import { toast } from '../../lib/toast';
import { getAiFeedbackReport, listServiceRequests, type AiFeedbackReport } from '../../api/dashboard';
import { downloadApiFile } from '../../api/downloads';
import { CategoryBarChart } from '../../components/analytics/CategoryBarChart';
import { InlineFeedbackQueue } from '../../components/manager/InlineFeedbackQueue';
import { Alert, AlertDescription, AlertTitle } from '../../components/console/ui/alert';
import { Button } from '../../components/console/ui/button';
import { managerZonePaths } from '../../config/managerPaths';
import { requestNeedsFeedback } from '../../lib/managerRequestHelpers';
import { usePageMeta } from '../../hooks/usePageMeta';

const paths = managerZonePaths(false);

const PERIODS = [
  { id: 'today', label: 'Сегодня' },
  { id: '7', label: '7 дней' },
  { id: '30', label: '30 дней' },
] as const;

const VERDICT_LABELS: Record<string, string> = {
  CORRECT: 'Верный',
  PARTIAL: 'Частично',
  INCORRECT: 'Неверный',
};

function formatWhen(iso: string) {
  return new Date(iso).toLocaleString('ru-RU', {
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function VerdictSplit({
  correct,
  partial,
  incorrect,
}: {
  correct: number;
  partial: number;
  incorrect: number;
}) {
  const total = correct + partial + incorrect;
  if (!total) {
    return <div className="ai-quality-split is-empty" aria-hidden />;
  }
  return (
    <div
      className="ai-quality-split"
      role="img"
      aria-label={`Верных ${correct}, частично ${partial}, неверных ${incorrect}`}
    >
      {correct ? <span className="is-correct" style={{ flexGrow: correct, flexBasis: 0 }} /> : null}
      {partial ? <span className="is-partial" style={{ flexGrow: partial, flexBasis: 0 }} /> : null}
      {incorrect ? <span className="is-incorrect" style={{ flexGrow: incorrect, flexBasis: 0 }} /> : null}
    </div>
  );
}

export function ManagerAiQualityPage() {
  usePageMeta({ title: 'Качество ИИ', description: 'Оценки диагнозов и зоны улучшения.' });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [report, setReport] = useState<AiFeedbackReport | null>(null);
  const [pendingItems, setPendingItems] = useState<Awaited<ReturnType<typeof listServiceRequests>>['items']>([]);
  const [period, setPeriod] = useState('7');
  const [reloadToken, setReloadToken] = useState(0);
  const [exporting, setExporting] = useState(false);

  const load = useCallback(async () => {
    const days = period === 'today' ? 1 : Number(period) || 7;
    setLoading(true);
    setError(null);
    try {
      const [feedback, requests] = await Promise.all([
        getAiFeedbackReport(days),
        listServiceRequests({ pageSize: 100, sort: 'createdAt', dir: 'desc' }),
      ]);
      setReport(feedback);
      setPendingItems(requests.items.filter((item) => requestNeedsFeedback(item, 24)));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Не удалось загрузить отчёт');
    } finally {
      setLoading(false);
    }
  }, [period]);

  useEffect(() => {
    void load();
  }, [load, reloadToken]);

  const days = period === 'today' ? 1 : Number(period) || 7;
  const pendingCount = pendingItems.length;
  const recentRows = useMemo(() => report?.recent ?? [], [report]);
  const categoryRows = useMemo(
    () =>
      (report?.topErrorCategories || []).map((row) => ({
        label: row.category,
        value: row.incorrect + row.partial,
        meta: `${row.errorRatePercent}%`,
      })),
    [report],
  );

  function exportCsv() {
    setExporting(true);
    void downloadApiFile(`/analytics/ai-feedback.csv?days=${days}`)
      .then(() => toast.success('Отчёт выгружен'))
      .catch((e) => toast.error(e instanceof Error ? e.message : 'Не удалось выгрузить отчёт'))
      .finally(() => setExporting(false));
  }

  const accuracyLabel = report?.totalFeedback
    ? `${report.byVerdict.CORRECT} из ${report.totalFeedback}`
    : 'Пока нет отметок';

  return (
    <div className="ai-quality-page">
      <p className="ai-quality-lead">
        Сверьте предварительный разбор ИИ с тем, что подтвердили в сервисе. Цифры считаются по отметкам мастеров, не
        по пустому периоду.
      </p>

      <div className="ai-quality-toolbar">
        <div className="ai-quality-periods" role="tablist" aria-label="Период оценок">
          {PERIODS.map((item) => (
            <button
              key={item.id}
              type="button"
              role="tab"
              aria-selected={period === item.id}
              className="ai-quality-period"
              onClick={() => setPeriod(item.id)}
            >
              {item.label}
              {period === item.id && report ? <span>{report.totalFeedback}</span> : null}
            </button>
          ))}
        </div>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          disabled={exporting || !report}
          title="Таблица оценок за выбранный период"
          onClick={exportCsv}
        >
          <Download />
          {exporting ? 'Готовим' : 'Скачать таблицу'}
        </Button>
      </div>

      {error ? (
        <Alert variant="destructive">
          <AlertTitle>Не удалось загрузить качество ИИ</AlertTitle>
          <AlertDescription className="flex flex-col gap-2">
            <span>Проверьте соединение и повторите попытку.</span>
            <Button type="button" variant="outline" size="sm" className="w-fit" onClick={() => setReloadToken((n) => n + 1)}>
              Повторить
            </Button>
          </AlertDescription>
        </Alert>
      ) : null}

      {loading && !report ? (
        <div className="ai-quality-skel" aria-hidden>
          <div className="ai-quality-skel-score" />
          <div className="ai-quality-skel-desk">
            <div />
            <div />
          </div>
        </div>
      ) : null}

      {report ? (
        <>
          <section className={`ai-quality-score ${loading ? 'is-dim' : ''}`} aria-label="Сводка за период">
            <article className="ai-quality-hero">
              <span className="ai-quality-kicker">Совпало с сервисом</span>
              <strong className="ai-quality-hero-value">
                {report.totalFeedback ? `${report.accuracyPercent}%` : '—'}
              </strong>
              <div className="ai-quality-hero-track" aria-hidden>
                <div
                  className="ai-quality-hero-fill"
                  style={{ width: report.totalFeedback ? `${Math.min(100, report.accuracyPercent)}%` : '0%' }}
                />
              </div>
              <p className="ai-quality-hero-hint">
                {report.totalFeedback
                  ? `${accuracyLabel} отметок верный.`
                  : 'Точность считается по отметкам мастеров, не по пустому периоду.'}
              </p>
            </article>
            <article className="ai-quality-stat">
              <span>Полезен в сервисе</span>
              <strong>{report.totalFeedback ? `${report.usefulPercent}%` : '—'}</strong>
              <p>Верный плюс частично: направление было полезным.</p>
            </article>
            <Link
              to={`${paths.requests}?feedback=none`}
              className={`ai-quality-stat is-pending ${pendingCount ? 'is-hot' : ''}`}
            >
              <span>Ждут оценки</span>
              <strong>{pendingCount}</strong>
              <p>{pendingCount ? 'Старше суток, без отметки.' : 'Очередь закрыта.'}</p>
            </Link>
          </section>

          <div className="ai-quality-desk">
            <section className="ai-quality-board" aria-labelledby="ai-quality-board-title">
              <header className="ai-quality-board-head">
                <h2 id="ai-quality-board-title">Оценить</h2>
                {pendingCount ? <span>{pendingCount}</span> : null}
              </header>
              {pendingItems.length ? (
                <InlineFeedbackQueue
                  items={pendingItems.slice(0, 8)}
                  requestBasePath={paths.requests}
                  onSaved={() => {
                    void listServiceRequests({ pageSize: 100, sort: 'createdAt', dir: 'desc' }).then((requests) => {
                      setPendingItems(requests.items.filter((item) => requestNeedsFeedback(item, 24)));
                    });
                  }}
                />
              ) : (
                <div className="ai-quality-empty" role="status">
                  <strong>Очередь пуста</strong>
                  <p>Когда заявка старше суток останется без оценки, она появится здесь вместе с причинами ИИ.</p>
                </div>
              )}
            </section>

            <aside className="ai-quality-rail">
              <section className="ai-quality-panel" aria-label="Разбивка оценок">
                <header>
                  <h2>Разбивка</h2>
                </header>
                <VerdictSplit
                  correct={report.byVerdict.CORRECT}
                  partial={report.byVerdict.PARTIAL}
                  incorrect={report.byVerdict.INCORRECT}
                />
                <ul className="ai-quality-legend">
                  <li>
                    <i className="is-correct" />
                    Верных
                    <b>{report.byVerdict.CORRECT}</b>
                  </li>
                  <li>
                    <i className="is-partial" />
                    Частично
                    <b>{report.byVerdict.PARTIAL}</b>
                  </li>
                  <li>
                    <i className="is-incorrect" />
                    Неверных
                    <b>{report.byVerdict.INCORRECT}</b>
                  </li>
                </ul>
              </section>

              <section className="ai-quality-panel" aria-label="Последние оценки">
                <header>
                  <h2>Последние</h2>
                </header>
                {recentRows.length ? (
                  <ul className="ai-quality-log">
                    {recentRows.map((row) => (
                      <li key={row.id} className={`is-${row.verdict.toLowerCase()}`}>
                        <span className="ai-quality-log-verdict">{VERDICT_LABELS[row.verdict] || row.verdict}</span>
                        <span className="ai-quality-log-copy">
                          {row.vehicle || row.category}
                          {row.actualCause ? ` (${row.actualCause})` : ''}
                        </span>
                        <time dateTime={row.createdAt}>{formatWhen(row.createdAt)}</time>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="ai-quality-empty-inline">Отметки появятся после оценки в очереди слева.</p>
                )}
              </section>
            </aside>
          </div>

          {report.topMisdiagnoses.length || categoryRows.length ? (
            <section className="ai-quality-gaps" aria-label="Где чаще расходится">
              {report.topMisdiagnoses.length ? (
                <div className="ai-quality-panel">
                  <header>
                    <h2>Частые причины в сервисе</h2>
                  </header>
                  <CategoryBarChart
                    rows={report.topMisdiagnoses.map((row) => ({
                      label: row.actualCause,
                      value: row.count,
                    }))}
                  />
                </div>
              ) : null}
              {categoryRows.length ? (
                <div className="ai-quality-panel">
                  <header>
                    <h2>Категории с ошибками</h2>
                  </header>
                  <CategoryBarChart rows={categoryRows} />
                </div>
              ) : null}
            </section>
          ) : null}
        </>
      ) : null}
    </div>
  );
}
