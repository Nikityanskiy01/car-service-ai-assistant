import { Camera, Loader2, Trash2 } from 'lucide-react';
import { useRef, useState } from 'react';
import { removeVehiclePhoto, uploadVehiclePhoto, type ClientVehicle } from '../../api/vehicles';
import { VehiclePhotoMedia } from './VehiclePhotoMedia';

type Props = {
  vehicle: ClientVehicle;
  onUpdated: (vehicle: ClientVehicle) => void | Promise<void>;
  size?: 'md' | 'lg' | 'banner';
  variant?: 'default' | 'banner';
};

export function VehiclePhotoPicker({
  vehicle,
  onUpdated,
  size,
  variant = 'default',
}: Props) {
  const mediaSize = size ?? (variant === 'banner' ? 'banner' : 'lg');
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [removing, setRemoving] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const busy = uploading || removing;

  async function handleFile(file: File) {
    if (!file.type.startsWith('image/')) {
      setError('Выберите JPEG, PNG или WebP');
      return;
    }
    if (file.size > 4 * 1024 * 1024) {
      setError('Максимум 4 МБ');
      return;
    }

    setUploading(true);
    setError(null);
    try {
      const base64 = await readFileAsBase64(file);
      const updated = await uploadVehiclePhoto(vehicle.id, {
        mimeType: file.type,
        contentBase64: base64,
      });
      await onUpdated(updated);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Не удалось загрузить');
    } finally {
      setUploading(false);
    }
  }

  async function handleRemove(e: React.MouseEvent) {
    e.stopPropagation();
    setRemoving(true);
    setError(null);
    try {
      const updated = await removeVehiclePhoto(vehicle.id);
      await onUpdated(updated);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Не удалось удалить');
    } finally {
      setRemoving(false);
    }
  }

  return (
    <div className={`vehicle-photo-picker${variant === 'banner' ? ' is-banner' : ''}`}>
      <button
        type="button"
        className={`vehicle-photo-picker-trigger${dragOver ? ' is-dragover' : ''}${busy ? ' is-busy' : ''}`}
        aria-label="Изменить фото автомобиля"
        disabled={busy}
        onClick={() => inputRef.current?.click()}
        onDragOver={(e) => {
          e.preventDefault();
          setDragOver(true);
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragOver(false);
          const file = e.dataTransfer.files?.[0];
          if (file) void handleFile(file);
        }}
      >
        <VehiclePhotoMedia vehicle={vehicle} size={mediaSize} showLabel />
        <span className="vehicle-photo-picker-overlay" aria-hidden>
          {busy ? <Loader2 size={22} className="vehicle-photo-picker-spinner" /> : <Camera size={22} />}
          <span>{busy ? 'Загрузка…' : vehicle.photoUrl ? 'Сменить фото' : 'Добавить фото'}</span>
        </span>
        {vehicle.photoUrl && !busy ? (
          <span
            role="button"
            tabIndex={0}
            className="vehicle-photo-picker-remove"
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

      {error ? <p className="form-error vehicle-photo-picker-error">{error}</p> : null}
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
