import {
  AlertCircle,
  ArrowLeftRight,
  BadgeCheck,
  CirclePlus,
  Database,
  MessageSquare,
  Plug,
  RefreshCw,
  Send,
} from 'lucide-react';
import { Button } from '../../components/console/ui/button';
import { formatRelativeTime, formatShortDateTime } from '../../lib/clientMeta';
import {
  INTEGRATION_JOB_STATUS_LABELS,
  INTEGRATION_PROVIDER_LABELS,
} from '../../lib/labels';
import {
  buildRequestHistoryEvents,
  formatRuEventCount,
  type RequestHistoryKind,
} from '../../lib/managerRequestHelpers';
import type { IntegrationJob } from '../../types/integration';
import type { LoadedManagerRequest } from './useManagerRequestDetail';

const RETRYABLE = new Set(['FAILED', 'RETRYING', 'DEAD_LETTER']);

const KIND_ICON: Record<RequestHistoryKind, typeof CirclePlus> = {
  created: CirclePlus,
  status: ArrowLeftRight,
  message: MessageSquare,
  feedback: BadgeCheck,
  crm: Database,
};

export function ManagerRequestHistoryTab({ d }: { d: LoadedManagerRequest }) {
  const { request, session } = d;
  const events = buildRequestHistoryEvents({
    createdAt: request.createdAt,
    statusHistory: d.statusHistory,
    messages: d.messages,
    feedbackUpdatedAt: session?.feedback?.updatedAt,
    succeededJobs: d.integrations?.jobs?.filter((job) => job.status === 'SUCCEEDED'),
  });
  const jobs = [...(d.integrations?.jobs ?? [])].sort(
    (a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime(),
  );
  const links = d.integrations?.links ?? [];
  const latestFail = jobs.find((job) => RETRYABLE.has(job.status));

  return (
    <div className="request-history-desk">
      <section className="request-history-col" aria-labelledby="request-history-title">
        <header className="request-history-head">
          <h2 id="request-history-title">История</h2>
          <span className="request-history-count tnum">{formatRuEventCount(events.length)}</span>
        </header>
        <ol className="request-timeline">
          {events.map((event) => {
            const Icon = KIND_ICON[event.kind];
            return (
              <li key={event.id} className={`request-timeline-item is-${event.kind}`}>
                <span className="request-timeline-mark" aria-hidden>
                  <Icon size={14} strokeWidth={1.75} />
                </span>
                <div className="request-timeline-body">
                  <p>{event.title}</p>
                  {event.detail ? <small>{event.detail}</small> : null}
                </div>
                <time
                  className="tnum"
                  dateTime={event.at}
                  title={new Date(event.at).toLocaleString('ru-RU')}
                >
                  {formatRelativeTime(event.at)}
                  <span>{formatShortDateTime(event.at)}</span>
                </time>
              </li>
            );
          })}
        </ol>
      </section>

      <section className="request-history-col" aria-labelledby="request-crm-title">
        <header className="request-history-head">
          <h2 id="request-crm-title">Учётная система</h2>
        </header>
        <CrmStatus d={d} links={links} latestFail={latestFail} />
        {jobs.length > 1 ? (
          <div className="request-jobs">
            <h3>Последние попытки</h3>
            <ul>
              {jobs.map((job) => (
                <JobAttempt
                  key={job.id}
                  job={job}
                  connectionName={d.connections.find((row) => row.id === job.connectionId)?.name}
                  hideError={job.id === latestFail?.id}
                  onRetry={
                    RETRYABLE.has(job.status) && job.id !== latestFail?.id
                      ? () => void d.handleRetry(job.connectionId)
                      : undefined
                  }
                />
              ))}
            </ul>
          </div>
        ) : null}
      </section>
    </div>
  );
}

function CrmStatus({
  d,
  links,
  latestFail,
}: {
  d: LoadedManagerRequest;
  links: NonNullable<LoadedManagerRequest['integrations']>['links'];
  latestFail?: IntegrationJob;
}) {
  if (links.length) {
    return (
      <ul className="request-crm-links">
        {links.map((link) => (
          <li key={link.connectionId} className="request-crm-status is-ok">
            <span className="request-crm-status-mark" aria-hidden>
              <BadgeCheck size={18} strokeWidth={1.75} />
            </span>
            <div>
              <strong>Синхронизировано</strong>
              <p>
                {link.connectionName}, {INTEGRATION_PROVIDER_LABELS[link.provider]}
              </p>
              <small className="tnum">Внешний номер {link.externalEntityId}</small>
            </div>
            <div className="request-crm-status-actions">
              {link.externalUrl ? (
                <Button asChild variant="outline" size="sm">
                  <a href={link.externalUrl} target="_blank" rel="noreferrer">
                    Открыть
                  </a>
                </Button>
              ) : null}
              <small className="tnum">{formatShortDateTime(link.synchronizedAt)}</small>
            </div>
          </li>
        ))}
      </ul>
    );
  }

  if (!d.connections.length) {
    return (
      <div className="request-crm-status is-muted" role="status">
        <span className="request-crm-status-mark" aria-hidden>
          <Plug size={18} strokeWidth={1.75} />
        </span>
        <div>
          <strong>CRM не подключена</strong>
          <p>Администратор может подключить её в разделе интеграций.</p>
        </div>
      </div>
    );
  }

  if (latestFail) {
    return (
      <div className="request-crm-status is-error" role="alert">
        <span className="request-crm-status-mark" aria-hidden>
          <AlertCircle size={18} strokeWidth={1.75} />
        </span>
        <div>
          <strong>Не передана</strong>
          <p>{latestFail.lastErrorMessage || 'Последняя отправка в учётную систему не удалась.'}</p>
        </div>
        <Button
          type="button"
          size="sm"
          onClick={() => void d.handleRetry(latestFail.connectionId)}
        >
          <RefreshCw />
          Повторить
        </Button>
      </div>
    );
  }

  return (
    <div className="request-crm-status is-wait" role="status">
      <span className="request-crm-status-mark" aria-hidden>
        <Send size={18} strokeWidth={1.75} />
      </span>
      <div>
        <strong>Ещё не передана</strong>
        <p>Заявка есть только в этом кабинете. Внешняя система её ещё не получала.</p>
      </div>
      {d.exportableConnections.length ? (
        <Button
          type="button"
          size="sm"
          onClick={() => {
            d.setExportConnectionId(
              d.exportableConnections.length === 1 ? d.exportableConnections[0].id : '',
            );
            d.setExportOpen(true);
          }}
        >
          <Send />
          Передать
        </Button>
      ) : null}
    </div>
  );
}

function JobAttempt({
  job,
  connectionName,
  hideError,
  onRetry,
}: {
  job: IntegrationJob;
  connectionName?: string;
  hideError?: boolean;
  onRetry?: () => void;
}) {
  return (
    <li className={`request-job is-${job.status.toLowerCase()}`}>
      <div className="request-job-head">
        <span className={`integration-status-badge status-${job.status.toLowerCase()}`}>
          {INTEGRATION_JOB_STATUS_LABELS[job.status] || job.status}
        </span>
        {connectionName ? <span className="request-job-name">{connectionName}</span> : null}
        <time className="tnum" dateTime={job.updatedAt}>
          {formatShortDateTime(job.updatedAt)}
        </time>
      </div>
      {job.lastErrorMessage && !hideError ? <p className="request-job-error">{job.lastErrorMessage}</p> : null}
      {job.attemptCount > 1 ? (
        <small className="request-job-meta tnum">Попыток: {job.attemptCount}</small>
      ) : null}
      {onRetry ? (
        <Button type="button" variant="ghost" size="sm" onClick={onRetry}>
          <RefreshCw />
          Повторить
        </Button>
      ) : null}
    </li>
  );
}
