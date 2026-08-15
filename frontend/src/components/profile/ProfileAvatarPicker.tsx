import { useRef, useState } from 'react';
import { Camera, Loader2, Trash2 } from 'lucide-react';
import { removeAvatar, uploadAvatar } from '../../api/dashboard';
import { UserAvatar } from '../ui/UserAvatar';

type Props = {
  name: string;
  avatarUrl?: string | null;
  onUpdated: () => Promise<void>;
  size?: number;
};

export function ProfileAvatarPicker({ name, avatarUrl, onUpdated, size = 112 }: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [removing, setRemoving] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const busy = uploading || removing;

  async function handleFile(file: File) {
    if (!file.type.startsWith('image/')) {
      setError('Подходят фото JPEG, PNG или WebP');
      return;
    }
    if (file.size > 2 * 1024 * 1024) {
      setError('Размер файла — не больше 2 МБ');
      return;
    }

    setUploading(true);
    setError(null);
    try {
      const base64 = await readFileAsBase64(file);
      await uploadAvatar({ mimeType: file.type, contentBase64: base64 });
      await onUpdated();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Не удалось загрузить фото');
    } finally {
      setUploading(false);
    }
  }

  async function handleRemove(e: React.MouseEvent) {
    e.stopPropagation();
    setRemoving(true);
    setError(null);
    try {
      await removeAvatar();
      await onUpdated();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Не удалось удалить фото');
    } finally {
      setRemoving(false);
    }
  }

  function onDrop(e: React.DragEvent) {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files?.[0];
    if (file) void handleFile(file);
  }

  return (
    <div className="profile-avatar-picker">
      <button
        type="button"
        className={`profile-avatar-trigger${dragOver ? ' is-dragover' : ''}${busy ? ' is-busy' : ''}`}
        aria-label="Изменить фото профиля"
        disabled={busy}
        onClick={() => inputRef.current?.click()}
        onDragOver={(e) => {
          e.preventDefault();
          setDragOver(true);
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={onDrop}
      >
        <UserAvatar name={name} avatarUrl={avatarUrl} size={size} className="profile-avatar-lg" />
        <span className="profile-avatar-overlay" aria-hidden>
          {busy ? <Loader2 size={22} className="profile-avatar-spinner" /> : <Camera size={22} />}
          <span>{busy ? 'Загрузка…' : avatarUrl ? 'Сменить фото' : 'Добавить фото'}</span>
        </span>
        {avatarUrl && !busy ? (
          <span
            role="button"
            tabIndex={0}
            className="profile-avatar-remove"
            aria-label="Удалить фото"
            onClick={handleRemove}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                void handleRemove(e as unknown as React.MouseEvent);
              }
            }}
          >
            <Trash2 size={14} aria-hidden />
          </span>
        ) : null}
      </button>

      <input
        ref={inputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        hidden
        onChange={(e) => {
          const file = e.target.files?.[0];
          e.target.value = '';
          if (file) void handleFile(file);
        }}
      />

      {error ? <p className="form-error profile-avatar-error">{error}</p> : null}
    </div>
  );
}

function readFileAsBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = String(reader.result || '');
      const base64 = result.includes(',') ? result.split(',')[1] : result;
      resolve(base64);
    };
    reader.onerror = () => reject(new Error('Не удалось прочитать файл'));
    reader.readAsDataURL(file);
  });
}
