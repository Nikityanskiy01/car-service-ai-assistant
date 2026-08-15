import { useEffect, useState } from 'react';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';
import { Modal } from '../ui/Modal';
import { Textarea } from '../ui/Textarea';

export type AdminTextField = {
  name: string;
  label: string;
  value: string;
  multiline?: boolean;
};

export function AdminTextDialog({
  open,
  title,
  fields,
  submitLabel = 'Сохранить',
  onClose,
  onSubmit,
}: {
  open: boolean;
  title: string;
  fields: AdminTextField[];
  submitLabel?: string;
  onClose: () => void;
  onSubmit: (values: Record<string, string>) => void | Promise<void>;
}) {
  const [values, setValues] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!open) return;
    setValues(Object.fromEntries(fields.map((field) => [field.name, field.value])));
    setBusy(false);
    // Only re-seed when the dialog opens.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    try {
      await onSubmit(values);
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal open={open} title={title} onClose={onClose}>
      <form className="stack compact" onSubmit={(e) => void handleSubmit(e)}>
        {fields.map((field) => (
          <label key={field.name} className="stack compact">
            <span>{field.label}</span>
            {field.multiline ? (
              <Textarea
                value={values[field.name] ?? ''}
                onChange={(e) => setValues((prev) => ({ ...prev, [field.name]: e.target.value }))}
                rows={6}
                required
              />
            ) : (
              <Input
                value={values[field.name] ?? ''}
                onChange={(e) => setValues((prev) => ({ ...prev, [field.name]: e.target.value }))}
                required
              />
            )}
          </label>
        ))}
        <div className="row gap-sm">
          <Button type="submit" disabled={busy}>
            {busy ? 'Сохранение…' : submitLabel}
          </Button>
          <Button type="button" variant="ghost" onClick={onClose} disabled={busy}>
            Отмена
          </Button>
        </div>
      </form>
    </Modal>
  );
}
