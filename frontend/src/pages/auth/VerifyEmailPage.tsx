import { useEffect, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { api } from '../../api/client';
import { useAuth } from '../../auth/AuthProvider';
import type { AuthUser } from '../../types/auth';
import { FormField } from '../../components/forms/FormField';
import { Alert } from '../../components/ui/Alert';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { claimGuestConsultationSessionIfPresent } from '../../features/consultations/claimGuestSession';
import { usePageMeta } from '../../hooks/usePageMeta';

const RESEND_COOLDOWN_SEC = 60;

export function VerifyEmailPage() {
  usePageMeta({
    title: 'Подтверждение email',
    description: 'Введите код из письма для завершения регистрации.',
  });

  const [params] = useSearchParams();
  const navigate = useNavigate();
  const { setUser } = useAuth();

  const [email, setEmail] = useState(params.get('email') || '');
  const [code, setCode] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [resendLoading, setResendLoading] = useState(false);
  const [resendCooldown, setResendCooldown] = useState(0);

  useEffect(() => {
    if (resendCooldown <= 0) return;
    const timer = window.setTimeout(() => setResendCooldown((v) => v - 1), 1000);
    return () => window.clearTimeout(timer);
  }, [resendCooldown]);

  async function onSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (!email.trim()) {
      setError('Укажите email');
      return;
    }
    if (!/^\d{6}$/.test(code.trim())) {
      setError('Введите 6-значный код из письма');
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const data = await api<{ user: AuthUser }>('/auth/verify-email', {
        method: 'POST',
        body: { email: email.trim(), code: code.trim() },
        skipCsrf: true,
        skipAuthRefresh: true,
      });
      setUser(data.user);
      await claimGuestConsultationSessionIfPresent();
      navigate('/dashboard/client', { replace: true });
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Не удалось подтвердить email');
    } finally {
      setLoading(false);
    }
  }

  async function onResend() {
    if (!email.trim() || resendCooldown > 0) return;
    setResendLoading(true);
    setError(null);
    setInfo(null);
    try {
      const data = await api<{ message: string }>('/auth/resend-verification', {
        method: 'POST',
        body: { email: email.trim() },
        skipCsrf: true,
        skipAuthRefresh: true,
      });
      setInfo(data.message);
      setResendCooldown(RESEND_COOLDOWN_SEC);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Не удалось отправить код');
    } finally {
      setResendLoading(false);
    }
  }

  return (
    <div className="fm-page fm-auth-page">
      <div className="fm-auth-shell fm-auth-shell--narrow">
        <section className="fm-auth-main" aria-labelledby="verify-title">
          <header className="fm-auth-head">
            <p className="fm-pill">Регистрация</p>
            <h1 id="verify-title">Подтвердите email</h1>
            <p className="fm-auth-subtitle">
              Мы отправили 6-значный код на вашу почту. Введите его ниже, чтобы завершить регистрацию.
            </p>
          </header>

          <form className="fm-form fm-auth-form stack" onSubmit={onSubmit} noValidate>
            {error ? <Alert kind="error">{error}</Alert> : null}
            {info ? <Alert kind="success">{info}</Alert> : null}

            <FormField label="Email" htmlFor="verifyEmail">
              <Input
                id="verifyEmail"
                name="email"
                type="email"
                required
                autoComplete="email"
                placeholder="client@example.com"
                value={email}
                onChange={(e) => {
                  setEmail(e.target.value);
                  if (error) setError(null);
                }}
              />
            </FormField>

            <FormField label="Код из письма" htmlFor="verifyCode" hint="6 цифр">
              <Input
                id="verifyCode"
                name="code"
                inputMode="numeric"
                autoComplete="one-time-code"
                required
                maxLength={6}
                placeholder="123456"
                value={code}
                onChange={(e) => {
                  setCode(e.target.value.replace(/\D/g, '').slice(0, 6));
                  if (error) setError(null);
                }}
              />
            </FormField>

            <Button type="submit" disabled={loading}>
              {loading ? 'Проверка...' : 'Подтвердить'}
            </Button>

            <p className="fm-auth-resend">
              Не пришёл код?{' '}
              <button
                type="button"
                className="fm-auth-resend-btn"
                disabled={resendLoading || resendCooldown > 0 || !email.trim()}
                onClick={onResend}
              >
                {resendCooldown > 0
                  ? `Отправить снова (${resendCooldown}с)`
                  : resendLoading
                    ? 'Отправка...'
                    : 'Отправить снова'}
              </button>
            </p>
          </form>

          <p className="fm-auth-switch">
            <Link to="/login">Уже подтвердили? Войти</Link>
          </p>
        </section>
      </div>
    </div>
  );
}
