import { useEffect, useState } from 'react';
import { flushSync } from 'react-dom';
import { Link, useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import { api } from '../../api/client';
import { useAuth } from '../../auth/AuthProvider';
import type { AuthUser } from '../../types/auth';
import { FormField } from '../../components/forms/FormField';
import { OtpCodeInput } from '../../components/forms/OtpCodeInput';
import { Alert } from '../../components/ui/Alert';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { dashboardHomeFor } from '../../config/dashboardPaths';
import { claimGuestConsultationSessionIfPresent } from '../../features/consultations/claimGuestSession';
import { usePageMeta } from '../../hooks/usePageMeta';

const RESEND_COOLDOWN_SEC = 60;

type VerifyEmailLocationState = {
  justRegistered?: boolean;
  message?: string;
  maskedEmail?: string;
};

export function VerifyEmailPage() {
  usePageMeta({
    title: 'Подтверждение email',
    description: 'Введите код из письма для завершения регистрации.',
  });

  const [params] = useSearchParams();
  const location = useLocation();
  const navigate = useNavigate();
  const { setUser } = useAuth();
  const locationState = (location.state as VerifyEmailLocationState | null) ?? null;

  const [email, setEmail] = useState(params.get('email') || '');
  const [code, setCode] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(locationState?.message ?? null);
  const [loading, setLoading] = useState(false);
  const [resendLoading, setResendLoading] = useState(false);
  const [resendCooldown, setResendCooldown] = useState(locationState?.justRegistered ? RESEND_COOLDOWN_SEC : 0);
  const emailLocked = Boolean(locationState?.justRegistered && email.trim());

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
      flushSync(() => setUser(data.user));
      if (data.user.role === 'CLIENT') await claimGuestConsultationSessionIfPresent();
      navigate(dashboardHomeFor(data.user.role), { replace: true });
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

  const maskedEmail = locationState?.maskedEmail;
  const subtitle = locationState?.justRegistered
    ? maskedEmail
      ? `Мы отправили 6-значный код на ${maskedEmail}. Введите его ниже, чтобы завершить регистрацию.`
      : 'Мы отправили 6-значный код на вашу почту. Введите его ниже, чтобы завершить регистрацию.'
    : 'Мы отправили 6-значный код на вашу почту. Введите его ниже, чтобы завершить регистрацию.';

  return (
    <div className="fm-page fm-auth-page">
      <div className="fm-auth-shell fm-auth-shell--narrow">
        <section className="fm-auth-main" aria-labelledby="verify-title">
          <header className="fm-auth-head">
            <p className="fm-pill">{locationState?.justRegistered ? 'Регистрация' : 'Подтверждение'}</p>
            <h1 id="verify-title">Подтвердите email</h1>
            <p className="fm-auth-subtitle">{subtitle}</p>
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
                readOnly={emailLocked}
                autoComplete="email"
                placeholder="client@example.com"
                value={email}
                className={emailLocked ? 'input-readonly' : undefined}
                onChange={(e) => {
                  if (emailLocked) return;
                  setEmail(e.target.value);
                  if (error) setError(null);
                }}
              />
            </FormField>

            <FormField label="Код из письма" htmlFor="verifyCode">
              <OtpCodeInput
                id="verifyCode"
                name="code"
                required
                value={code}
                autoFocus={locationState?.justRegistered}
                aria-invalid={Boolean(error)}
                onChange={(next) => {
                  setCode(next);
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
