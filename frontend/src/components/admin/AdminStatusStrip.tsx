import { Link } from 'react-router-dom';
import { BrainCircuit, ClipboardList, Link2, Plug } from 'lucide-react';
import type { LlmStatus } from '../../api/dashboard';

type StripProps = {
  llm: LlmStatus | null;
  integrationIssues: number;
  failedJobs: number;
  newRequests: number;
  loading?: boolean;
};

function llmTone(state?: LlmStatus['state']): 'ok' | 'warn' | 'bad' {
  if (state === 'ok') return 'ok';
  if (state === 'degraded') return 'warn';
  return 'bad';
}

function llmLabel(state?: LlmStatus['state']): string {
  if (state === 'ok') return 'ИИ: работает';
  if (state === 'degraded') return 'ИИ: резерв';
  if (state === 'disabled') return 'ИИ: выкл';
  return 'ИИ: недоступен';
}

function crmTone(issues: number): 'ok' | 'warn' | 'bad' {
  if (!issues) return 'ok';
  return 'bad';
}

export function AdminStatusStrip({ llm, integrationIssues, failedJobs, newRequests, loading }: StripProps) {
  if (loading) {
    return (
      <div className="admin-status-strip admin-status-strip-loading" aria-busy="true">
        <span className="admin-status-pill is-muted">Загрузка статусов…</span>
      </div>
    );
  }

  const llmState = llmTone(llm?.state);

  return (
    <nav className="admin-status-strip" aria-label="Системные статусы">
      <Link
        to="/dashboard/admin/ai/status"
        className={`admin-status-pill is-${llmState}`}
        title={llm?.message || 'Статус интеллектуального модуля'}
        aria-label={llmLabel(llm?.state)}
      >
        <BrainCircuit size={14} aria-hidden />
        <span className="admin-status-pill-label">{llmLabel(llm?.state)}</span>
      </Link>
      <Link
        to="/dashboard/admin/integrations"
        className={`admin-status-pill is-${crmTone(integrationIssues)}`}
        title="Подключения CRM и учётных систем"
        aria-label={integrationIssues ? `CRM: ${integrationIssues} ошибок` : 'CRM в норме'}
      >
        <Plug size={14} aria-hidden />
        <span className="admin-status-pill-label">{integrationIssues ? `CRM: ${integrationIssues}` : 'CRM: норма'}</span>
      </Link>
      <Link
        to="/dashboard/admin/integrations/jobs"
        className={`admin-status-pill is-${failedJobs ? 'warn' : 'ok'}`}
        title="Очередь синхронизации"
        aria-label={failedJobs ? `Очередь: ${failedJobs}` : 'Очередь в норме'}
      >
        <Link2 size={14} aria-hidden />
        <span className="admin-status-pill-label">{failedJobs ? `Очередь: ${failedJobs}` : 'Очередь: ок'}</span>
      </Link>
      <Link
        to="/dashboard/admin/operations/requests?status=NEW"
        className={`admin-status-pill is-${newRequests ? 'accent' : 'ok'}`}
        title="Новые заявки"
        aria-label={newRequests ? `Новых заявок: ${newRequests}` : 'Новых заявок нет'}
      >
        <ClipboardList size={14} aria-hidden />
        <span className="admin-status-pill-label">{newRequests ? `Заявки: ${newRequests}` : 'Заявки: нет'}</span>
      </Link>
    </nav>
  );
}
