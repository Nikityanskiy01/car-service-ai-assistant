import { Camera } from 'lucide-react';
import { useRef, useState } from 'react';
import { api } from '../../api/client';
import { Button } from '../ui/Button';

const MAX_BYTES = 4 * 1024 * 1024;

export function PhotoAttachment({
  sessionId,
  guestToken,
  disabled,
  onAnalyzed,
  onError,
}: {
  sessionId: string;
  guestToken?: string | null;
  disabled?: boolean;
  onAnalyzed: () => void;
  onError: (message: string) => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [loading, setLoading] = useState(false);

  async function onFile(file: File | null) {
    if (!file || disabled || loading) return;
    if (!file.type.startsWith('image/')) {
      onError('Можно прикрепить только изображение (JPEG, PNG, WebP).');
      return;
    }
    if (file.size > MAX_BYTES) {
      onError('Фото слишком большое (максимум 4 МБ).');
      return;
    }

    setLoading(true);
    try {
      const base64 = await readFileAsBase64(file);
      await api<{ session?: unknown }>(`/consultations/${sessionId}/analyze-photo`, {
        method: 'POST',
        guestToken,
        body: {
          mimeType: file.type,
          imageBase64: base64,
        },
      });
      onAnalyzed();
    } catch (e) {
      onError(e instanceof Error ? e.message : 'Не удалось проанализировать фото.');
    } finally {
      setLoading(false);
      if (inputRef.current) inputRef.current.value = '';
    }
  }

  return (
    <div className="photo-attachment">
      <input
        ref={inputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        className="sr-only"
        onChange={(e) => void onFile(e.target.files?.[0] || null)}
      />
      <Button
        type="button"
        variant="ghost"
        disabled={disabled || loading}
        onClick={() => inputRef.current?.click()}
      >
        <Camera size={16} aria-hidden="true" />
        {loading ? 'Анализ фото...' : 'Прикрепить фото'}
      </Button>
      <p className="photo-attachment-hint">Колодки, лампа Check Engine, утечка — фото только дополняет диагноз.</p>
    </div>
  );
}

function readFileAsBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = String(reader.result || '');
      const idx = result.indexOf('base64,');
      resolve(idx >= 0 ? result.slice(idx + 7) : result);
    };
    reader.onerror = () => reject(new Error('read failed'));
    reader.readAsDataURL(file);
  });
}
