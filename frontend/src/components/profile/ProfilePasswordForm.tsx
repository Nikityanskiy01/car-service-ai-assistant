import { Link } from 'react-router-dom';
import { Check, KeyRound, Lock } from 'lucide-react';
import { useEffect, useState } from 'react';
import { changePassword } from '../../api/dashboard';
import { FormField } from '../forms/FormField';
import { ProfilePasswordField } from './ProfilePasswordField';
import { getPasswordError } from '../../lib/validation';

type Props = {
  onPasswordChanged: () => Promise<void>;
};

export function ProfilePasswordForm({ onPasswordChanged }: Props) {
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<{ current?: string; next?: string }>({});

  useEffect(() => {
    if (!success) return;
    const timer = window.setTimeout(() => setSuccess(null), 4000);
    return () => window.clearTimeout(timer);
  }, [success]);

  function resetForm() {
    setCurrentPassword('');
    setNewPassword('');
    setFieldErrors({});
    setError(null);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const nextErrors: { current?: string; next?: string } = {};
    if (!currentPassword) nextErrors.current = 'Введите текущий пароль';
    const passwordError = getPasswordError(newPassword);
    if (passwordError) nextErrors.next = passwordError;
    setFieldErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) return;

    setSaving(true);
    setError(null);
    setSuccess(null);
    try {
      await changePassword({ currentPassword, newPassword });
      await onPasswordChanged();
      resetForm();
      setSuccess('Пароль обновлён');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Не удалось сменить пароль');
    } finally {
      setSaving(false);
    }
  }

  const canSubmit = Boolean(currentPassword && newPassword && !saving);

  return (
    <form className="profile-password-form" onSubmit={(e) => void handleSubmit(e)}>
      <FormField label="Текущий пароль" htmlFor="profile-current-password" error={fieldErrors.current}>
        <ProfilePasswordField
          id="profile-current-password"
          icon={Lock}
          value={currentPassword}
          placeholder="Введите текущий пароль"
          autoComplete="current-password"
          onChange={(value) => {
            setCurrentPassword(value);
            if (fieldErrors.current) setFieldErrors((prev) => ({ ...prev, current: undefined }));
          }}
        />
      </FormField>

      <FormField label="Новый пароль" htmlFor="profile-new-password" error={fieldErrors.next}>
        <ProfilePasswordField
          id="profile-new-password"
          icon={KeyRound}
          value={newPassword}
          placeholder="Минимум 12 символов"
          autoComplete="new-password"
          onChange={(value) => {
            setNewPassword(value);
            if (fieldErrors.next) setFieldErrors((prev) => ({ ...prev, next: undefined }));
          }}
        />
      </FormField>

      {error ? <p className="form-error">{error}</p> : null}
      {success ? (
        <p className="profile-password-success">
          <Check size={15} aria-hidden />
          {success}
        </p>
      ) : null}

      <div className="profile-password-actions">
        <button type="submit" className="profile-password-submit" disabled={!canSubmit}>
          {saving ? 'Сохранение…' : 'Сменить пароль'}
        </button>
        <Link className="profile-password-forgot" to="/forgot-password">
          Забыли пароль?
        </Link>
      </div>
    </form>
  );
}
