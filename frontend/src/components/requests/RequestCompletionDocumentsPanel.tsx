import { useCallback, useEffect, useRef, useState } from 'react';
import { FileText, LoaderCircle, Paperclip, Trash2, Upload } from 'lucide-react';
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
  const [kind, setKind] = useState<CompletionDocumentKind>('WORK_ORDER');
  const [customLabel, setCustomLabel] = useState('');
  const [pendingFile, setPendingFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

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

  async function onPick(fileList: FileList | null) {
    if (!fileList?.length) return;
    const file = fileList[0];
    setError(null);
    if (!ALLOWED.has(file.type)) {
      setError('Допустимы JPG, PNG, WEBP, GIF и PDF');
      return;
    }
    if (file.size > MAX_BYTES) {
      setError('Файл не больше 8 МБ');
      return;
    }
    setPendingFile(file);
    if (inputRef.current) inputRef.current.value = '';
  }

  async function handleUpload() {
    if (!pendingFile) {
      setError('Выберите файл');
      return;
    }
    if (kind === 'OTHER' && !customLabel.trim()) {
      setError('Укажите название документа');
      return;
    }
    setUploading(true);
    setError(null);
    try {
      const fileData = await readFileAsBase64(pendingFile);
      const doc = await uploadCompletionDocument(requestId, {
        kind,
        label: kind === 'OTHER' ? customLabel.trim() : null,
        ...fileData,
      });
      setDocuments((prev) => [doc, ...prev]);
      setPendingFile(null);
      setCustomLabel('');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Не удалось загрузить документ');
    } finally {
      setUploading(false);
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
      ) : documents.length ? (
        <ul className="completion-documents-list" aria-label="Загруженные документы">
          {documents.map((doc) => (
            <li key={doc.id} className="completion-document-row">
              <FileText size={18} aria-hidden className="completion-document-icon" />
              <div className="completion-document-copy">
                <strong>{doc.kindLabel}</strong>
                <span className="muted">
                  {doc.fileName} · {formatSize(doc.sizeBytes)}
                </span>
              </div>
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
        <p className="muted">Документы ещё не загружены.</p>
      )}

      <div className="completion-documents-upload stack">
        <div className="completion-documents-upload-row">
          <label className="stack gap-xs">
            <span>Тип документа</span>
            <select value={kind} onChange={(e) => setKind(e.target.value as CompletionDocumentKind)}>
              {KIND_OPTIONS.map((opt) => (
                <option key={opt.id} value={opt.id}>{opt.label}</option>
              ))}
            </select>
          </label>
          {kind === 'OTHER' ? (
            <label className="stack gap-xs">
              <span>Название</span>
              <input
                type="text"
                value={customLabel}
                onChange={(e) => setCustomLabel(e.target.value)}
                placeholder="Например: протокол диагностики"
                maxLength={120}
              />
            </label>
          ) : null}
        </div>

        <div className="completion-documents-file-row">
          <input
            ref={inputRef}
            type="file"
            accept="image/jpeg,image/png,image/webp,image/gif,application/pdf"
            className="completion-documents-file-input"
            onChange={(e) => void onPick(e.target.files)}
          />
          <Button type="button" variant="secondary" onClick={() => inputRef.current?.click()}>
            <Paperclip size={16} aria-hidden />
            {pendingFile ? pendingFile.name : 'Выбрать файл'}
          </Button>
          <Button type="button" disabled={uploading || !pendingFile} onClick={() => void handleUpload()}>
            <Upload size={16} aria-hidden />
            {uploading ? 'Загрузка…' : 'Загрузить'}
          </Button>
        </div>
      </div>

      {error ? <p className="form-error">{error}</p> : null}
    </section>
  );
}
