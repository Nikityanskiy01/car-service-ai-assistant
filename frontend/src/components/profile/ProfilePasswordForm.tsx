import { Link } from 'react-router-dom';
import { Check, KeyRound, Lock, ShieldCheck } from 'lucide-react';
import { useEffect, useState } from 'react';
import { changePassword } from '../../api/dashboard';
import { FormField } from '../forms/FormField';
import { PasswordStrengthIndicator } from '../forms/PasswordStrengthIndicator';
import { Button } from '../ui/Button';
import { ProfilePasswordField } from './ProfilePasswordField';
import { getPasswordConfirmError, getPasswordError } from '../../lib/validation';

type Props = {
  onPasswordChanged: () => Promise<void>;
};

type FieldErrors = { current?: string; next?: string; confirm?: string };

export function ProfilePasswordForm({ onPasswordChanged }: Props) {
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});

  useEffect(() => {
    if (!success) return;
    const timer = window.setTimeout(() => setSuccess(null), 4000);
    return () => window.clearTimeout(timer);
  }, [success]);

  function resetForm() {
    setCurrentPassword('');
    setNewPassword('');
    setConfirmPassword('');
    setFieldErrors({});
    setError(null);
  }

  function clearFieldError(key: keyof FieldErrors) {
    setFieldErrors((prev) => (prev[key] ? { ...prev, [key]: undefined } : prev));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const nextErrors: FieldErrors = {};
    if (!currentPassword) nextErrors.current = 'Введите текущий пароль';
    const passwordError = getPasswordError(newPassword);
    if (passwordError) nextErrors.next = passwordError;
    else if (currentPassword && newPassword === currentPassword) {
      nextErrors.next = 'Новый пароль должен отличаться от текущего';
    }
    const confirmError = getPasswordConfirmError(newPassword, confirmPassword);
    if (confirmError) nextErrors.confirm = confirmError;
    setFieldErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) return;

    setSaving(true);
    setError(null);
    setSuccess(null);
    try {
      await changePassword({ currentPassword, newPassword });
      await onPasswordChanged();
      resetForm();
      setSuccess('Пароль изменён');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Не удалось сменить пароль');
    } finally {
      setSaving(false);
    }
  }

  const canSubmit = Boolean(currentPassword && newPassword && confirmPassword && !saving);
  const passwordsMatch = Boolean(confirmPassword) && newPassword === confirmPassword;

  return (
    <div className="profile-password-layout">
      <form className="profile-password-form" onSubmit={(e) => void handleSubmit(e)} noValidate>
        <FormField
          label="Текущий пароль"
          htmlFor="profile-current-password"
          error={fieldErrors.current}
          required
        >
          <ProfilePasswordField
            id="profile-current-password"
            icon={Lock}
            value={currentPassword}
            placeholder="Введите текущий пароль"
            autoComplete="current-password"
            required
            onChange={(value) => {
              setCurrentPassword(value);
              clearFieldError('current');
              if (fieldErrors.next && value !== newPassword) clearFieldError('next');
            }}
          />
        </FormField>

        <FormField label="Новый пароль" htmlFor="profile-new-password" error={fieldErrors.next} required>
          <ProfilePasswordField
            id="profile-new-password"
            icon={KeyRound}
            value={newPassword}
            placeholder="Придумайте новый пароль"
            autoComplete="new-password"
            required
            onChange={(value) => {
              setNewPassword(value);
              setFieldErrors((prev) => ({
                ...prev,
                next: undefined,
                confirm: confirmPassword
                  ? getPasswordConfirmError(value, confirmPassword) || undefined
                  : prev.confirm,
              }));
            }}
          />
        </FormField>

        <FormField
          label="Повторите пароль"
          htmlFor="profile-confirm-password"
          error={fieldErrors.confirm}
          required
        >
          <ProfilePasswordField
            id="profile-confirm-password"
            icon={ShieldCheck}
            value={confirmPassword}
            placeholder="Повторите новый пароль"
            autoComplete="new-password"
            required
            onChange={(value) => {
              setConfirmPassword(value);
              if (value) {
                const confirmError = getPasswordConfirmError(newPassword, value);
                setFieldErrors((prev) => ({ ...prev, confirm: confirmError || undefined }));
              } else {
                clearFieldError('confirm');
              }
            }}
          />
        </FormField>

        {error ? <p className="form-error">{error}</p> : null}
        {success ? (
          <p className="profile-password-success" role="status">
            <Check size={15} aria-hidden />
            {success}
          </p>
        ) : null}

        <div className="profile-password-actions">
          <Button type="submit" className="profile-password-submit" disabled={!canSubmit}>
            {saving ? 'Сохранение…' : 'Сменить пароль'}
          </Button>
          <Link className="profile-password-forgot" to="/forgot-password">
            Забыли пароль?
          </Link>
        </div>
      </form>

      <aside className="profile-password-aside" aria-label="Требования к паролю">
        <PasswordStrengthIndicator password={newPassword} id="profile-password-policy" alwaysVisible />
        {confirmPassword ? (
          <p className={`profile-password-match${passwordsMatch ? ' is-match' : ' is-mismatch'}`} role="status">
            <span className="profile-password-match-icon" aria-hidden>
              {passwordsMatch ? <Check size={14} strokeWidth={3} /> : <ShieldCheck size={14} strokeWidth={2} />}
            </span>
            {passwordsMatch ? 'Пароли совпадают' : 'Пароли не совпадают'}
          </p>
        ) : (
          <p className="profile-password-aside-hint">
            После смены вы останетесь в кабинете. На других устройствах может понадобиться войти заново.
          </p>
        )}
      </aside>
    </div>
  );
}
