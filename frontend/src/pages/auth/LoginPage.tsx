import { Briefcase, Car, MessageSquare } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Link, useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import { api } from '../../api/client';
import { ApiError } from '../../api/errors';
import { useAuth } from '../../auth/AuthProvider';
import type { AuthUser } from '../../types/auth';
import { FormField } from '../../components/forms/FormField';
import { PasswordInput } from '../../components/forms/PasswordInput';
import { Alert } from '../../components/ui/Alert';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { useProductConfig } from '../../config/ProductConfigProvider';
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

export function LoginPage() {
  const productConfig = useProductConfig();
  usePageMeta({
    title: 'Вход',
    description: 'Вход в личный кабинет клиента или сотрудника автосервиса.',
  });
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [emailError, setEmailError] = useState<string | null>(null);
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

  async function onSubmit(event: React.FormEvent) {
    event.preventDefault();
    const nextEmailError = getEmailError(email);
    setEmailError(nextEmailError);
    if (nextEmailError) return;

    setLoading(true);
    setError(null);
    try {
      const data = await api<{ user: AuthUser }>('/auth/login', {
        method: 'POST',
        body: { email, password },
        skipCsrf: true,
        skipAuthRefresh: true,
      });
      setUser(data.user);
      if (data.user.role === 'CLIENT') {
        await claimGuestConsultationSessionIfPresent();
      }
      const next = getSafeInternalPath(params.get('next'));
      if (next) {
        navigate(next, { replace: true });
        return;
      }
      const role = data.user.role;
      if (role === 'ADMINISTRATOR') navigate('/dashboard/admin', { replace: true });
      else if (role === 'MANAGER') navigate('/dashboard/manager', { replace: true });
      else navigate('/dashboard/client', { replace: true });
    } catch (e) {
      if (e instanceof ApiError) {
        const code = String((e.data as Record<string, unknown>)?.code || '').toUpperCase();
        if (code === 'EMAIL_NOT_VERIFIED') {
          navigate(`/verify-email?email=${encodeURIComponent(email.trim())}`, { replace: true });
          return;
        }
      }
      setError(e instanceof Error ? e.message : 'Ошибка входа');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="fm-page fm-auth-page">
      <div className="fm-auth-shell">
        <section className="fm-auth-main" aria-labelledby="login-title">
          <header className="fm-auth-head">
            <p className="fm-pill">Личный кабинет</p>
            <h1 id="login-title">Вход</h1>
            <p className="fm-auth-subtitle">
              Кабинет клиента и сотрудников {productConfig.shortName}. Используйте email и пароль, указанные при
              регистрации.
            </p>
          </header>

          <form className="fm-form fm-auth-form stack" onSubmit={onSubmit} noValidate>
            {resetNotice ? <Alert kind="success">{resetNotice}</Alert> : null}
            {error ? <Alert kind="error">{error}</Alert> : null}

            <FormField label="Email" htmlFor="loginEmail" error={emailError}>
              <Input
                id="loginEmail"
                name="email"
                type="email"
                required
                autoComplete="email"
                placeholder="client@example.com"
                value={email}
                onChange={(e) => {
                  setEmail(e.target.value);
                  if (emailError) setEmailError(null);
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
            </p>

            <Button type="submit" disabled={loading}>
              {loading ? 'Вход...' : 'Войти'}
            </Button>

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

        <aside className="fm-auth-aside" aria-label="Возможности кабинета">
          <h2>После входа</h2>
          <p className="fm-auth-aside-lead">Всё, что нужно для работы с автосервисом — без звонков и повторных объяснений.</p>
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
        </aside>
      </div>
    </div>
  );
}
