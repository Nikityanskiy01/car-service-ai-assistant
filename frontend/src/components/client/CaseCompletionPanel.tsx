import { useState } from 'react';
import { FileDown, FileText } from 'lucide-react';
import { openApiFileInNewTab } from '../../api/client';
import type { CompletionDocument } from '../../api/dashboard';
import type { ConsultationFeedback } from '../../types/serviceRequest';

type Props = {
  feedback?: ConsultationFeedback | null;
  documents: CompletionDocument[];
};

function formatMoney(minor: number | null | undefined) {
  if (minor == null) return null;
  return `${Math.round(minor / 100).toLocaleString('ru-RU')} ₽`;
}

function formatDate(value: string | null | undefined) {
  if (!value) return null;
  return new Date(value).toLocaleDateString('ru-RU', { day: 'numeric', month: 'long', year: 'numeric' });
}

function formatSize(bytes: number) {
  if (bytes < 1024) return `${bytes} Б`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} КБ`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} МБ`;
}

export function CaseCompletionPanel({ feedback, documents }: Props) {
  const [docError, setDocError] = useState<string | null>(null);

  const hasOutcome =
    feedback?.worksDone ||
    feedback?.repairAmountMinor != null ||
    feedback?.workOrderNumber ||
    feedback?.repairCompletedAt;

  if (!hasOutcome && !documents.length) return null;

  return (
    <section className="case-completion-panel stack" aria-labelledby="case-completion-title">
      <header className="case-detail-section-head">
        <h2 id="case-completion-title">Итог в сервисе</h2>
        <p className="muted-text">Выполненные работы и документы с выдачи</p>
      </header>

      {hasOutcome ? (
        <div className="case-completion-summary">
          {feedback?.worksDone ? (
            <p>
              <strong>Работы:</strong> {feedback.worksDone}
            </p>
          ) : null}
          <dl className="case-completion-meta">
            {feedback?.repairCompletedAt ? (
              <div>
                <dt>Дата</dt>
                <dd>{formatDate(feedback.repairCompletedAt)}</dd>
              </div>
            ) : null}
            {feedback?.workOrderNumber ? (
              <div>
                <dt>Заказ-наряд</dt>
                <dd>{feedback.workOrderNumber}</dd>
              </div>
            ) : null}
            {feedback?.repairAmountMinor != null ? (
              <div>
                <dt>Сумма</dt>
                <dd>{formatMoney(feedback.repairAmountMinor)}</dd>
              </div>
            ) : null}
          </dl>
        </div>
      ) : null}

      {documents.length ? (
        <div className="case-completion-docs">
          <h3>Документы</h3>
          <ul className="completion-documents-list completion-documents-list--client">
            {documents.map((doc) => (
              <li key={doc.id}>
                <button
                  type="button"
                  className="completion-document-card"
                  onClick={() => {
                    setDocError(null);
                    void openApiFileInNewTab(doc.url).catch((e) =>
                      setDocError(e instanceof Error ? e.message : 'Не удалось открыть документ'),
                    );
                  }}
                >
                  <span className="completion-document-card-icon" aria-hidden>
                    {doc.mimeType === 'application/pdf' ? <FileText size={20} /> : <FileDown size={20} />}
                  </span>
                  <span className="completion-document-card-copy">
                    <strong>{doc.kindLabel}</strong>
                    <span>{doc.fileName} · {formatSize(doc.sizeBytes)}</span>
                  </span>
                </button>
              </li>
            ))}
          </ul>
          {docError ? <p className="form-error">{docError}</p> : null}
        </div>
      ) : hasOutcome ? (
        <p className="muted-text">Документы появятся здесь, когда менеджер загрузит заказ-наряд и чек.</p>
      ) : null}
    </section>
  );
}
