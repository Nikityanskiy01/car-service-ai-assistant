import { useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../../api/client';
import { FormField } from '../../components/forms/FormField';
import { Alert } from '../../components/ui/Alert';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { usePageMeta } from '../../hooks/usePageMeta';
import { getEmailError } from '../../lib/validation';

export function ForgotPasswordPage() {
  usePageMeta({
    title: 'Восстановление пароля',
    description: 'Запросите ссылку для сброса пароля на email.',
  });

  const [email, setEmail] = useState('');
  const [emailError, setEmailError] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function onSubmit(event: React.FormEvent) {
    event.preventDefault();
    const nextEmailError = getEmailError(email);
    setEmailError(nextEmailError);
    if (nextEmailError) return;

    setLoading(true);
    setError(null);
    setSuccess(null);
    try {
      const data = await api<{ message: string }>('/auth/forgot-password', {
        method: 'POST',
        body: { email },
        skipCsrf: true,
        skipAuthRefresh: true,
      });
      setSuccess(data.message);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Не удалось отправить запрос');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="fm-page fm-auth-page">
      <div className="fm-auth-shell fm-auth-shell--narrow">
        <section className="fm-auth-main" aria-labelledby="forgot-title">
          <header className="fm-auth-head">
            <p className="fm-pill">Восстановление доступа</p>
            <h1 id="forgot-title">Забыли пароль?</h1>
            <p className="fm-auth-subtitle">
              Укажите email, который использовали при регистрации. Мы отправим ссылку для создания нового пароля.
            </p>
          </header>

          <form className="fm-form fm-auth-form stack" onSubmit={onSubmit} noValidate>
            {error ? <Alert kind="error">{error}</Alert> : null}
            {success ? <Alert kind="success">{success}</Alert> : null}

            <FormField label="Email" htmlFor="forgotEmail" error={emailError}>
              <Input
                id="forgotEmail"
                name="email"
                type="email"
                required
                autoComplete="email"
                placeholder="client@example.com"
                value={email}
                disabled={Boolean(success)}
                onChange={(e) => {
                  setEmail(e.target.value);
                  if (emailError) setEmailError(null);
                  if (error) setError(null);
                }}
              />
            </FormField>

            <Button type="submit" disabled={loading || Boolean(success)}>
              {loading ? 'Отправка...' : 'Отправить ссылку'}
            </Button>
          </form>

          <p className="fm-auth-switch">
            <Link to="/login">Вернуться ко входу</Link>
          </p>
        </section>
      </div>
    </div>
  );
}
