import { ShieldAlert } from 'lucide-react';
import { useEffect, useState } from 'react';
import { FormField } from '../forms/FormField';
import { OtpCodeInput } from '../forms/OtpCodeInput';
import { PasswordInput } from '../forms/PasswordInput';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';
import { Modal } from '../ui/Modal';

type Verification = {
  password: string;
  code?: string;
};

export function SensitiveActionDialog({
  open,
  title,
  description,
  confirmLabel,
  totpRequired,
  busy,
  error,
  onClose,
  onSubmit,
}: {
  open: boolean;
  title: string;
  description: string;
  confirmLabel: string;
  totpRequired: boolean;
  busy: boolean;
  error: string | null;
  onClose: () => void;
  onSubmit: (verification: Verification) => void;
}) {
  const [password, setPassword] = useState('');
  const [code, setCode] = useState('');
  const [useBackup, setUseBackup] = useState(false);

  useEffect(() => {
    if (!open) return;
    setPassword('');
    setCode('');
    setUseBackup(false);
  }, [open]);

  const codeValid = !totpRequired || (useBackup ? code.trim().length >= 8 : code.length === 6);
  const canSubmit = Boolean(password) && codeValid && !busy;

  function close() {
    if (busy) return;
    setPassword('');
    setCode('');
    setUseBackup(false);
    onClose();
  }

  return (
    <Modal open={open} title={title} onClose={close} className="modal-sensitive-action">
      <form
        className="sensitive-action-dialog"
        onSubmit={(event) => {
          event.preventDefault();
          if (!canSubmit) return;
          onSubmit({ password, ...(totpRequired ? { code: code.trim() } : {}) });
        }}
      >
        <div className="sensitive-action-intro">
          <span aria-hidden>
            <ShieldAlert size={20} />
          </span>
          <p>{description}</p>
        </div>

        {error ? (
          <p className="field-error" role="alert">
            {error}
          </p>
        ) : null}

        <FormField label="Текущий пароль" htmlFor="sensitive-action-password">
          <PasswordInput
            id="sensitive-action-password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            autoComplete="current-password"
            autoFocus
            required
          />
        </FormField>

        {totpRequired ? (
          <>
            {useBackup ? (
              <FormField label="Резервный код" htmlFor="sensitive-action-code">
                <Input
                  id="sensitive-action-code"
                  value={code}
                  onChange={(event) => setCode(event.target.value)}
                  placeholder="XXXX-XXXX"
                  autoComplete="off"
                  required
                />
              </FormField>
            ) : (
              <FormField label="Код из приложения" htmlFor="sensitive-action-code">
                <OtpCodeInput
                  id="sensitive-action-code"
                  value={code}
                  onChange={setCode}
                  disabled={busy}
                  required
                />
              </FormField>
            )}
            <button
              type="button"
              className="profile-2fa-switch"
              onClick={() => {
                setUseBackup((value) => !value);
                setCode('');
              }}
            >
              {useBackup ? 'Ввести код из приложения' : 'Использовать резервный код'}
            </button>
          </>
        ) : null}

        <div className="profile-security-actions sensitive-action-actions">
          <Button type="button" variant="secondary" onClick={close} disabled={busy}>
            Отмена
          </Button>
          <Button type="submit" variant="danger" disabled={!canSubmit}>
            {busy ? 'Проверяем…' : confirmLabel}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
