import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { api } from '../../api/client';
import { FormField } from '../../components/forms/FormField';
import { PasswordInput } from '../../components/forms/PasswordInput';
import { PasswordStrengthIndicator } from '../../components/forms/PasswordStrengthIndicator';
import { Alert } from '../../components/ui/Alert';
import { Button } from '../../components/ui/Button';
import { usePageMeta } from '../../hooks/usePageMeta';
import { getPasswordConfirmError, getPasswordError } from '../../lib/validation';

function readResetTokenFromLocation(): string {
  const hash = window.location.hash;
  if (hash.startsWith('#token=')) {
    return decodeURIComponent(hash.slice('#token='.length));
  }
  const legacy = new URLSearchParams(window.location.search).get('token');
  return legacy ? decodeURIComponent(legacy) : '';
}

export function ResetPasswordPage() {
  usePageMeta({
    title: 'Новый пароль',
    description: 'Задайте новый пароль для входа в личный кабинет.',
  });

  const [token, setToken] = useState('');
  const navigate = useNavigate();

  useEffect(() => {
    const value = readResetTokenFromLocation();
    setToken(value);
    if (window.location.hash || window.location.search.includes('token=')) {
      window.history.replaceState(null, '', window.location.pathname);
    }
  }, []);

  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [passwordError, setPasswordError] = useState<string | null>(null);
  const [confirmError, setConfirmError] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function onSubmit(event: React.FormEvent) {
    event.preventDefault();

    if (!token) {
      setError('Ссылка для сброса пароля недействительна. Запросите новую.');
      return;
    }

    const nextPasswordError = getPasswordError(password);
    const nextConfirmError = getPasswordConfirmError(password, confirmPassword);
    setPasswordError(nextPasswordError);
    setConfirmError(nextConfirmError);
    if (nextPasswordError || nextConfirmError) return;

    setLoading(true);
    setError(null);
    try {
      await api('/auth/reset-password', {
        method: 'POST',
        body: { token, password },
        skipCsrf: true,
        skipAuthRefresh: true,
      });
      navigate('/login', { replace: true, state: { passwordReset: true } });
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Не удалось сменить пароль');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="fm-page fm-auth-page">
      <div className="fm-auth-shell fm-auth-shell--narrow">
        <section className="fm-auth-main" aria-labelledby="reset-title">
          <header className="fm-auth-head">
            <p className="fm-pill">Новый пароль</p>
            <h1 id="reset-title">Создайте пароль</h1>
            <p className="fm-auth-subtitle">
              Пароль: минимум 12 символов, латиница, цифра и спецсимвол.
            </p>
          </header>

          {!token ? (
            <Alert kind="error">
              Ссылка для сброса недействительна.{' '}
              <Link to="/forgot-password">Запросить новую ссылку</Link>
            </Alert>
          ) : (
            <form className="fm-form fm-auth-form stack" onSubmit={onSubmit} noValidate>
              {error ? <Alert kind="error">{error}</Alert> : null}

              <FormField label="Новый пароль" htmlFor="resetPassword" error={passwordError}>
                <PasswordInput
                  id="resetPassword"
                  name="password"
                  required
                  autoComplete="new-password"
                  placeholder="Введите новый пароль"
                  value={password}
                  onChange={(e) => {
                    setPassword(e.target.value);
                    if (passwordError) setPasswordError(null);
                    if (error) setError(null);
                  }}
                />
                <PasswordStrengthIndicator password={password} id="resetPassword" />
              </FormField>

              <FormField label="Повторите пароль" htmlFor="resetPasswordConfirm" error={confirmError}>
                <PasswordInput
                  id="resetPasswordConfirm"
                  name="confirmPassword"
                  required
                  autoComplete="new-password"
                  placeholder="Повторите пароль"
                  value={confirmPassword}
                  onChange={(e) => {
                    setConfirmPassword(e.target.value);
                    if (confirmError) setConfirmError(null);
                    if (error) setError(null);
                  }}
                />
              </FormField>

              <Button type="submit" disabled={loading}>
                {loading ? 'Сохранение...' : 'Сохранить пароль'}
              </Button>
            </form>
          )}

          <p className="fm-auth-switch">
            <Link to="/login">Вернуться ко входу</Link>
          </p>
        </section>
      </div>
    </div>
  );
}
