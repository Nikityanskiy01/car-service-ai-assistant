import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { toast } from 'sonner';
import { getAiFeedbackReport, listServiceRequests, type AiFeedbackReport } from '../../api/dashboard';
import { downloadApiFile } from '../../api/downloads';
import { AnalyticsBulletChart } from '../../components/analytics/AnalyticsBulletChart';
import { CategoryBarChart } from '../../components/analytics/CategoryBarChart';
import { InlineFeedbackQueue } from '../../components/manager/InlineFeedbackQueue';
import { Alert, AlertDescription, AlertTitle } from '../../components/console/ui/alert';
import { Badge } from '../../components/console/ui/badge';
import { Button } from '../../components/console/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/console/ui/card';
import { Skeleton } from '../../components/console/ui/skeleton';
import { Tabs, TabsList, TabsTrigger } from '../../components/console/ui/tabs';
import { managerZonePaths } from '../../config/managerPaths';
import { requestNeedsFeedback } from '../../lib/managerRequestHelpers';
import { usePageMeta } from '../../hooks/usePageMeta';

const paths = managerZonePaths(false);

const VERDICT_LABELS: Record<string, string> = {
  CORRECT: 'Верный',
  PARTIAL: 'Частично',
  INCORRECT: 'Неверный',
};

function verdictVariant(verdict: string): 'success' | 'warning' | 'destructive' | 'secondary' {
  if (verdict === 'CORRECT') return 'success';
  if (verdict === 'PARTIAL') return 'warning';
  if (verdict === 'INCORRECT') return 'destructive';
  return 'secondary';
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

  return (
    <div className="flex flex-col gap-4">
      <p className="text-sm text-muted-foreground">
        Насколько предварительные диагнозы совпадают с реальностью в сервисе.
      </p>

      <Tabs value={period} onValueChange={setPeriod} className="gap-0">
        <TabsList>
          <TabsTrigger value="today">Сегодня</TabsTrigger>
          <TabsTrigger value="7">7 дней</TabsTrigger>
          <TabsTrigger value="30">30 дней</TabsTrigger>
        </TabsList>
      </Tabs>

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
        <div className="flex flex-col gap-3">
          <div className="flex gap-3">
            <Skeleton className="h-20 flex-1" />
            <Skeleton className="h-20 flex-1" />
            <Skeleton className="h-20 flex-1" />
            <Skeleton className="h-20 flex-1" />
          </div>
          <Skeleton className="h-40 w-full" />
        </div>
      ) : null}

      {report ? (
        <>
          <div className={`flex flex-wrap gap-3 ${loading ? 'opacity-70' : ''}`}>
            <Metric label="Оценок за период" value={report.totalFeedback} />
            <div className="min-w-[12rem] flex-1 rounded-xl border border-border bg-card px-4 py-3">
              <AnalyticsBulletChart
                label="Точность (верный)"
                value={report.accuracyPercent}
                max={100}
                suffix="%"
                hint={`${report.byVerdict.CORRECT} из ${report.totalFeedback || 1} оценок`}
              />
            </div>
            <div className="min-w-[12rem] flex-1 rounded-xl border border-border bg-card px-4 py-3">
              <AnalyticsBulletChart label="Полезен (верный + частично)" value={report.usefulPercent} max={100} suffix="%" />
            </div>
            <Link to={`${paths.requests}?feedback=none`} className="min-w-[10rem] flex-1 text-inherit no-underline">
              <Metric label="Ждут оценки (>24ч)" value={pendingCount} />
            </Link>
          </div>

          <Card>
            <CardHeader>
              <CardTitle>Отчёт за период</CardTitle>
              <Button
                type="button"
                variant="secondary"
                size="sm"
                disabled={exporting}
                onClick={() => {
                  setExporting(true);
                  void downloadApiFile(`/analytics/ai-feedback.csv?days=${days}`)
                    .then(() => toast.success('Отчёт выгружен'))
                    .catch((e) => toast.error(e instanceof Error ? e.message : 'Не удалось выгрузить отчёт'))
                    .finally(() => setExporting(false));
                }}
              >
                {exporting ? 'Готовим…' : 'Скачать CSV'}
              </Button>
            </CardHeader>
            <CardContent>
              <div className="flex flex-wrap gap-3">
                <Metric label="Верных" value={report.byVerdict.CORRECT} />
                <Metric label="Частично" value={report.byVerdict.PARTIAL} />
                <Metric label="Неверных" value={report.byVerdict.INCORRECT} />
              </div>
            </CardContent>
          </Card>

          {report.topMisdiagnoses.length ? (
            <Card>
              <CardHeader>
                <CardTitle>Частые расхождения</CardTitle>
              </CardHeader>
              <CardContent>
                <CategoryBarChart
                  rows={report.topMisdiagnoses.map((row) => ({
                    label: row.actualCause,
                    value: row.count,
                  }))}
                />
              </CardContent>
            </Card>
          ) : null}

          {categoryRows.length ? (
            <Card>
              <CardHeader>
                <CardTitle>Ошибки по категориям</CardTitle>
              </CardHeader>
              <CardContent>
                <CategoryBarChart rows={categoryRows} />
              </CardContent>
            </Card>
          ) : null}

          {pendingItems.length ? (
            <Card>
              <CardHeader>
                <CardTitle>Быстрая оценка</CardTitle>
              </CardHeader>
              <CardContent className="flex flex-col gap-2">
                <p className="text-sm text-muted-foreground">Заявки старше 24 часов без оценки диагноза ИИ.</p>
                <InlineFeedbackQueue
                  items={pendingItems.slice(0, 8)}
                  requestBasePath={paths.requests}
                  onSaved={() => {
                    void listServiceRequests({ pageSize: 100, sort: 'createdAt', dir: 'desc' }).then((requests) => {
                      setPendingItems(requests.items.filter((item) => requestNeedsFeedback(item, 24)));
                    });
                  }}
                />
              </CardContent>
            </Card>
          ) : null}

          <Card>
            <CardHeader>
              <CardTitle>Последние оценки</CardTitle>
            </CardHeader>
            <CardContent>
              {recentRows.length ? (
                <ul className="flex list-none flex-col">
                  {recentRows.map((row) => (
                    <li key={row.id} className="flex flex-wrap items-center justify-between gap-2 border-b border-border py-2 last:border-b-0">
                      <span className="flex items-center gap-2">
                        <Badge variant={verdictVariant(row.verdict)}>{VERDICT_LABELS[row.verdict] || row.verdict}</Badge>
                        <span className="text-sm text-muted-foreground">
                          {row.vehicle || row.category}
                          {row.actualCause ? ` · ${row.actualCause}` : ''}
                        </span>
                      </span>
                      <span className="text-xs text-muted-foreground tabular-nums">
                        {new Date(row.createdAt).toLocaleString('ru-RU')}
                        {row.managerName ? ` · ${row.managerName}` : ''}
                      </span>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="py-6 text-center text-sm text-muted-foreground">
                  Отмечайте точность диагноза в карточке заявки на вкладке «Сводка».
                </p>
              )}
            </CardContent>
          </Card>

          {pendingCount > 0 ? (
            <Card>
              <CardContent className="flex flex-wrap items-center justify-between gap-3 py-1">
                <div>
                  <p className="text-sm font-medium">Нужна ваша оценка: {pendingCount}</p>
                  <p className="text-sm text-muted-foreground">
                    Откройте завершённые или активные заявки и отметьте, насколько диагноз ИИ совпал с реальностью.
                  </p>
                </div>
                <Button asChild variant="secondary" size="sm">
                  <Link to={`${paths.requests}?feedback=none`}>Перейти в очередь</Link>
                </Button>
              </CardContent>
            </Card>
          ) : null}
        </>
      ) : null}
    </div>
  );
}

function Metric({ label, value }: { label: string; value: number }) {
  return (
    <div className="min-w-[9rem] flex-1 rounded-xl border border-border bg-card px-4 py-3">
      <span className="text-xs text-muted-foreground">{label}</span>
      <strong className="mt-1 block text-2xl font-semibold tabular-nums">{value}</strong>
    </div>
  );
}
