import { Briefcase, Car, KeyRound, Mail, MessageCircle, MessageSquare, ShieldCheck } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { flushSync } from 'react-dom';
import { Link, useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import { api } from '../../api/client';
import { useAuth } from '../../auth/AuthProvider';
import type { AuthUser } from '../../types/auth';
import { FormField } from '../../components/forms/FormField';
import { OtpCodeInput } from '../../components/forms/OtpCodeInput';
import { PasswordInput } from '../../components/forms/PasswordInput';
import { Alert } from '../../components/ui/Alert';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { useProductConfig } from '../../config/ProductConfigProvider';
import { dashboardProfileFor, resolveRedirectFor } from '../../config/dashboardPaths';
import { claimGuestConsultationSessionIfPresent } from '../../features/consultations/claimGuestSession';
import { usePageMeta } from '../../hooks/usePageMeta';
import { getSafeInternalPath } from '../../lib/safeRedirect';
import { getEmailError } from '../../lib/validation';

const LOGIN_BENEFITS = [
  {
    icon: MessageSquare,
    title: 'История консультаций и заявок',
    text: 'Все обращения и переписка с сервисом в одном месте.',
  },
  {
    icon: Car,
    title: 'Статусы работ по автомобилю',
    text: 'Отслеживайте диагностику, ремонт и готовность к выдаче.',
  },
  {
    icon: Briefcase,
    title: 'Рабочий стол для сотрудников',
    text: 'Менеджеры и администраторы входят под корпоративным аккаунтом.',
  },
] as const;

type OtpChannel = 'email' | 'telegram';

type LoginResponse =
  | { user: AuthUser; requires2fa?: false; totpSetupPending?: boolean }
  | { requires2fa: true; challengeToken: string; code?: string };

type OtpStartResponse = {
  challengeToken: string;
  channel: string;
  destinationHint: string;
  expiresInSec: number;
  resendAfterSec: number;
};

export function LoginPage() {
  const productConfig = useProductConfig();
  usePageMeta({
    title: 'Вход',
    description: 'Вход в личный кабинет клиента или сотрудника автосервиса.',
  });
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [otpChannel, setOtpChannel] = useState<OtpChannel | null>(null);
  const [otpCode, setOtpCode] = useState('');
  const [otpToken, setOtpToken] = useState<string | null>(null);
  const [otpHint, setOtpHint] = useState<string | null>(null);
  const [resendIn, setResendIn] = useState(0);
  const [totpCode, setTotpCode] = useState('');
  const [challengeToken, setChallengeToken] = useState<string | null>(null);
  const [useBackupCode, setUseBackupCode] = useState(false);
  const totpFormRef = useRef<HTMLFormElement>(null);
  const [identifierError, setIdentifierError] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();
  const [params] = useSearchParams();
  const { setUser } = useAuth();
  const [resetNotice, setResetNotice] = useState<string | null>(null);

  useEffect(() => {
    const state = location.state as { passwordReset?: boolean } | null;
    if (state?.passwordReset) {
      setResetNotice('Пароль успешно изменён. Войдите с новым паролем.');
      navigate(location.pathname + location.search, { replace: true, state: null });
    }
  }, [location.pathname, location.search, location.state, navigate]);

  useEffect(() => {
    if (resendIn <= 0) return undefined;
    const id = window.setTimeout(() => setResendIn((v) => Math.max(0, v - 1)), 1000);
    return () => window.clearTimeout(id);
  }, [resendIn]);

  async function finishLogin(user: AuthUser, totpSetupPending = false) {
    flushSync(() => setUser({ ...user, totpSetupPending: totpSetupPending || user.totpSetupPending }));
    if (totpSetupPending || user.totpSetupPending) {
      navigate(`${dashboardProfileFor(user.role)}?tab=security&section=protection`, { replace: true });
      return;
    }
    if (user.role === 'CLIENT') {
      await claimGuestConsultationSessionIfPresent();
    }
    const next = getSafeInternalPath(params.get('next'));
    navigate(resolveRedirectFor(next, user.role), { replace: true });
  }

  function handleOtpSuccess(data: LoginResponse) {
    if ('requires2fa' in data && data.requires2fa) {
      setUser(null);
      setChallengeToken(data.challengeToken);
      setTotpCode('');
      setUseBackupCode(false);
      return false;
    }
    return true;
  }

  async function onSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (challengeToken) {
      await submitTotp();
      return;
    }
    if (otpToken) {
      await submitOtp();
      return;
    }
    const kind = validateIdentifier();
    if (!kind) return;

    setLoading(true);
    setError(null);
    try {
      const data = await api<LoginResponse>('/auth/login', {
        method: 'POST',
        body: { identifier, password },
        skipCsrf: true,
        skipAuthRefresh: true,
      });
      if (handleOtpSuccess(data) && 'user' in data) await finishLogin(data.user, data.totpSetupPending);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Ошибка входа');
    } finally {
      setLoading(false);
    }
  }

  function validateIdentifier(): OtpChannel | null {
    const value = identifier.trim();
    if (value.includes('@')) {
      const nextError = getEmailError(value);
      setIdentifierError(nextError);
      return nextError ? null : 'email';
    }
    if (digits(value).length < 10) {
      setIdentifierError('Укажите корректный телефон или email');
      return null;
    }
    setIdentifierError(null);
    return 'telegram';
  }

  async function startIdentifierOtp() {
    const channel = validateIdentifier();
    if (!channel) return;
    setLoading(true);
    setError(null);
    try {
      const data = await api<OtpStartResponse>('/auth/otp/start', {
        method: 'POST',
        body: channel === 'email' ? { channel, email: identifier } : { channel, phone: identifier },
        skipCsrf: true,
        skipAuthRefresh: true,
      });
      setOtpChannel(channel);
      setOtpToken(data.challengeToken);
      setOtpHint(data.destinationHint);
      setOtpCode('');
      setResendIn(data.resendAfterSec || 60);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Не удалось отправить код');
    } finally {
      setLoading(false);
    }
  }

  async function submitOtp(codeValue = otpCode) {
    const code = String(codeValue || '').replace(/\D/g, '');
    if (!otpToken || code.length !== 6 || loading) return;
    setLoading(true);
    setError(null);
    try {
      const data = await api<LoginResponse>('/auth/otp/verify', {
        method: 'POST',
        body: { challengeToken: otpToken, code },
        skipCsrf: true,
        skipAuthRefresh: true,
      });
      if (handleOtpSuccess(data) && 'user' in data) await finishLogin(data.user, data.totpSetupPending);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Неверный код');
    } finally {
      setLoading(false);
    }
  }

  async function submitTotp(codeValue = totpCode) {
    if (!challengeToken || loading) return;
    const code = String(codeValue || '').trim();
    if (!useBackupCode && code.replace(/\D/g, '').length !== 6) return;
    if (useBackupCode && code.length < 8) return;
    setLoading(true);
    setError(null);
    try {
      const data = await api<{ user: AuthUser }>('/auth/login/2fa', {
        method: 'POST',
        body: { challengeToken, code },
        skipCsrf: true,
        skipAuthRefresh: true,
      });
      await finishLogin(data.user);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Неверный код');
    } finally {
      setLoading(false);
    }
  }

  function resetOtp() {
    setOtpToken(null);
    setOtpCode('');
    setOtpHint(null);
    setResendIn(0);
    setOtpChannel(null);
    setError(null);
  }

  function backToPassword() {
    setChallengeToken(null);
    setTotpCode('');
    setUseBackupCode(false);
    resetOtp();
  }

  const title = challengeToken ? 'Код подтверждения' : otpToken ? 'Код из сообщения' : 'Вход';
  const subtitle = challengeToken
    ? useBackupCode
      ? 'Введите один из резервных кодов, которые сохраняли при включении 2FA.'
      : 'Откройте приложение-аутентификатор и введите шестизначный код.'
    : otpToken
      ? `Код отправили на ${otpHint || 'указанный контакт'}. Он действует несколько минут.`
      : `Кабинет клиента и сотрудников ${productConfig.shortName}. Войдите по телефону или почте.`;

  const submitLabel = loading
    ? 'Проверка…'
    : challengeToken
      ? 'Подтвердить'
      : otpToken
        ? 'Войти'
        : 'Войти';

  return (
    <div className="fm-page fm-auth-page">
      <div className="fm-auth-shell">
        <section className="fm-auth-main" aria-labelledby="login-title">
          <header className="fm-auth-head">
            <p className="fm-pill">{challengeToken ? 'Защита входа' : 'Личный кабинет'}</p>
            <h1 id="login-title">{title}</h1>
            <p className="fm-auth-subtitle">{subtitle}</p>
          </header>

          <form
            ref={totpFormRef}
            className="fm-form fm-auth-form stack"
            onSubmit={(e) => void onSubmit(e)}
            noValidate
          >
            {resetNotice ? <Alert kind="success">{resetNotice}</Alert> : null}
            {error ? <Alert kind="error">{error}</Alert> : null}

            {!challengeToken && !otpToken ? (
              <>
                <FormField label="Телефон или почта" htmlFor="loginIdentifier" error={identifierError}>
                  <Input
                    id="loginIdentifier"
                    name="identifier"
                    type="text"
                    required
                    autoComplete="username"
                    placeholder="+7 999 000-11-22 или name@example.com"
                    value={identifier}
                    onChange={(e) => {
                      setIdentifier(e.target.value);
                      if (identifierError) setIdentifierError(null);
                      if (error) setError(null);
                    }}
                  />
                </FormField>

                <FormField label="Пароль" htmlFor="loginPassword">
                  <PasswordInput
                    id="loginPassword"
                    name="password"
                    required
                    autoComplete="current-password"
                    placeholder="Введите пароль"
                    value={password}
                    onChange={(e) => {
                      setPassword(e.target.value);
                      if (error) setError(null);
                    }}
                  />
                </FormField>

                <p className="fm-auth-forgot">
                  <Link to="/forgot-password">Забыли пароль?</Link>
                  <span aria-hidden="true"> · </span>
                  <Link
                    to={
                      identifier.includes('@')
                        ? `/verify-email?email=${encodeURIComponent(identifier.trim())}`
                        : '/verify-email'
                    }
                  >
                    Подтвердить email
                  </Link>
                </p>
              </>
            ) : null}

            {!challengeToken && otpToken ? (
              <div className="fm-auth-2fa">
                <FormField label="Код подтверждения" htmlFor="loginOtp">
                  <OtpCodeInput
                    id="loginOtp"
                    name="otp"
                    autoFocus
                    required
                    value={otpCode}
                    disabled={loading}
                    aria-invalid={Boolean(error)}
                    onChange={(next) => {
                      setOtpCode(next);
                      if (error) setError(null);
                    }}
                    onComplete={(code) => void submitOtp(code)}
                  />
                </FormField>
                <button
                  type="button"
                  className="fm-auth-forgot-btn"
                  disabled={loading || resendIn > 0}
                  onClick={() => void startIdentifierOtp()}
                >
                  {resendIn > 0 ? `Отправить ещё раз через ${resendIn} с` : 'Отправить код ещё раз'}
                </button>
                <button type="button" className="fm-auth-forgot-btn" onClick={resetOtp}>
                  Изменить данные
                </button>
              </div>
            ) : null}

            {challengeToken ? (
              <div className="fm-auth-2fa">
                {useBackupCode ? (
                  <FormField label="Резервный код" htmlFor="loginTotp">
                    <Input
                      id="loginTotp"
                      name="totp"
                      autoComplete="off"
                      required
                      autoFocus
                      placeholder="XXXX-XXXX"
                      value={totpCode}
                      onChange={(e) => {
                        setTotpCode(e.target.value);
                        if (error) setError(null);
                      }}
                    />
                  </FormField>
                ) : (
                  <FormField label="Код из приложения" htmlFor="loginTotp">
                    <OtpCodeInput
                      id="loginTotp"
                      name="totp"
                      autoFocus
                      required
                      value={totpCode}
                      disabled={loading}
                      aria-invalid={Boolean(error)}
                      onChange={(next) => {
                        setTotpCode(next);
                        if (error) setError(null);
                      }}
                      onComplete={(code) => void submitTotp(code)}
                    />
                  </FormField>
                )}
                <button
                  type="button"
                  className="fm-auth-forgot-btn"
                  onClick={() => {
                    setUseBackupCode((v) => !v);
                    setTotpCode('');
                    setError(null);
                  }}
                >
                  {useBackupCode ? 'Ввести код из приложения' : 'У меня резервный код'}
                </button>
                <button type="button" className="fm-auth-forgot-btn" onClick={backToPassword}>
                  Вернуться к входу
                </button>
              </div>
            ) : null}

            <Button
              type="submit"
              disabled={
                loading ||
                (Boolean(challengeToken) && !useBackupCode && totpCode.length !== 6) ||
                (Boolean(otpToken) && otpCode.length !== 6)
              }
            >
              {submitLabel}
            </Button>

            {!challengeToken && !otpToken ? (
              <Button type="button" variant="secondary" disabled={loading} onClick={() => void startIdentifierOtp()}>
                Войти по коду
              </Button>
            ) : null}

            <p className="form-legal-hint">
              Входя в кабинет, вы подтверждаете ознакомление с{' '}
              <Link to="/privacy">Политикой обработки персональных данных</Link> и{' '}
              <Link to="/terms">Пользовательским соглашением</Link>.
            </p>
          </form>

          <p className="fm-auth-switch">
            Нет аккаунта? <Link to="/register">Создать аккаунт</Link>
          </p>
        </section>

        <aside className="fm-auth-aside" aria-label={challengeToken ? 'Подсказка по 2FA' : 'Возможности кабинета'}>
          {challengeToken ? (
            <>
              <h2>Как получить код</h2>
              <p className="fm-auth-aside-lead">
                Код обновляется каждые 30 секунд. Если приложения нет под рукой, используйте резервный код.
              </p>
              <ul className="fm-auth-benefits">
                <li>
                  <span className="fm-auth-benefit-icon" aria-hidden="true">
                    <KeyRound size={18} />
                  </span>
                  <span>
                    <strong>Приложение-аутентификатор</strong>
                    <span className="fm-auth-benefit-text">Google Authenticator, 1Password или Authy.</span>
                  </span>
                </li>
                <li>
                  <span className="fm-auth-benefit-icon" aria-hidden="true">
                    <ShieldCheck size={18} />
                  </span>
                  <span>
                    <strong>Резервный код</strong>
                    <span className="fm-auth-benefit-text">Одноразовый код, который вы сохраняли при включении 2FA.</span>
                  </span>
                </li>
              </ul>
            </>
          ) : otpToken ? (
            <>
              <h2>Где искать код</h2>
              <p className="fm-auth-aside-lead">Он одноразовый и живёт несколько минут. Не пересылайте его никому.</p>
              <ul className="fm-auth-benefits">
                <li>
                  <span className="fm-auth-benefit-icon" aria-hidden="true">
                    {otpChannel === 'email' ? <Mail size={18} /> : <MessageCircle size={18} />}
                  </span>
                  <span>
                    <strong>{otpHint || 'Ваш контакт'}</strong>
                    <span className="fm-auth-benefit-text">
                      {otpChannel === 'email'
                        ? 'Проверьте входящие и папку «Спам».'
                        : 'Код придёт в чат с ботом, который вы подключали в кабинете.'}
                    </span>
                  </span>
                </li>
              </ul>
            </>
          ) : (
            <>
              <h2>После входа</h2>
              <p className="fm-auth-aside-lead">Всё для работы с автосервисом без звонков и повторных объяснений.</p>
              <ul className="fm-auth-benefits">
                {LOGIN_BENEFITS.map((item) => {
                  const Icon = item.icon;
                  return (
                    <li key={item.title}>
                      <span className="fm-auth-benefit-icon" aria-hidden="true">
                        <Icon size={18} />
                      </span>
                      <span>
                        <strong>{item.title}</strong>
                        <span className="fm-auth-benefit-text">{item.text}</span>
                      </span>
                    </li>
                  );
                })}
              </ul>
            </>
          )}
        </aside>
      </div>
    </div>
  );
}

function digits(raw: string) {
  return String(raw || '').replace(/\D/g, '');
}
