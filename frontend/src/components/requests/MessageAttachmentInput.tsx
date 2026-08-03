import { useRef, useState } from 'react';
import { Paperclip, X } from 'lucide-react';
import { Button } from '../ui/Button';

export type PendingAttachment = {
  fileName: string;
  mimeType: string;
  contentBase64: string;
  previewUrl?: string;
};

const ALLOWED = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'application/pdf']);
const MAX_BYTES = 4 * 1024 * 1024;

type Props = {
  files: PendingAttachment[];
  onChange: (files: PendingAttachment[]) => void;
  disabled?: boolean;
  variant?: 'default' | 'icon' | 'preview';
};

function readFileAsBase64(file: File): Promise<PendingAttachment> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = String(reader.result || '');
      const base64 = result.includes(',') ? result.split(',')[1] : result;
      resolve({
        fileName: file.name,
        mimeType: file.type,
        contentBase64: base64,
        previewUrl: file.type.startsWith('image/') ? result : undefined,
      });
    };
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}

export function MessageAttachmentInput({ files, onChange, disabled, variant = 'default' }: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [error, setError] = useState<string | null>(null);

  async function onPick(fileList: FileList | null) {
    if (!fileList?.length) return;
    setError(null);
    const next = [...files];
    for (const file of Array.from(fileList)) {
      if (!ALLOWED.has(file.type)) {
        setError('Допустимы JPG, PNG, WEBP, GIF и PDF');
        continue;
      }
      if (file.size > MAX_BYTES) {
        setError('Файл не больше 4 МБ');
        continue;
      }
      if (next.length >= 5) {
        setError('Не больше 5 файлов');
        break;
      }
      next.push(await readFileAsBase64(file));
    }
    onChange(next);
    if (inputRef.current) inputRef.current.value = '';
  }

  if (variant === 'preview') {
    if (!files.length) return null;
    return (
      <ul className="follow-up-attachment-preview" aria-label="Прикреплённые файлы">
        {files.map((file, index) => (
          <li key={`${file.fileName}-${index}`}>
            {file.previewUrl ? <img src={file.previewUrl} alt="" /> : <span>{file.fileName}</span>}
            <button
              type="button"
              className="follow-up-attachment-remove"
              aria-label={`Убрать ${file.fileName}`}
              disabled={disabled}
              onClick={() => onChange(files.filter((_, i) => i !== index))}
            >
              <X size={14} aria-hidden />
            </button>
          </li>
        ))}
      </ul>
    );
  }

  return (
    <div className={variant === 'icon' ? 'message-attachment-input message-attachment-input-icon' : 'message-attachment-input'}>
      <input
        ref={inputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp,image/gif,application/pdf"
        multiple
        hidden
        onChange={(e) => void onPick(e.target.files)}
      />
      {variant === 'icon' ? (
        <button
          type="button"
          className="chat-composer-attach"
          disabled={disabled}
          aria-label="Прикрепить файл"
          onClick={() => inputRef.current?.click()}
        >
          <Paperclip size={18} aria-hidden />
        </button>
      ) : (
        <Button type="button" variant="ghost" disabled={disabled} onClick={() => inputRef.current?.click()}>
          Прикрепить файл
        </Button>
      )}
      {error ? <span className="danger">{error}</span> : null}
      {variant === 'default' && files.length ? (
        <ul className="message-attachment-pending">
          {files.map((file, index) => (
            <li key={`${file.fileName}-${index}`}>
              {file.previewUrl ? <img src={file.previewUrl} alt="" /> : <span>{file.fileName}</span>}
              <Button
                type="button"
                variant="ghost"
                disabled={disabled}
                onClick={() => onChange(files.filter((_, i) => i !== index))}
              >
                Убрать
              </Button>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
