import { useEffect, useState } from 'react';
import { FormField } from '../forms/FormField';
import { OtpCodeInput } from '../forms/OtpCodeInput';
import { PasswordInput } from '../forms/PasswordInput';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';
import { Modal } from '../ui/Modal';

export const OTP_DELETE_PHRASE = 'УДАЛИТЬ';

export function DisableTotpDialog({
  open,
  busy,
  error,
  onClose,
  onSubmit,
}: {
  open: boolean;
  busy: boolean;
  error: string | null;
  onClose: () => void;
  onSubmit: (body: { password: string; code: string; confirmPhrase: string }) => void;
}) {
  const [password, setPassword] = useState('');
  const [code, setCode] = useState('');
  const [phrase, setPhrase] = useState('');
  const [useBackup, setUseBackup] = useState(false);

  useEffect(() => {
    if (!open) return;
    setPassword('');
    setCode('');
    setPhrase('');
    setUseBackup(false);
  }, [open]);

  const phraseOk = phrase.trim().toUpperCase() === OTP_DELETE_PHRASE;
  const codeOk = useBackup ? code.trim().length >= 8 : code.replace(/\D/g, '').length === 6;
  const canSubmit = Boolean(password) && codeOk && phraseOk && !busy;

  function resetAndClose() {
    setPassword('');
    setCode('');
    setPhrase('');
    setUseBackup(false);
    onClose();
  }

  return (
    <Modal
      open={open}
      title="Отключить защиту входа"
      onClose={resetAndClose}
      className="modal-2fa-disable"
    >
      <form
        className="profile-2fa-disable-dialog"
        onSubmit={(e) => {
          e.preventDefault();
          if (!canSubmit) return;
          onSubmit({ password, code: code.trim(), confirmPhrase: phrase.trim() });
        }}
      >
        <p>
          После отключения вход останется только по паролю. Это действие нельзя отменить.
        </p>
        <ul className="profile-2fa-warn-list">
          <li>Резервные коды перестанут действовать</li>
          <li>На других устройствах нужно будет войти заново</li>
          <li>Запись в приложении для кодов удалите сами</li>
        </ul>

        {error ? (
          <p className="field-error" role="alert">
            {error}
          </p>
        ) : null}

        <FormField label="Текущий пароль" htmlFor="totp-delete-password">
          <PasswordInput
            id="totp-delete-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete="current-password"
            required
          />
        </FormField>

        {useBackup ? (
          <FormField label="Резервный код" htmlFor="totp-delete-code">
            <Input
              id="totp-delete-code"
              value={code}
              onChange={(e) => setCode(e.target.value)}
              placeholder="XXXX-XXXX"
              autoComplete="off"
              required
            />
          </FormField>
        ) : (
          <FormField label="Код из приложения" htmlFor="totp-delete-code">
            <OtpCodeInput
              id="totp-delete-code"
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
            setUseBackup((v) => !v);
            setCode('');
          }}
        >
          {useBackup ? 'Ввести код из приложения' : 'Ввести резервный код'}
        </button>

        <FormField
          label={`Чтобы подтвердить, введите слово ${OTP_DELETE_PHRASE}`}
          htmlFor="totp-delete-phrase"
        >
          <Input
            id="totp-delete-phrase"
            value={phrase}
            onChange={(e) => setPhrase(e.target.value)}
            autoComplete="off"
            spellCheck={false}
            placeholder={OTP_DELETE_PHRASE}
            required
          />
        </FormField>

        <div className="profile-security-actions profile-2fa-actions">
          <Button type="button" variant="secondary" onClick={resetAndClose} disabled={busy}>
            Отмена
          </Button>
          <Button type="submit" variant="danger" disabled={!canSubmit}>
            {busy ? 'Отключение…' : 'Отключить защиту'}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
