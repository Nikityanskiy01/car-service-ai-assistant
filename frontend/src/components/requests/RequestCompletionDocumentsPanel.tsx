import { useCallback, useEffect, useRef, useState } from 'react';
import { LoaderCircle, Paperclip, Trash2 } from 'lucide-react';
import { openApiFileInNewTab } from '../../api/client';
import {
  deleteCompletionDocument,
  listCompletionDocuments,
  uploadCompletionDocument,
  type CompletionDocument,
  type CompletionDocumentKind,
} from '../../api/dashboard';
import { Button } from '../ui/Button';

const KIND_OPTIONS: Array<{ id: CompletionDocumentKind; label: string }> = [
  { id: 'WORK_ORDER', label: 'Заказ-наряд' },
  { id: 'RECEIPT', label: 'Чек / квитанция' },
  { id: 'WARRANTY', label: 'Гарантийный талон' },
  { id: 'ACT', label: 'Акт выполненных работ' },
  { id: 'OTHER', label: 'Другой документ' },
];

const ALLOWED = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'application/pdf']);
const MAX_BYTES = 8 * 1024 * 1024;

type Props = {
  requestId: string;
  requestStatus?: string;
};

function formatSize(bytes: number) {
  if (bytes < 1024) return `${bytes} Б`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} КБ`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} МБ`;
}

function readFileAsBase64(file: File): Promise<{ fileName: string; mimeType: string; contentBase64: string }> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = String(reader.result || '');
      const base64 = result.includes(',') ? result.split(',')[1] : result;
      resolve({ fileName: file.name, mimeType: file.type, contentBase64: base64 });
    };
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}

export function RequestCompletionDocumentsPanel({ requestId, requestStatus }: Props) {
  const [documents, setDocuments] = useState<CompletionDocument[]>([]);
  const [loading, setLoading] = useState(true);
  const [customLabel, setCustomLabel] = useState('');
  const [uploadingKind, setUploadingKind] = useState<CompletionDocumentKind | null>(null);
  const [error, setError] = useState<string | null>(null);
  const inputRefs = useRef<Partial<Record<CompletionDocumentKind, HTMLInputElement | null>>>({});

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const items = await listCompletionDocuments(requestId);
      setDocuments(items);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Не удалось загрузить документы');
    } finally {
      setLoading(false);
    }
  }, [requestId]);

  useEffect(() => {
    void load();
  }, [load]);

  async function handlePick(kind: CompletionDocumentKind, fileList: FileList | null) {
    const input = inputRefs.current[kind];
    if (input) input.value = '';
    if (!fileList?.length) return;
    const file = fileList[0];
    if (!ALLOWED.has(file.type)) {
      setError('Допустимы JPG, PNG, WEBP, GIF и PDF');
      return;
    }
    if (file.size > MAX_BYTES) {
      setError('Файл не больше 8 МБ');
      return;
    }
    if (kind === 'OTHER' && !customLabel.trim()) {
      setError('Укажите название документа');
      return;
    }

    setUploadingKind(kind);
    setError(null);
    try {
      const fileData = await readFileAsBase64(file);
      const doc = await uploadCompletionDocument(requestId, {
        kind,
        label: kind === 'OTHER' ? customLabel.trim() : null,
        ...fileData,
      });
      setDocuments((prev) => [doc, ...prev]);
      if (kind === 'OTHER') setCustomLabel('');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Не удалось загрузить документ');
    } finally {
      setUploadingKind(null);
    }
  }

  async function handleDelete(documentId: string) {
    setError(null);
    try {
      await deleteCompletionDocument(requestId, documentId);
      setDocuments((prev) => prev.filter((d) => d.id !== documentId));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Не удалось удалить документ');
    }
  }

  return (
    <section className="completion-documents-panel stack">
      <header>
        <h3>Документы для клиента</h3>
        <p className="muted">
          Заказ-наряд, чек и другие бумаги после выдачи авто. Клиент видит их в кабинете в обращении.
          {requestStatus !== 'COMPLETED' ? ' После загрузки закройте заявку статусом «Завершена».' : null}
        </p>
      </header>

      {loading ? (
        <p className="muted completion-documents-loading">
          <LoaderCircle size={16} className="spin" aria-hidden />
          Загрузка списка…
        </p>
      ) : (
        <ul className="completion-doc-slots">
          {KIND_OPTIONS.map((option) => {
            const files = documents.filter((doc) => doc.kind === option.id);
            const busy = uploadingKind === option.id;
            return (
              <li key={option.id} className="completion-doc-slot">
                <div className="completion-doc-slot-head">
                  <strong>{option.label}</strong>
                  <Button
                    type="button"
                    variant="secondary"
                    disabled={busy}
                    onClick={() => inputRefs.current[option.id]?.click()}
                  >
                    <Paperclip size={16} aria-hidden />
                    {busy ? 'Загрузка…' : files.length ? 'Ещё файл' : 'Выбрать файл'}
                  </Button>
                  <input
                    ref={(node) => {
                      inputRefs.current[option.id] = node;
                    }}
                    type="file"
                    accept="image/jpeg,image/png,image/webp,image/gif,application/pdf"
                    className="completion-documents-file-input"
                    onChange={(e) => void handlePick(option.id, e.target.files)}
                  />
                </div>

                {option.id === 'OTHER' ? (
                  <label className="completion-doc-slot-label">
                    <span>Название</span>
                    <input
                      className="input"
                      type="text"
                      value={customLabel}
                      onChange={(e) => setCustomLabel(e.target.value)}
                      placeholder="Например: протокол диагностики"
                      maxLength={120}
                    />
                  </label>
                ) : null}

                {files.length ? (
                  <ul className="completion-doc-slot-files">
                    {files.map((doc) => (
                      <li key={doc.id} className="completion-doc-slot-file">
                        <span className="completion-doc-slot-name">
                          {doc.label && doc.kind === 'OTHER' ? `${doc.label} · ` : ''}
                          {doc.fileName}
                          <small> · {formatSize(doc.sizeBytes)}</small>
                        </span>
                        <button
                          type="button"
                          className="completion-document-link"
                          onClick={() => void openApiFileInNewTab(doc.url)}
                        >
                          Открыть
                        </button>
                        <Button
                          type="button"
                          variant="ghost"
                          className="completion-document-delete"
                          aria-label={`Удалить ${doc.kindLabel}`}
                          onClick={() => void handleDelete(doc.id)}
                        >
                          <Trash2 size={16} aria-hidden />
                        </Button>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="completion-doc-slot-empty">Файл не прикреплён</p>
                )}
              </li>
            );
          })}
        </ul>
      )}

      {error ? <p className="form-error">{error}</p> : null}
    </section>
  );
}
